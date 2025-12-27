

---

一、背景与目标

1.1 业务背景

当前 Refly 工作流需要支持多种触发方式的自动化执行：
- 定时触发：每日/每周/每月定时执行工作流
- 手动触发：用户手动执行（需保存快照）
- Webhook 触发（未来）：外部系统通过 API 触发
1.2 优先级设计目标

- 付费用户优先：确保付费用户的任务获得更快的执行响应
- 公平调度：同一优先级内按时间顺序执行
- 动态调整：根据实时套餐状态动态计算优先级

---

二、系统架构设计

2.1 整体架构图

┌─────────────────────────────────────────────────────────────┐
│                         前端层                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 创建定时任务  │  │ 任务列表     │  │ 执行记录     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API 控制器层                            │
│                  ScheduleController                          │
│  (CRUD + 查询执行记录)                                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      业务逻辑层                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ScheduleService (调度管理)                           │  │
│  │ - createSchedule()    创建定时任务                   │  │
│  │ - updateSchedule()    更新定时任务                   │  │
│  │ - deleteSchedule()    删除定时任务                   │  │
│  │ - listSchedules()     查询任务列表                   │  │
│  │ - getScheduleRecords() 查询执行记录                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ScheduleCronService (定时扫描)                       │  │
│  │ - scanAndTrigger()    每分钟扫描到期任务             │  │
│  │ - calculatePriority() 计算用户执行优先级【新增】     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      执行层 (独立)                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ScheduleProcessor (任务执行)                         │  │
│  │ - process()           执行工作流                     │  │
│  │ - checkLimit()        检查限流                       │  │
│  │ - extractTools()      提取工具列表                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      数据层                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ PostgreSQL   │  │ Redis        │  │ MinIO        │      │
│  │ (任务配置)   │  │ (限流/优先级)│  │ (快照存储)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘


---

三、用户套餐执行优先级设计【新增】

3.1 套餐优先级映射

套餐类型 (planType)
优先级值 (priority)
说明
enterprise
1
企业版 - 最高优先级
pro
2
专业版
maker
2
创客版
plus
3
Plus/早鸟版
starter
4
入门版
free
5
免费版 - 最低优先级

> BullMQ 优先级说明: 数值越小，优先级越高。优先级 1 的任务会优先于优先级 5 的任务执行。

3.2 优先级计算伪代码

// apps/api/src/modules/schedule/schedule-priority.service.ts

/**
 * 套餐类型到优先级的映射
 * BullMQ priority: 数值越小优先级越高
 */
const PLAN_PRIORITY_MAP: Record<string, number> = {
  enterprise: 1,  // 最高优先级
  pro: 2,
  maker: 2,
  plus: 3,
  starter: 4,
  free: 5,        // 最低优先级
};

/**
 * 优先级调整因子
 */
interface PriorityFactors {
  // 连续失败次数 (失败越多，临时降低优先级)
  consecutiveFailures: number;
  // 当前活跃任务数 (活跃任务越多，优先级微调)
  activeScheduleCount: number;
  // 是否为早鸟用户
  isEarlyBird: boolean;
  // 积分余额比例 (0-1)
  creditRatio: number;
}

/**
 * 计算用户执行优先级
 * 
 * @param uid 用户 ID
 * @returns 优先级值 (1-10, 越小越优先)
 */
async function calculateExecutionPriority(uid: string): Promise<number> {
  // 1. 获取用户当前订阅
  const subscription = await prisma.subscription.findFirst({
    where: {
      uid,
      status: 'active',
      OR: [
        { cancelAt: null },
        { cancelAt: { gt: new Date() } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  // 2. 获取基础优先级
  const planType = subscription?.planType ?? 'free';
  let basePriority = PLAN_PRIORITY_MAP[planType] ?? PLAN_PRIORITY_MAP.free;

  // 3. 获取优先级调整因子
  const factors = await getPriorityFactors(uid);

  // 4. 应用优先级调整
  const adjustedPriority = applyPriorityAdjustments(basePriority, factors);

  // 5. 确保优先级在有效范围内 (1-10)
  return Math.max(1, Math.min(10, adjustedPriority));
}

/**
 * 获取优先级调整因子
 */
async function getPriorityFactors(uid: string): Promise<PriorityFactors> {
  // 并行获取所有因子数据
  const [failureCount, activeCount, earlyBirdCheck, creditBalance] = await Promise.all([
    // 获取最近 24 小时内的连续失败次数
    getConsecutiveFailureCount(uid),
    // 获取当前活跃的定时任务数
    getActiveScheduleCount(uid),
    // 检查是否为早鸟用户
    checkIsEarlyBird(uid),
    // 获取积分余额比例
    getCreditBalanceRatio(uid),
  ]);

  return {
    consecutiveFailures: failureCount,
    activeScheduleCount: activeCount,
    isEarlyBird: earlyBirdCheck,
    creditRatio: creditBalance,
  };
}

/**
 * 应用优先级调整
 */
function applyPriorityAdjustments(
  basePriority: number,
  factors: PriorityFactors
): number {
  let priority = basePriority;

  // 调整 1: 早鸟用户优先级提升 (减少 0.5)
  if (factors.isEarlyBird) {
    priority -= 0.5;
  }

  // 调整 2: 连续失败惩罚 (每次失败 +0.2, 最多 +1)
  const failurePenalty = Math.min(factors.consecutiveFailures * 0.2, 1);
  priority += failurePenalty;

  // 调整 3: 积分不足警告 (积分低于 10% 时优先级降低)
  if (factors.creditRatio < 0.1) {
    priority += 0.5;
  }

  // 调整 4: 高活跃用户微调 (活跃任务 > 10 时，轻微降低优先级)
  if (factors.activeScheduleCount > 10) {
    priority += 0.2;
  }

  return Math.round(priority * 10) / 10; // 保留一位小数
}

/**
 * 获取连续失败次数
 */
async function getConsecutiveFailureCount(uid: string): Promise<number> {
  // 查询最近的执行记录，统计连续失败次数
  const recentRecords = await prisma.scheduleRecord.findMany({
    where: {
      uid,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { status: true },
  });

  let consecutiveFailures = 0;
  for (const record of recentRecords) {
    if (record.status === 'failed') {
      consecutiveFailures++;
    } else if (record.status === 'success') {
      break; // 遇到成功的记录就停止计数
    }
  }

  return consecutiveFailures;
}

/**
 * 获取活跃定时任务数
 */
async function getActiveScheduleCount(uid: string): Promise<number> {
  return prisma.workflowSchedule.count({
    where: {
      uid,
      isEnabled: true,
      deletedAt: null,
    },
  });
}

/**
 * 检查是否为早鸟用户
 */
async function checkIsEarlyBird(uid: string): Promise<boolean> {
  const subscription = await prisma.subscription.findFirst({
    where: { uid, status: 'active' },
  });

  if (subscription?.overridePlan) {
    const overridePlan = safeParseJSON(subscription.overridePlan);
    return Boolean(overridePlan?.isEarlyBird);
  }
  return false;
}

/**
 * 获取积分余额比例
 */
async function getCreditBalanceRatio(uid: string): Promise<number> {
  const [creditAccount, subscription] = await Promise.all([
    prisma.creditAccount.findFirst({ where: { uid } }),
    prisma.subscription.findFirst({
      where: { uid, status: 'active' },
      include: { plan: true },
    }),
  ]);

  const currentBalance = creditAccount?.balance ?? 0;
  const totalQuota = subscription?.plan?.creditQuota ?? 1000;

  return totalQuota > 0 ? currentBalance / totalQuota : 0;
}

3.3 优先级在队列中的应用

// apps/api/src/modules/schedule/schedule-cron.service.ts

/**
 * 推送任务到执行队列（带优先级）
 */
async function pushToExecutionQueue(schedule: WorkflowSchedule): Promise<void> {
  // 1. 计算用户优先级
  const priority = await calculateExecutionPriority(schedule.uid);

  // 2. 构建任务数据
  const jobData: ScheduledWorkflowJobData = {
    scheduleId: schedule.scheduleId,
    canvasId: schedule.canvasId,
    uid: schedule.uid,
    scheduledAt: schedule.nextRunAt!.toISOString(),
    priority, // 记录优先级用于日志
  };

  // 3. 推入 BullMQ 队列（带优先级）
  const timestamp = Date.now();
  await this.scheduleQueue.add(
    'execute-scheduled-workflow',
    jobData,
    {
      jobId: `schedule:${schedule.scheduleId}:${timestamp}`,
      // BullMQ 优先级设置
      priority: Math.floor(priority), // 取整作为 BullMQ 优先级
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  );

  this.logger.log(
    `Triggered schedule: ${schedule.scheduleId}, priority: ${priority}, plan: ${schedule.planType ?? 'unknown'}`
  );
}

3.4 优先级配置（环境变量）

# .env
# 定时任务配额配置
SCHEDULE_MAX_FREE=1
SCHEDULE_MAX_STARTER=5
SCHEDULE_MAX_PLUS=20
SCHEDULE_MAX_MAKER=20
SCHEDULE_MAX_PRO=50
SCHEDULE_MAX_ENTERPRISE=100

# 优先级微调开关
SCHEDULE_PRIORITY_EARLY_BIRD_BONUS=0.5
SCHEDULE_PRIORITY_FAILURE_PENALTY=0.2
SCHEDULE_PRIORITY_LOW_CREDIT_PENALTY=0.5


---

四、核心流程设计

4.1 调度流程 (ScheduleCronService)

时间轴: 08:00:00

1. ScheduleScanner (每分钟执行)
   │
   ├─ 获取分布式锁
   │  └─ Redis Key: schedule:scanner:lock
   │  └─ TTL: 50 秒
   │
   ├─ 查询到期任务
   │  └─ SQL: SELECT * FROM workflow_schedules
   │           WHERE is_enabled = true
   │             AND deleted_at IS NULL
   │             AND next_run_at <= NOW()
   │           LIMIT 100
   │
   └─ 遍历到期任务
      │
      ├─ 计算下次运行时间
      │  └─ nextRunAt = calculateNextRunTime(cronExpression, timezone)
      │
      ├─ 使用乐观锁更新 nextRunAt
      │  └─ UPDATE workflow_schedules
      │     SET next_run_at = ?, updated_at = NOW()
      │     WHERE schedule_id = ?
      │       AND updated_at = ?  ← 乐观锁条件
      │
      ├─ 检查更新结果
      │  ├─ count = 0 → 被其他实例更新，跳过
      │  └─ count = 1 → 更新成功，继续
      │
      ├─ 【新增】计算用户执行优先级
      │  └─ priority = calculateExecutionPriority(uid)
      │
      └─ 推入 BullMQ 队列（带优先级）
         └─ Job ID: schedule:{scheduleId}:{timestamp}
         └─ Job Data: { scheduleId, canvasId, uid, scheduledAt }
         └─ Options: { priority: priority }

4.2 执行流程 (ScheduleProcessor)

2. ScheduleProcessor (队列消费)
   │
   ├─ 【限流检查】
   │  ├─ 获取当前并发数
   │  │  └─ Redis GET workflow:execution:concurrent
   │  │
   │  ├─ 检查是否超限
   │  │  ├─ current >= 50 → 拒绝，抛出 RATE_LIMITED
   │  │  └─ current < 50  → 通过
   │  │
   │  └─ 增加并发计数
   │     └─ Redis INCR workflow:execution:concurrent
   │
   ├─ 【创建 ScheduleRecord】
   │  └─ INSERT INTO schedule_records
   │     (schedule_record_id, schedule_id, uid, canvas_id,
   │      scheduled_at, status, priority)
   │     VALUES (?, ?, ?, ?, ?, 'pending', ?)
   │
   ├─ 【完整校验】
   │  ├─ 1. 配额校验
   │  │  └─ 查询已启用的 Schedule 数量 <= maxSchedules
   │  │
   │  ├─ 2. 积分余额校验
   │  │  └─ CreditService.checkRequestCreditUsage()
   │  │  └─ 不足 → 禁用 Schedule + 更新 ScheduleRecord (failed)
   │  │
   │  ├─ 3. 实时获取工作流结构
   │  │  └─ CanvasService.getCanvasRawData(canvasId)
   │  │  └─ 获取最新 nodes/edges/variables
   │  │
   │  ├─ 4. 工具可用性校验
   │  │  └─ 检查 OAuth 状态 (如需要)
   │  │
   │  └─ 5. 必填输入项校验
   │     └─ 检查 required variables 是否有值
   │
   ├─ 【提取工具列表】
   │  └─ extractUsedTools(nodes)
   │     └─ 过滤 type = 'tool' 的节点
   │     └─ 提取 toolId/toolName
   │     └─ 去重: ["notion", "slack", "gmail"]
   │
   ├─ 【更新 ScheduleRecord】
   │  └─ UPDATE schedule_records
   │     SET workflow_title = ?,
   │         used_tools = ?,
   │         status = 'running'
   │     WHERE schedule_record_id = ?
   │
   ├─ 【生成快照】
   │  ├─ 构建 WorkflowSnapshot 对象
   │  │  └─ { executionId, scheduleId, canvasId, workflowData }
   │  │
   │  └─ 上传到 MinIO
   │     └─ Path: workflow-snapshots/{scheduleRecordId}.json
   │     └─ 返回 snapshotStorageKey
   │
   ├─ 【执行工作流】
   │  └─ WorkflowService.executeWorkflow()
   │     └─ 使用快照数据执行
   │
   ├─ 【更新执行结果】
   │  ├─ 成功
   │  │  └─ UPDATE schedule_records
   │  │     SET status = 'success',
   │  │         credit_used = ?,
   │  │         completed_at = NOW(),
   │  │         snapshot_storage_key = ?
   │  │     WHERE schedule_record_id = ?
   │  │
   │  └─ 失败
   │     └─ UPDATE schedule_records
   │        SET status = 'failed',
   │            failure_reason = ?,
   │            error_details = ?
   │        WHERE schedule_record_id = ?
   │
   ├─ 【更新 Schedule 状态】
   │  └─ UPDATE workflow_schedules
   │     SET last_run_at = NOW()
   │     WHERE schedule_id = ?
   │
   └─ 【减少并发计数】
      └─ Redis DECR workflow:execution:concurrent


---

五、数据模型设计

5.1 WorkflowSchedule 表（定时任务配置）

model WorkflowSchedule {
  // ========== 主键 ==========
  pk                  BigInt    @id @default(autoincrement())
  scheduleId          String    @unique @map("schedule_id")
  
  // ========== 关联字段 (无外键) ==========
  uid                 String    @map("uid")
  canvasId            String    @map("canvas_id")
  
  // ========== 基本信息 ==========
  /// 定时任务名称 (对应前端 Title)
  name                String    @map("name")
  
  // ========== 调度配置 ==========
  /// 是否启用 (对应前端 Schedule 开关)
  isEnabled           Boolean   @default(false) @map("is_enabled")
  
  /// Cron 表达式 (内部使用)
  cronExpression      String    @map("cron_expression")
  
  /// 前端调度配置 (JSON)
  /// { type: 'daily|weekly|monthly', time: '08:00', weekdays?: [1,2], monthDays?: [1,15] }
  scheduleConfig      String    @map("schedule_config")
  
  /// 时区
  timezone            String    @default("Asia/Shanghai") @map("timezone")
  
  // ========== 运行状态 ==========
  /// 下次运行时间 (对应前端 Next Run)
  nextRunAt           DateTime? @map("next_run_at") @db.Timestamptz()
  
  /// 最后运行时间
  lastRunAt           DateTime? @map("last_run_at") @db.Timestamptz()
  
  // ========== 审计字段 ==========
  createdAt           DateTime  @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt           DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz()
  deletedAt           DateTime? @map("deleted_at") @db.Timestamptz()
  
  // ========== 索引 ==========
  @@index([uid, isEnabled, deletedAt])
  @@index([isEnabled, nextRunAt, deletedAt])
  @@index([canvasId, deletedAt])
  @@map("workflow_schedules")
}

5.2 ScheduleRecord 表（执行历史记录）

model ScheduleRecord {
  // ========== 主键 ==========
  pk                  BigInt    @id @default(autoincrement())
  scheduleRecordId    String    @unique @map("schedule_record_id")
  
  // ========== 关联字段 (无外键) ==========
  /// 定时任务 ID
  scheduleId          String    @map("schedule_id")
  
  /// 工作流执行 ID (可能为空，如果执行前失败)
  workflowExecutionId String?   @map("workflow_execution_id")
  
  /// 用户 ID (冗余字段，便于查询)
  uid                 String    @map("uid")
  
  /// Canvas ID (冗余字段，便于查询)
  canvasId            String    @map("canvas_id")
  
  // ========== 执行信息 (对应前端 Run History) ==========
  
  /// 工作流标题 (对应前端 Title)
  /// 快照时的工作流标题
  workflowTitle       String    @map("workflow_title")
  
  /// 使用的工具列表 (对应前端 Tools)
  /// JSON 数组: ["notion", "slack", "gmail"]
  usedTools           String?   @map("used_tools")
  
  /// 执行状态 (对应前端 State)
  /// pending, running, success, failed, skipped
  status              String    @default("pending") @map("status")
  
  /// 积分消耗 (对应前端 Cost)
  creditUsed          Int       @default(0) @map("credit_used")
  
  /// 执行优先级【新增】
  priority            Int       @default(5) @map("priority")
  
  // ========== 调度信息 ==========
  
  /// 计划执行时间 (对应前端 Time)
  scheduledAt         DateTime  @map("scheduled_at") @db.Timestamptz()
  
  /// 实际触发时间
  triggeredAt         DateTime  @default(now()) @map("triggered_at") @db.Timestamptz()
  
  /// 完成时间
  completedAt         DateTime? @map("completed_at") @db.Timestamptz()
  
  // ========== 错误信息 ==========
  
  /// 失败原因
  failureReason       String?   @map("failure_reason")
  
  /// 错误详情 (JSON)
  errorDetails        String?   @map("error_details")
  
  // ========== 快照信息 ==========
  
  /// 快照存储路径
  snapshotStorageKey  String?   @map("snapshot_storage_key")
  
  // ========== 审计字段 ==========
  createdAt           DateTime  @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt           DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz()
  
  // ========== 索引 ==========
  @@index([scheduleId, scheduledAt])
  @@index([uid, status, createdAt])
  @@index([status, createdAt])
  @@index([workflowExecutionId])
  @@index([priority, scheduledAt])  // 【新增】用于优先级排序
  @@map("schedule_records")
}

5.3 扩展 WorkflowExecution 表

model WorkflowExecution {
  // ... 现有字段保持不变 ...
  
  // ========== 定时任务关联 (可选) ==========
  
  /// 定时任务 ID (如果是定时触发)
  scheduleId          String?   @map("schedule_id")
  
  /// 调度记录 ID (如果是定时触发)
  scheduleRecordId    String?   @map("schedule_record_id")
  
  /// 触发类型 (manual, scheduled, api)
  triggerType         String    @default("manual") @map("trigger_type")
  
  // ... 现有字段继续 ...
  
  @@index([scheduleId, createdAt])
  @@index([triggerType, createdAt])
}

5.4 扩展 SubscriptionPlan 表 

model SubscriptionPlan {
  // ... 现有字段 ...
  
  /// Maximum number of workflow schedules
  maxSchedules        Int       @default(1) @map("max_schedules")
  
  /// Default execution priority (1-5)
  defaultPriority     Int       @default(5) @map("default_priority")
  
  // ... 其他字段 ...
}

5.5 套餐配置映射

Plan Type
maxSchedules
defaultPriority
free
1
5
starter
5
4
plus (早鸟)
20
3
maker
20
2
pro
20
2
enterprise
20
1

可以使用环境变量覆盖默认配置

5.6 快照数据结构（MinIO 存储）

interface WorkflowSnapshot {
  // 元数据
  snapshotId: string;
  executionId: string;
  canvasId: string;
  uid: string;
  createdAt: string;
  snapshotVersion: string; // "1.0"
  
  // 触发信息
  triggerType: 'manual' | 'scheduled' | 'webhook';
  scheduleId?: string;
  priority?: number;  // 【新增】执行优先级
  
  // 工作流完整数据（实时获取）
  workflowData: {
    title: string;
    nodes: CanvasNode[];
    edges: CanvasEdge[];
    variables: WorkflowVariable[];
    files: DriveFile[];
    resources: Resource[];
  };
  
  // 统计信息
  statistics: {
    totalNodes: number;
    totalEdges: number;
    totalVariables: number;
  };
}


---

六、核心代码实现

6.1 SchedulePriorityService (优先级计算)【新增】

// apps/api/src/modules/schedule/schedule-priority.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ConfigService } from '@nestjs/config';
import { safeParseJSON } from '@refly/utils';

/**
 * Plan type to priority mapping
 * BullMQ priority: lower value = higher priority
 */
const PLAN_PRIORITY_MAP: Record<string, number> = {
  enterprise: 1,
  pro: 2,
  maker: 2,
  plus: 3,
  starter: 4,
  free: 5,
};

interface PriorityFactors {
  consecutiveFailures: number;
  activeScheduleCount: number;
  isEarlyBird: boolean;
  creditRatio: number;
}

@Injectable()
export class SchedulePriorityService {
  private readonly logger = new Logger(SchedulePriorityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Calculate user's execution priority
   * 
   * @param uid - User ID
   * @returns Priority value (1-10, lower is higher priority)
   */
  async calculateExecutionPriority(uid: string): Promise<number> {
    try {
      // 1. Get user's current subscription
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          uid,
          status: 'active',
          OR: [
            { cancelAt: null },
            { cancelAt: { gt: new Date() } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });

      // 2. Get base priority from plan type
      const planType = subscription?.planType ?? 'free';
      let basePriority = PLAN_PRIORITY_MAP[planType] ?? PLAN_PRIORITY_MAP.free;

      // 3. Get priority adjustment factors
      const factors = await this.getPriorityFactors(uid, subscription);

      // 4. Apply priority adjustments
      const adjustedPriority = this.applyPriorityAdjustments(basePriority, factors);

      // 5. Ensure priority is within valid range (1-10)
      const finalPriority = Math.max(1, Math.min(10, adjustedPriority));

      this.logger.debug(
        `Priority calculated for user ${uid}: base=${basePriority}, adjusted=${finalPriority}, factors=${JSON.stringify(factors)}`
      );

      return finalPriority;
    } catch (error) {
      this.logger.error(`Failed to calculate priority for user ${uid}: ${error.message}`);
      // Return default priority on error
      return PLAN_PRIORITY_MAP.free;
    }
  }

  /**
   * Get priority adjustment factors
   */
  private async getPriorityFactors(
    uid: string,
    subscription: any,
  ): Promise<PriorityFactors> {
    const [failureCount, activeCount, creditRatio] = await Promise.all([
      this.getConsecutiveFailureCount(uid),
      this.getActiveScheduleCount(uid),
      this.getCreditBalanceRatio(uid),
    ]);

    const isEarlyBird = this.checkIsEarlyBird(subscription);

    return {
      consecutiveFailures: failureCount,
      activeScheduleCount: activeCount,
      isEarlyBird,
      creditRatio,
    };
  }

  /**
   * Apply priority adjustments based on factors
   */
  private applyPriorityAdjustments(
    basePriority: number,
    factors: PriorityFactors,
  ): number {
    let priority = basePriority;

    // Adjustment 1: Early bird bonus
    const earlyBirdBonus = this.config.get<number>('schedule.priority.earlyBirdBonus') ?? 0.5;
    if (factors.isEarlyBird) {
      priority -= earlyBirdBonus;
    }

    // Adjustment 2: Consecutive failure penalty
    const failurePenalty = this.config.get<number>('schedule.priority.failurePenalty') ?? 0.2;
    const maxFailurePenalty = 1;
    priority += Math.min(factors.consecutiveFailures * failurePenalty, maxFailurePenalty);

    // Adjustment 3: Low credit warning
    const lowCreditPenalty = this.config.get<number>('schedule.priority.lowCreditPenalty') ?? 0.5;
    if (factors.creditRatio < 0.1) {
      priority += lowCreditPenalty;
    }

    // Adjustment 4: High active schedule count
    if (factors.activeScheduleCount > 10) {
      priority += 0.2;
    }

    return Math.round(priority * 10) / 10;
  }

  /**
   * Get consecutive failure count in last 24 hours
   */
  private async getConsecutiveFailureCount(uid: string): Promise<number> {
    const recentRecords = await this.prisma.scheduleRecord.findMany({
      where: {
        uid,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { status: true },
    });

    let consecutiveFailures = 0;
    for (const record of recentRecords) {
      if (record.status === 'failed') {
        consecutiveFailures++;
      } else if (record.status === 'success') {
        break;
      }
    }

    return consecutiveFailures;
  }

  /**
   * Get active schedule count
   */
  private async getActiveScheduleCount(uid: string): Promise<number> {
    return this.prisma.workflowSchedule.count({
      where: {
        uid,
        isEnabled: true,
        deletedAt: null,
      },
    });
  }

  /**
   * Check if user is early bird
   */
  private checkIsEarlyBird(subscription: any): boolean {
    if (subscription?.overridePlan) {
      const overridePlan = safeParseJSON(subscription.overridePlan);
      return Boolean(overridePlan?.isEarlyBird);
    }
    return false;
  }

  /**
   * Get credit balance ratio
   */
  private async getCreditBalanceRatio(uid: string): Promise<number> {
    const creditAccount = await this.prisma.creditAccount.findFirst({
      where: { uid },
    });

    const currentBalance = creditAccount?.balance ?? 0;
    // Use a default quota for calculation
    const defaultQuota = 1000;

    return defaultQuota > 0 ? currentBalance / defaultQuota : 0;
  }
}

6.2 ScheduleService (调度管理)

// apps/api/src/modules/schedule/schedule.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { User } from '@prisma/client';
import { genScheduleId } from '@refly/utils';
import { convertToCronExpression, calculateNextRunTime } from './schedule.utils';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a scheduled task
   */
  async createSchedule(user: User, dto: CreateScheduleDto) {
    // 1. Validate schedule quota
    await this.validateScheduleQuota(user);
    
    // 2. Verify canvas exists
    const canvas = await this.prisma.canvas.findFirst({
      where: {
        canvasId: dto.canvasId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!canvas) {
      throw new Error('Canvas not found');
    }
    
    // 3. Convert to cron expression
    const cronExpression = convertToCronExpression(dto.scheduleConfig);
    
    // 4. Calculate next run time
    const scheduleId = genScheduleId();
    const nextRunAt = dto.isEnabled
      ? calculateNextRunTime(cronExpression, dto.timezone)
      : null;
    
    // 5. Create database record
    const schedule = await this.prisma.workflowSchedule.create({
      data: {
        scheduleId,
        uid: user.uid,
        canvasId: dto.canvasId,
        name: dto.name,
        isEnabled: dto.isEnabled ?? false,
        cronExpression,
        scheduleConfig: JSON.stringify(dto.scheduleConfig),
        timezone: dto.timezone,
        nextRunAt,
      },
    });
    
    this.logger.log(`Schedule created: ${scheduleId}, next run: ${nextRunAt}`);
    
    return {
      ...schedule,
      scheduleConfig: JSON.parse(schedule.scheduleConfig),
    };
  }

  /**
   * Update a scheduled task
   */
  async updateSchedule(user: User, dto: UpdateScheduleDto) {
    const schedule = await this.prisma.workflowSchedule.findFirst({
      where: {
        scheduleId: dto.scheduleId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    // Recalculate cron expression and next run time
    let cronExpression = schedule.cronExpression;
    let nextRunAt = schedule.nextRunAt;

    if (dto.scheduleConfig) {
      cronExpression = convertToCronExpression(dto.scheduleConfig);
      nextRunAt = dto.isEnabled !== false
        ? calculateNextRunTime(cronExpression, dto.timezone || schedule.timezone)
        : null;
    } else if (dto.isEnabled !== undefined) {
      nextRunAt = dto.isEnabled
        ? calculateNextRunTime(cronExpression, schedule.timezone)
        : null;
    }

    const updated = await this.prisma.workflowSchedule.update({
      where: { scheduleId: dto.scheduleId },
      data: {
        name: dto.name,
        isEnabled: dto.isEnabled,
        cronExpression,
        scheduleConfig: dto.scheduleConfig ? JSON.stringify(dto.scheduleConfig) : undefined,
        timezone: dto.timezone,
        nextRunAt,
      },
    });

    return {
      ...updated,
      scheduleConfig: JSON.parse(updated.scheduleConfig),
    };
  }

  /**
   * Delete a scheduled task (soft delete)
   */
  async deleteSchedule(user: User, dto: DeleteScheduleDto) {
    const schedule = await this.prisma.workflowSchedule.findFirst({
      where: {
        scheduleId: dto.scheduleId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    await this.prisma.workflowSchedule.update({
      where: { scheduleId: dto.scheduleId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Schedule deleted: ${dto.scheduleId}`);
  }

  /**
   * Get schedule detail
   */
  async getSchedule(user: User, dto: GetScheduleDto) {
    const schedule = await this.prisma.workflowSchedule.findFirst({
      where: {
        scheduleId: dto.scheduleId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    return {
      ...schedule,
      scheduleConfig: JSON.parse(schedule.scheduleConfig),
    };
  }

  /**
   * List scheduled tasks
   */
  async listSchedules(
    user: User,
    query: { page: number; pageSize: number; canvasId?: string }
  ) {
    const { page, pageSize, canvasId } = query;

    const schedules = await this.prisma.workflowSchedule.findMany({
      where: {
        uid: user.uid,
        deletedAt: null,
        canvasId: canvasId || undefined,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const total = await this.prisma.workflowSchedule.count({
      where: {
        uid: user.uid,
        deletedAt: null,
        canvasId: canvasId || undefined,
      },
    });

    const schedulesWithParsedConfig = schedules.map((schedule) => ({
      ...schedule,
      scheduleConfig: JSON.parse(schedule.scheduleConfig),
    }));

    return {
      schedules: schedulesWithParsedConfig,
      total,
      page,
      pageSize,
    };
  }

  /**
   * Get execution records
   */
  async getScheduleRecords(
    user: User,
    dto: GetScheduleRecordsDto
  ) {
    const { scheduleId, page, pageSize, status } = dto;

    // Verify schedule ownership
    const schedule = await this.prisma.workflowSchedule.findFirst({
      where: {
        scheduleId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    // Query execution records
    const records = await this.prisma.scheduleRecord.findMany({
      where: {
        scheduleId,
        uid: user.uid,
        status: status || undefined,
      },
      orderBy: {
        scheduledAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const total = await this.prisma.scheduleRecord.count({
      where: {
        scheduleId,
        uid: user.uid,
        status: status || undefined,
      },
    });

    const recordsWithParsedTools = records.map((record) => ({
      ...record,
      usedTools: record.usedTools ? JSON.parse(record.usedTools) : [],
    }));

    return {
      records: recordsWithParsedTools,
      total,
      page,
      pageSize,
    };
  }

  /**
   * Validate user's schedule quota
   */
  private async validateScheduleQuota(user: User) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { uid: user.uid, status: 'active' },
    });
    
    // Get max schedules from plan or config
    const planType = subscription?.planType ?? 'free';
    const maxSchedulesMap: Record<string, number> = {
      free: 1,
      starter: 5,
      plus: 20,
      maker: 20,
      pro: 50,
      enterprise: 100,
    };
    const maxSchedules = maxSchedulesMap[planType] ?? 1;
    
    const activeCount = await this.prisma.workflowSchedule.count({
      where: {
        uid: user.uid,
        isEnabled: true,
        deletedAt: null,
      },
    });
    
    if (activeCount >= maxSchedules) {
      throw new Error(
        `Schedule quota exceeded. Max: ${maxSchedules}, Current: ${activeCount}`
      );
    }
  }
}

6.3 ScheduleCronService (定时扫描)

// apps/api/src/modules/schedule/schedule-cron.service.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { SchedulePriorityService } from './schedule-priority.service';
import { QUEUE_SCHEDULE_EXECUTION } from './schedule.constants';
import { calculateNextRunTime } from './schedule.utils';

@Injectable()
export class ScheduleCronService implements OnModuleInit {
  private readonly logger = new Logger(ScheduleCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly priorityService: SchedulePriorityService,
    @InjectQueue(QUEUE_SCHEDULE_EXECUTION)
    private readonly scheduleQueue: Queue,
  ) {}

  /**
   * Module initialization: set up scheduled scan job
   */
  async onModuleInit() {
    await this.setupScheduleScanJob();
  }

  /**
   * Set up scheduled scan job (runs every minute)
   */
  private async setupScheduleScanJob() {
    const existingJobs = await this.scheduleQueue.getJobSchedulers();
    await Promise.all(
      existingJobs.map((job) => this.scheduleQueue.removeJobScheduler(job.id)),
    );

    await this.scheduleQueue.add(
      'scan-schedules',
      {},
      {
        repeat: {
          pattern: '* * * * *', // Every minute
        },
        jobId: 'schedule-scanner',
        removeOnComplete: true,
        removeOnFail: true,
      },
    );

    this.logger.log('Schedule scanner job initialized');
  }

  /**
   * Scan and trigger due scheduled tasks
   */
  async scanAndTriggerSchedules() {
    // 1. Acquire distributed lock
    const lockKey = 'schedule:scanner:lock';
    const releaseLock = await this.redis.acquireLock(lockKey, 50 * 1000);
    
    if (!releaseLock) {
      this.logger.debug('Another scanner is running, skipping');
      return;
    }

    try {
      const now = new Date();
      
      // 2. Query due tasks
      const dueSchedules = await this.prisma.workflowSchedule.findMany({
        where: {
          isEnabled: true,
          deletedAt: null,
          nextRunAt: {
            lte: now,
          },
        },
        take: 100,
      });

      this.logger.log(`Found ${dueSchedules.length} due schedules`);

      // 3. Process each due task
      for (const schedule of dueSchedules) {
        try {
          // 3.1 Calculate next run time
          const nextRunAt = calculateNextRunTime(
            schedule.cronExpression,
            schedule.timezone,
          );

          // 3.2 Use optimistic lock to update nextRunAt
          const updateResult = await this.prisma.workflowSchedule.updateMany({
            where: {
              scheduleId: schedule.scheduleId,
              updatedAt: schedule.updatedAt, // Optimistic lock condition
            },
            data: {
              nextRunAt,
              updatedAt: new Date(),
            },
          });

          // 3.3 Check update result
          if (updateResult.count === 0) {
            this.logger.warn(
              `Schedule ${schedule.scheduleId} was updated by another instance, skipping`
            );
            continue;
          }

          // 3.4 【NEW】Calculate user execution priority
          const priority = await this.priorityService.calculateExecutionPriority(
            schedule.uid
          );

          // 3.5 Push to execution queue with priority
          const timestamp = Date.now();
          await this.scheduleQueue.add(
            'execute-scheduled-workflow',
            {
              scheduleId: schedule.scheduleId,
              canvasId: schedule.canvasId,
              uid: schedule.uid,
              scheduledAt: schedule.nextRunAt!.toISOString(),
              priority, // Include priority in job data
            },
            {
              jobId: `schedule:${schedule.scheduleId}:${timestamp}`,
              priority: Math.floor(priority), // BullMQ priority
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 1000,
              },
            },
          );

          this.logger.log(
            `Triggered schedule: ${schedule.scheduleId}, priority: ${priority}, next run: ${nextRunAt}`
          );
        } catch (error) {
          this.logger.error(
            `Failed to trigger schedule ${schedule.scheduleId}: ${error.message}`
          );
        }
      }
    } finally {
      await releaseLock();
    }
  }
}

6.4 ScheduleProcessor (任务执行)

// apps/api/src/modules/schedule/schedule.processor.ts

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../common/prisma.service';
import { CanvasService } from '../canvas/canvas.service';
import { MiscService } from '../misc/misc.service';
import { WorkflowService } from '../workflow/workflow.service';
import { CreditService } from '../credit/credit.service';
import { RedisService } from '../common/redis.service';
import { QUEUE_SCHEDULE_EXECUTION } from './schedule.constants';
import { genScheduleRecordId } from '@refly/utils';

interface ScheduledWorkflowJobData {
  scheduleId: string;
  canvasId: string;
  uid: string;
  scheduledAt: string;
  priority: number;
}

@Processor(QUEUE_SCHEDULE_EXECUTION, {
  concurrency: 10,
})
export class ScheduleProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduleProcessor.name);

  // Global concurrency limit
  private readonly MAX_CONCURRENT = 50;
  private readonly CONCURRENT_KEY = 'workflow:execution:concurrent';

  constructor(
    private readonly prisma: PrismaService,
    private readonly canvasService: CanvasService,
    private readonly miscService: MiscService,
    private readonly workflowService: WorkflowService,
    private readonly creditService: CreditService,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async process(job: Job<ScheduledWorkflowJobData>) {
    const { scheduleId, canvasId, uid, scheduledAt, priority } = job.data;
    let shouldDecrementCounter = false;
    let scheduleRecordId: string | null = null;
    
    try {
      const user = { uid } as any;

      // ========== 1. Rate limiting check ==========
      const canExecute = await this.checkAndIncrementConcurrent();
      if (!canExecute) {
        this.logger.warn('Concurrent limit reached, will retry later');
        throw new Error('RATE_LIMITED');
      }
      shouldDecrementCounter = true;

      // ========== 2. Create ScheduleRecord ==========
      scheduleRecordId = genScheduleRecordId();
      await this.prisma.scheduleRecord.create({
        data: {
          scheduleRecordId,
          scheduleId,
          uid,
          canvasId,
          workflowTitle: '', // Will be updated later
          scheduledAt: new Date(scheduledAt),
          status: 'pending',
          priority, // Store priority
        },
      });

      // ========== 3. Full validation ==========
      
      // 3.1 Quota validation
      await this.validateScheduleQuota(user);

      // 3.2 Credit balance check
      const creditCheck = await this.creditService.checkRequestCreditUsage(user, {
        minCharge: 10,
      });

      if (!creditCheck.canUse) {
        await this.handleInsufficientCredits(scheduleId, scheduleRecordId);
        return;
      }

      // 3.3 Get latest workflow structure
      const canvasData = await this.canvasService.getCanvasRawData(user, canvasId, {
        checkOwnership: true,
      });

      // 3.4 Tool availability check
      await this.validateToolAvailability(canvasData);

      // 3.5 Required inputs validation
      await this.validateRequiredInputs(canvasData);

      // ========== 4. Extract tool list ==========
      const usedTools = this.extractUsedTools(canvasData.nodes);

      // ========== 5. Update ScheduleRecord ==========
      await this.prisma.scheduleRecord.update({
        where: { scheduleRecordId },
        data: {
          workflowTitle: canvasData.title,
          usedTools: JSON.stringify(usedTools),
          status: 'running',
        },
      });

      // ========== 6. Generate snapshot ==========
      const snapshot = {
        scheduleRecordId,
        scheduleId,
        canvasId,
        priority,
        workflowData: {
          nodes: canvasData.nodes,
          edges: canvasData.edges,
          files: canvasData.files || [],
          resources: canvasData.resources || [],
          variables: canvasData.variables || [],
          title: canvasData.title,
        },
        createdAt: new Date().toISOString(),
        snapshotVersion: '1.0',
      };

      // 6.1 Upload snapshot to MinIO
      const { storageKey: snapshotStorageKey } = await this.miscService.uploadBuffer(user, {
        fpath: 'workflow-snapshot.json',
        buf: Buffer.from(JSON.stringify(snapshot)),
        entityId: scheduleRecordId,
        entityType: 'scheduleRecord',
        visibility: 'private',
        storageKey: `workflow-snapshots/${scheduleRecordId}.json`,
      });

      // ========== 7. Execute workflow ==========
      const executionResult = await this.workflowService.executeWorkflow(user, {
        canvasData: snapshot.workflowData,
        triggerSource: 'scheduled',
        scheduleId,
        scheduleRecordId,
      });

      // ========== 8. Update execution result ==========
      await this.prisma.scheduleRecord.update({
        where: { scheduleRecordId },
        data: {
          workflowExecutionId: executionResult.executionId,
          status: 'success',
          creditUsed: executionResult.creditUsed || 0,
          completedAt: new Date(),
          snapshotStorageKey,
        },
      });

      // ========== 9. Update Schedule status ==========
      await this.prisma.workflowSchedule.update({
        where: { scheduleId },
        data: { lastRunAt: new Date() },
      });

      this.logger.log(
        `Schedule executed successfully: ${scheduleRecordId}, priority: ${priority}`
      );
    } catch (error) {
      this.logger.error(`Failed to execute schedule: ${error.message}`);
      
      // Handle rate limiting error (trigger retry)
      if (error.message === 'RATE_LIMITED') {
        throw error;
      }
      
      // Other errors: update failed status
      if (scheduleRecordId) {
        await this.prisma.scheduleRecord.update({
          where: { scheduleRecordId },
          data: {
            status: 'failed',
            failureReason: error.message,
            errorDetails: JSON.stringify({
              message: error.message,
              stack: error.stack,
            }),
          },
        });
      }
    } finally {
      // Decrement concurrent counter
      if (shouldDecrementCounter) {
        await this.decrementConcurrent();
      }
    }
  }

  /**
   * Extract used tools from nodes
   */
  private extractUsedTools(nodes: any[]): string[] {
    const toolNodes = nodes?.filter((n) => n.type === 'tool') ?? [];
    const toolIds = toolNodes.map((n) => n.metadata?.toolId || n.metadata?.toolName);
    return [...new Set(toolIds.filter(Boolean))];
  }

  /**
   * Validate schedule quota
   */
  private async validateScheduleQuota(user: any) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { uid: user.uid, status: 'active' },
    });
    
    const planType = subscription?.planType ?? 'free';
    const maxSchedulesMap: Record<string, number> = {
      free: 1,
      starter: 5,
      plus: 20,
      maker: 20,
      pro: 50,
      enterprise: 100,
    };
    const maxSchedules = maxSchedulesMap[planType] ?? 1;
    
    const activeCount = await this.prisma.workflowSchedule.count({
      where: {
        uid: user.uid,
        isEnabled: true,
        deletedAt: null,
      },
    });
    
    if (activeCount > maxSchedules) {
      throw new Error('Schedule quota exceeded');
    }
  }

  /**
   * Validate tool availability
   */
  private async validateToolAvailability(canvasData: any) {
    // TODO: Check OAuth status
  }

  /**
   * Validate required inputs
   */
  private async validateRequiredInputs(canvasData: any) {
    const requiredVariables = canvasData.variables?.filter((v: any) => v.required) ?? [];
    const missingVariables = requiredVariables.filter((v: any) => !v.value);
    
    if (missingVariables.length > 0) {
      throw new Error(
        `Missing required inputs: ${missingVariables.map((v: any) => v.name).join(', ')}`
      );
    }
  }

  /**
   * Handle insufficient credits
   */
  private async handleInsufficientCredits(scheduleId: string, scheduleRecordId: string) {
    // Disable schedule
    await this.prisma.workflowSchedule.update({
      where: { scheduleId },
      data: { isEnabled: false },
    });

    // Update schedule record
    await this.prisma.scheduleRecord.update({
      where: { scheduleRecordId },
      data: {
        status: 'failed',
        failureReason: 'INSUFFICIENT_CREDITS',
      },
    });

    this.logger.warn(`Schedule ${scheduleId} disabled due to insufficient credits`);
  }

  /**
   * Check concurrent limit and increment counter
   */
  private async checkAndIncrementConcurrent(): Promise<boolean> {
    const currentCount = await this.redis.client.get(this.CONCURRENT_KEY);
    const count = parseInt(currentCount || '0', 10);

    if (count >= this.MAX_CONCURRENT) {
      return false;
    }

    await this.redis.client.incr(this.CONCURRENT_KEY);
    return true;
  }

  /**
   * Decrement concurrent counter
   */
  private async decrementConcurrent() {
    await this.redis.client.decr(this.CONCURRENT_KEY);
  }
}


---

七、前后端交互设计【修改：不使用路由参数】

7.1 API 端点

接口
方法
路径
功能
创建定时任务
POST
/v1/schedule/create
创建新的定时任务
更新定时任务
POST
/v1/schedule/update
更新任务配置
获取任务列表
GET
/v1/schedule/list
查询用户的定时任务
获取任务详情
GET
/v1/schedule/detail
获取单个任务详情
获取执行记录
GET
/v1/schedule/records
查询执行历史
删除任务
POST
/v1/schedule/delete
软删除任务



// apps/api/src/modules/schedule/schedule.dto.ts

import { IsString, IsBoolean, IsOptional, IsNumber, IsObject, Min } from 'class-validator';

// ========== Request DTOs ==========

export class CreateScheduleDto {
  @IsString()
  canvasId: string;

  @IsString()
  name: string;

  @IsObject()
  scheduleConfig: {
    type: 'daily' | 'weekly' | 'monthly';
    time: string; // "08:00"
    weekdays?: number[]; // [1, 2, 5] for Monday, Tuesday, Friday
    monthDays?: number[]; // [1, 15] for 1st and 15th
  };

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}

export class UpdateScheduleDto {
  @IsString()
  scheduleId: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsObject()
  @IsOptional()
  scheduleConfig?: {
    type: 'daily' | 'weekly' | 'monthly';
    time: string;
    weekdays?: number[];
    monthDays?: number[];
  };

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}

export class DeleteScheduleDto {
  @IsString()
  scheduleId: string;
}

export class GetScheduleDto {
  @IsString()
  scheduleId: string;
}

export class ListSchedulesDto {
  @IsString()
  @IsOptional()
  canvasId?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  pageSize?: number;
}

export class GetScheduleRecordsDto {
  @IsString()
  scheduleId: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  pageSize?: number;

  @IsString()
  @IsOptional()
  status?: string;
}

7.2 ScheduleController

// apps/api/src/modules/schedule/schedule.controller.ts

import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '@prisma/client';
import { ScheduleService } from './schedule.service';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  DeleteScheduleDto,
  GetScheduleDto,
  ListSchedulesDto,
  GetScheduleRecordsDto,
} from './schedule.dto';

@Controller('v1/schedule')
@UseGuards(JwtAuthGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  /**
   * Create a scheduled task
   * POST /v1/schedule/create
   */
  @Post('create')
  async createSchedule(
    @CurrentUser() user: User,
    @Body() dto: CreateScheduleDto,
  ) {
    const schedule = await this.scheduleService.createSchedule(user, dto);
    return { code: 0, data: schedule };
  }

  /**
   * Update a scheduled task
   * POST /v1/schedule/update
   */
  @Post('update')
  async updateSchedule(
    @CurrentUser() user: User,
    @Body() dto: UpdateScheduleDto,
  ) {
    const schedule = await this.scheduleService.updateSchedule(user, dto);
    return { code: 0, data: schedule };
  }

  /**
   * Delete a scheduled task
   * POST /v1/schedule/delete
   */
  @Post('delete')
  async deleteSchedule(
    @CurrentUser() user: User,
    @Body() dto: DeleteScheduleDto,
  ) {
    await this.scheduleService.deleteSchedule(user, dto);
    return { code: 0, data: { success: true } };
  }

  /**
   * Get schedule detail
   * POST /v1/schedule/detail
   */
  @Post('detail')
  async getSchedule(
    @CurrentUser() user: User,
    @Body() dto: GetScheduleDto,
  ) {
    const schedule = await this.scheduleService.getSchedule(user, dto);
    return { code: 0, data: schedule };
  }

  /**
   * List scheduled tasks
   * POST /v1/schedule/list
   */
  @Post('list')
  async listSchedules(
    @CurrentUser() user: User,
    @Body() dto: ListSchedulesDto,
  ) {
    const result = await this.scheduleService.listSchedules(user, {
      canvasId: dto.canvasId,
      page: dto.page ?? 1,
      pageSize: dto.pageSize ?? 20,
    });
    return { code: 0, data: result };
  }

  /**
   * Get execution records
   * POST /v1/schedule/records
   */
  @Post('records')
  async getScheduleRecords(
    @CurrentUser() user: User,
    @Body() dto: GetScheduleRecordsDto,
  ) {
    const result = await this.scheduleService.getScheduleRecords(user, {
      scheduleId: dto.scheduleId,
      page: dto.page ?? 1,
      pageSize: dto.pageSize ?? 20,
      status: dto.status,
    });
    return { code: 0, data: result };
  }
}

7.3 前端请求示例

创建定时任务

// Frontend code
const createSchedule = async () => {
  const response = await fetch('/v1/schedule/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      canvasId: 'canvas-123',
      name: 'Daily Email Digest',
      scheduleConfig: {
        type: 'daily',
        time: '08:00',
      },
      timezone: 'Asia/Shanghai',
      isEnabled: true,
    }),
  });

  const result = await response.json();
  console.log(result.data);
};

更新定时任务

const updateSchedule = async () => {
  const response = await fetch('/v1/schedule/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      scheduleId: 'sch-456',
      name: 'Updated Task Name',
      isEnabled: false,
    }),
  });

  const result = await response.json();
  console.log(result.data);
};

获取执行记录

const getRunHistory = async () => {
  const response = await fetch('/v1/schedule/records', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      scheduleId: 'sch-456',
      page: 1,
      pageSize: 20,
      status: 'success', // optional filter
    }),
  });

  const result = await response.json();
  
  // Render table
  result.data.records.forEach((record) => {
    console.log({
      title: record.workflowTitle,
      time: record.scheduledAt,
      tools: record.usedTools, // ["notion", "slack"]
      state: record.status,
      cost: record.creditUsed,
      priority: record.priority,
    });
  });
};

删除定时任务

const deleteSchedule = async () => {
  const response = await fetch('/v1/schedule/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      scheduleId: 'sch-456',
    }),
  });

  const result = await response.json();
  console.log(result.data.success);
};


---

八、邮件通知集成

8.1 邮件模板定义

// notification/email-templates.ts

export const EMAIL_TEMPLATES = {
  // Quota exceeded
  'schedule-limit-exceeded': {
    subject: 'Your scheduled workflow has been paused',
    template: 'schedule-limit-exceeded.html',
  },
  
  // Insufficient credits
  'schedule-insufficient-credits': {
    subject: "Your scheduled workflow couldn't run due to insufficient credits",
    template: 'schedule-insufficient-credits.html',
  },
  
  // Run success
  'schedule-run-success': {
    subject: 'Scheduled workflow succeeded successfully',
    template: 'schedule-run-success.html',
  },
  
  // Run failed
  'schedule-run-failed': {
    subject: 'Scheduled workflow failed to run',
    template: 'schedule-run-failed.html',
  },
};

8.2 邮件服务调用示例

// Using existing NotificationService
await this.notificationService.sendEmail({
  to: uid,
  template: 'schedule-run-success',
  data: {
    userName: user.name,
    scheduleName: schedule.name,
    runTime: new Date().toISOString(),
    nextRunTime: schedule.nextRunAt.toISOString(),
    priority: priority,
    runDetailsLink: `${baseUrl}/workspace/run-history/${executionId}`,
  },
});


---

九、数据流图



前端创建定时任务
    │
    ├─ POST /v1/schedule/create
    │  └─ { canvasId, name, scheduleConfig, timezone, isEnabled }
    │
    ▼
ScheduleController
    │
    ├─ ScheduleService.createSchedule()
    │  ├─ 校验配额
    │  ├─ 转换 cron 表达式
    │  ├─ 计算 nextRunAt
    │  └─ 插入 workflow_schedules 表
    │
    ▼
定时扫描 (每分钟)
    │
    ├─ ScheduleCronService.scanAndTrigger()
    │  ├─ 查询到期任务
    │  ├─ 乐观锁更新 nextRunAt
    │  ├─ 【新增】计算用户优先级
    │  │  └─ SchedulePriorityService.calculateExecutionPriority()
    │  └─ 推入 BullMQ 队列 (带优先级)
    │
    ▼
队列消费 (按优先级顺序)
    │
    ├─ ScheduleProcessor.process()
    │  ├─ 限流检查
    │  ├─ 创建 ScheduleRecord (pending, 含 priority)
    │  ├─ 完整校验
    │  ├─ 获取最新工作流结构
    │  ├─ 提取工具列表
    │  ├─ 更新 ScheduleRecord (running)
    │  ├─ 生成快照 → MinIO
    │  ├─ 执行工作流
    │  ├─ 更新 ScheduleRecord (success/failed)
    │  └─ 更新 Schedule.lastRunAt
    │
    ▼
前端查询执行记录
    │
    ├─ POST /v1/schedule/records
    │  └─ { scheduleId, page, pageSize, status }
    │
    ▼
ScheduleController
    │
    ├─ ScheduleService.getScheduleRecords()
    │  └─ 查询 schedule_records 表
    │
    ▼
返回前端
    │
    └─ { records: [{ workflowTitle, scheduledAt, usedTools, status, creditUsed, priority }] }


