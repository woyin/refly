import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateScheduleDto, UpdateScheduleDto } from './schedule.dto';
import { genScheduleId, genScheduleRecordId } from '@refly/utils';
import { CronExpressionParser } from 'cron-parser';
import { ObjectStorageService } from '../common/object-storage';
import { OSS_INTERNAL } from '../common/object-storage/tokens';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  QUEUE_SCHEDULE_EXECUTION,
  SCHEDULE_JOB_OPTIONS,
  getScheduleQuota,
  ScheduleFailureReason,
} from './schedule.constants';
import { SchedulePriorityService } from './schedule-priority.service';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(OSS_INTERNAL) private readonly oss: ObjectStorageService,
    @InjectQueue(QUEUE_SCHEDULE_EXECUTION) private readonly scheduleQueue: Queue,
    private readonly priorityService: SchedulePriorityService,
  ) {}

  // Helper to remove BigInt pk field from schedule objects
  private excludePk<T extends { pk?: bigint }>(obj: T): Omit<T, 'pk'> {
    const { pk, ...result } = obj;
    return result;
  }

  /**
   * Validate cron expression
   * @param cronExpression Cron expression string
   * @param timezone Optional timezone
   * @throws BadRequestException if invalid
   */
  private validateCronExpression(cronExpression: string, timezone?: string): void {
    try {
      CronExpressionParser.parse(cronExpression, timezone ? { tz: timezone } : undefined);
    } catch {
      throw new BadRequestException(ScheduleFailureReason.INVALID_CRON_EXPRESSION);
    }
  }

  /**
   * Validate canvas exists and belongs to user
   * @param uid User ID
   * @param canvasId Canvas ID
   * @throws NotFoundException if canvas not found or doesn't belong to user
   */
  private async validateCanvas(uid: string, canvasId: string): Promise<void> {
    const canvas = await this.prisma.canvas.findUnique({
      where: { canvasId },
      select: { uid: true },
    });

    if (!canvas) {
      throw new NotFoundException(ScheduleFailureReason.CANVAS_DATA_ERROR);
    }

    if (canvas.uid !== uid) {
      throw new NotFoundException(ScheduleFailureReason.CANVAS_DATA_ERROR);
    }
  }

  /**
   * Check if user has quota to enable a schedule
   * @param uid User ID
   * @param excludeScheduleId Optional schedule ID to exclude from count (for update scenarios)
   * @throws BadRequestException if quota exceeded
   */
  private async checkScheduleQuota(uid: string, excludeScheduleId?: string): Promise<void> {
    const where: any = {
      uid,
      isEnabled: true,
      deletedAt: null,
    };

    // Exclude current schedule from count when updating
    if (excludeScheduleId) {
      where.scheduleId = { not: excludeScheduleId };
    }

    const activeSchedulesCount = await this.prisma.workflowSchedule.count({ where });

    // Check user subscription for quota
    const subscription = await this.prisma.subscription.findFirst({
      where: { uid, status: 'active' },
    });

    const maxSchedules = getScheduleQuota(subscription?.lookupKey);

    if (activeSchedulesCount >= maxSchedules) {
      throw new BadRequestException(ScheduleFailureReason.SCHEDULE_LIMIT_EXCEEDED);
    }
  }

  async createSchedule(uid: string, dto: CreateScheduleDto) {
    // 1. Validate Cron Expression
    this.validateCronExpression(dto.cronExpression, dto.timezone);

    // 2. Validate Canvas exists and belongs to user
    await this.validateCanvas(uid, dto.canvasId);

    // 3. Check if schedule already exists for this canvas
    const existingSchedule = await this.prisma.workflowSchedule.findFirst({
      where: { canvasId: dto.canvasId, uid, deletedAt: null },
    });

    if (existingSchedule) {
      // Update existing schedule instead of creating a new one
      return this.updateSchedule(uid, existingSchedule.scheduleId, {
        cronExpression: dto.cronExpression,
        scheduleConfig: dto.scheduleConfig,
        timezone: dto.timezone,
        isEnabled: dto.isEnabled,
      });
    }

    // 4. Check Plan Quota (only if enabling the schedule)
    const isEnabled = dto.isEnabled ?? false;
    if (isEnabled) {
      await this.checkScheduleQuota(uid);
    }

    // 5. Calculate next run time
    // Always calculate nextRunAt even if disabled, so it's ready when enabled
    let nextRunAt: Date | null = null;
    try {
      const interval = CronExpressionParser.parse(dto.cronExpression, {
        tz: dto.timezone || 'Asia/Shanghai',
      });
      nextRunAt = interval.next().toDate();
    } catch {
      throw new BadRequestException(ScheduleFailureReason.INVALID_CRON_EXPRESSION);
    }

    // 6. Get canvas title for default name if name not provided
    let scheduleName = dto.name;
    if (!scheduleName) {
      const canvas = await this.prisma.canvas.findUnique({
        where: { canvasId: dto.canvasId },
        select: { title: true },
      });
      scheduleName = canvas?.title || 'Scheduled Task';
    }

    // 7. Create Schedule
    const scheduleId = genScheduleId();
    const schedule = await this.prisma.workflowSchedule.create({
      data: {
        scheduleId,
        uid,
        canvasId: dto.canvasId,
        name: scheduleName,
        cronExpression: dto.cronExpression,
        scheduleConfig: dto.scheduleConfig,
        timezone: dto.timezone,
        isEnabled,
        // Only set nextRunAt if enabled, otherwise keep it calculated but null
        // This allows the schedule to be ready when enabled
        nextRunAt: isEnabled ? nextRunAt : null,
      },
    });

    // 8. Create scheduled record if enabled and has nextRunAt
    if (isEnabled && nextRunAt) {
      await this.createOrUpdateScheduledRecord(uid, scheduleId, dto.canvasId, nextRunAt);
    }

    // Remove pk field (BigInt) to avoid serialization issues
    return this.excludePk(schedule);
  }

  async updateSchedule(uid: string, scheduleId: string, dto: UpdateScheduleDto) {
    const schedule = await this.prisma.workflowSchedule.findUnique({
      where: { scheduleId },
    });

    if (!schedule || schedule.uid !== uid || schedule.deletedAt) {
      throw new NotFoundException('Schedule not found');
    }

    // 1. Validate cron expression if updated
    if (dto.cronExpression !== undefined) {
      this.validateCronExpression(dto.cronExpression, dto.timezone || schedule.timezone);
    }

    // 2. Check quota if enabling the schedule (from disabled to enabled)
    const isEnabled = dto.isEnabled !== undefined ? dto.isEnabled : schedule.isEnabled;
    if (schedule.isEnabled === false && isEnabled === true) {
      await this.checkScheduleQuota(uid, scheduleId);
    }

    // 3. Recalculate nextRunAt if any of these fields change: cronExpression, timezone, or isEnabled
    const cron = dto.cronExpression || schedule.cronExpression;
    const timezone = dto.timezone || schedule.timezone;

    let nextRunAt = schedule.nextRunAt;
    const shouldRecalculate =
      dto.cronExpression !== undefined ||
      dto.timezone !== undefined ||
      dto.isEnabled !== undefined ||
      (isEnabled && !nextRunAt); // Recalculate if enabling and nextRunAt is null

    if (shouldRecalculate) {
      if (isEnabled) {
        try {
          const interval = CronExpressionParser.parse(cron, { tz: timezone });
          nextRunAt = interval.next().toDate();
        } catch {
          throw new BadRequestException(ScheduleFailureReason.INVALID_CRON_EXPRESSION);
        }
      } else {
        // When disabled, keep nextRunAt as null
        nextRunAt = null;
      }
    }

    const updated = await this.prisma.workflowSchedule.update({
      where: { scheduleId },
      data: {
        ...dto,
        nextRunAt,
      },
    });

    // Update or create scheduled record if enabled and has nextRunAt
    if (isEnabled && nextRunAt) {
      await this.createOrUpdateScheduledRecord(uid, scheduleId, schedule.canvasId, nextRunAt);
    } else {
      // Delete scheduled record if disabled or no nextRunAt
      await this.deleteScheduledRecord(scheduleId);
    }

    return this.excludePk(updated);
  }

  async deleteSchedule(uid: string, scheduleId: string) {
    const schedule = await this.prisma.workflowSchedule.findUnique({
      where: { scheduleId },
    });

    if (!schedule || schedule.uid !== uid || schedule.deletedAt) {
      throw new NotFoundException('Schedule not found');
    }

    const deleted = await this.prisma.workflowSchedule.update({
      where: { scheduleId },
      data: {
        deletedAt: new Date(),
        isEnabled: false,
        nextRunAt: null,
      },
    });
    return this.excludePk(deleted);
  }

  async getSchedule(uid: string, scheduleId: string) {
    const schedule = await this.prisma.workflowSchedule.findUnique({
      where: { scheduleId },
    });

    if (!schedule || schedule.uid !== uid || schedule.deletedAt) {
      throw new NotFoundException('Schedule not found');
    }

    return this.excludePk(schedule);
  }

  async listSchedules(uid: string, canvasId?: string, page = 1, pageSize = 10) {
    const where = {
      uid,
      deletedAt: null,
      ...(canvasId ? { canvasId } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.workflowSchedule.count({ where }),
      this.prisma.workflowSchedule.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { total, page, pageSize, items: items.map((item) => this.excludePk(item)) };
  }

  async getScheduleRecords(uid: string, scheduleId: string, page = 1, pageSize = 10) {
    const where = {
      uid,
      scheduleId,
    };

    const [total, items] = await Promise.all([
      this.prisma.workflowScheduleRecord.count({ where }),
      this.prisma.workflowScheduleRecord.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { total, page, pageSize, items: items.map((item) => this.excludePk(item)) };
  }

  async listAllScheduleRecords(
    uid: string,
    page = 1,
    pageSize = 10,
    status?: 'scheduled' | 'pending' | 'processing' | 'running' | 'success' | 'failed' | 'skipped',
    keyword?: string,
    tools?: string[],
    canvasId?: string,
  ) {
    const where: any = { uid };

    // Filter by sourceCanvasId (the original canvas, not the cloned execution canvas)
    if (canvasId) {
      where.sourceCanvasId = canvasId;
    }

    // Filter by status - only show completed records (success/failed) by default
    if (status) {
      where.status = status;
    } else {
      // Default: only show success or failed records
      where.status = { in: ['success', 'failed'] };
    }

    // Filter by keyword (search in workflowTitle)
    if (keyword) {
      where.workflowTitle = {
        contains: keyword,
        mode: 'insensitive',
      };
    }

    // Filter by tools (usedTools contains any of the selected tools)
    if (tools && tools.length > 0) {
      where.OR = tools.map((tool) => ({
        usedTools: {
          contains: tool,
        },
      }));
    }

    const [total, items] = await Promise.all([
      this.prisma.workflowScheduleRecord.count({ where }),
      this.prisma.workflowScheduleRecord.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // Get unique scheduleIds and fetch schedule names
    const scheduleIds = [...new Set(items.map((item) => item.scheduleId))];
    const schedules = await this.prisma.workflowSchedule.findMany({
      where: { scheduleId: { in: scheduleIds } },
      select: { scheduleId: true, name: true },
    });
    const scheduleNameMap = new Map(schedules.map((s) => [s.scheduleId, s.name]));

    // Map items to include scheduleName and exclude pk
    const mappedItems = items.map((item) => {
      const { pk, ...rest } = item;
      return {
        ...rest,
        scheduleName: scheduleNameMap.get(item.scheduleId) || item.workflowTitle || 'Untitled',
        scheduleId: item.scheduleId, // Ensure scheduleId is included
      };
    });

    return { total, page, pageSize, items: mappedItems };
  }

  async getAvailableTools(uid: string) {
    // Get all unique tools used across all schedule records for this user
    const records = await this.prisma.workflowScheduleRecord.findMany({
      where: { uid },
      select: { usedTools: true },
    });

    const toolSet = new Set<string>();
    for (const record of records) {
      if (record.usedTools) {
        try {
          const tools = JSON.parse(record.usedTools) as string[];
          for (const tool of tools) {
            toolSet.add(tool);
          }
        } catch {
          // Invalid JSON, skip
        }
      }
    }

    return Array.from(toolSet).map((tool) => ({
      id: tool,
      name: tool,
    }));
  }

  async getScheduleRecordDetail(uid: string, scheduleRecordId: string) {
    const record = await this.prisma.workflowScheduleRecord.findUnique({
      where: { scheduleRecordId },
    });

    if (!record || record.uid !== uid) {
      throw new NotFoundException('Schedule record not found');
    }

    // Get schedule name
    const schedule = await this.prisma.workflowSchedule.findUnique({
      where: { scheduleId: record.scheduleId },
      select: { name: true },
    });

    const { pk, ...rest } = record;
    return {
      ...rest,
      scheduleName: schedule?.name || record.workflowTitle || 'Untitled',
    };
  }

  async getRecordSnapshot(uid: string, scheduleRecordId: string) {
    const record = await this.prisma.workflowScheduleRecord.findUnique({
      where: { scheduleRecordId },
    });

    if (!record || record.uid !== uid) {
      throw new NotFoundException('Schedule record not found');
    }

    if (!record.snapshotStorageKey) {
      throw new NotFoundException('Snapshot not found for this record');
    }

    const stream = await this.oss.getObject(record.snapshotStorageKey);
    if (!stream) {
      throw new NotFoundException('Snapshot data not found in storage');
    }

    // Read stream to string
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const content = Buffer.concat(chunks).toString('utf-8');

    try {
      return JSON.parse(content);
    } catch {
      throw new BadRequestException('Invalid snapshot data format');
    }
  }

  async triggerScheduleManually(uid: string, scheduleId: string) {
    // 1. Verify schedule exists and belongs to user
    const schedule = await this.prisma.workflowSchedule.findUnique({
      where: { scheduleId },
    });

    if (!schedule || schedule.uid !== uid || schedule.deletedAt) {
      throw new NotFoundException('Schedule not found');
    }

    // 2. Calculate user execution priority
    const priority = await this.priorityService.calculateExecutionPriority(uid);

    // 3. Get canvas title for workflowTitle
    const canvas = await this.prisma.canvas.findUnique({
      where: { canvasId: schedule.canvasId },
      select: { title: true },
    });

    // 4. Create WorkflowScheduleRecord with 'pending' status immediately
    // This ensures frontend can see the task is queued
    const timestamp = Date.now();
    const scheduledAt = new Date(); // Manual trigger uses current time
    const scheduleRecordId = genScheduleRecordId();

    await this.prisma.workflowScheduleRecord.create({
      data: {
        scheduleRecordId,
        scheduleId: schedule.scheduleId,
        uid,
        sourceCanvasId: schedule.canvasId, // Source canvas (template)
        canvasId: '', // Will be updated after execution with actual execution canvas
        workflowTitle: canvas?.title || 'Untitled',
        status: 'pending', // Job is queued, waiting to be processed
        scheduledAt,
        triggeredAt: scheduledAt,
        priority,
      },
    });

    // 5. Push to execution queue with priority
    await this.addToExecutionQueue(
      {
        scheduleId: schedule.scheduleId,
        canvasId: schedule.canvasId,
        uid: schedule.uid,
        scheduledAt: scheduledAt.toISOString(),
        priority,
        scheduleRecordId,
      },
      `schedule:${schedule.scheduleId}:manual:${timestamp}`,
      priority,
    );

    this.logger.log(`Manually triggered schedule ${schedule.scheduleId} with priority ${priority}`);

    return {
      scheduleId: schedule.scheduleId,
      scheduleRecordId,
      triggeredAt: scheduledAt,
      priority,
    };
  }

  /**
   * Retry a failed schedule record using its existing snapshot
   * @param uid User ID
   * @param scheduleRecordId The schedule record ID to retry
   * @returns Retry status
   */
  async retryScheduleRecord(uid: string, scheduleRecordId: string) {
    // 1. Verify schedule record exists and belongs to user
    const record = await this.prisma.workflowScheduleRecord.findUnique({
      where: { scheduleRecordId },
    });

    if (!record || record.uid !== uid) {
      throw new NotFoundException('Schedule record not found');
    }

    // 2. Check if record is in a retryable state
    if (record.status !== 'failed') {
      throw new BadRequestException(
        `Cannot retry record with status '${record.status}'. Only 'failed' records can be retried.`,
      );
    }

    // 3. Check if snapshot exists for retry
    if (!record.snapshotStorageKey) {
      throw new BadRequestException('No snapshot available for retry. Cannot retry this record.');
    }

    // 3. Verify the schedule still exists
    const schedule = await this.prisma.workflowSchedule.findUnique({
      where: { scheduleId: record.scheduleId },
    });

    if (!schedule || schedule.deletedAt) {
      throw new NotFoundException('Associated schedule not found or has been deleted');
    }

    // 4. Calculate user execution priority
    const priority = await this.priorityService.calculateExecutionPriority(uid);

    // 5. Update ScheduleRecord status to 'pending' immediately for frontend feedback
    await this.prisma.workflowScheduleRecord.update({
      where: { scheduleRecordId },
      data: {
        status: 'pending',
        failureReason: null,
        errorDetails: null,
        triggeredAt: new Date(),
      },
    });

    // 6. Push to execution queue with the existing scheduleRecordId to reuse snapshot
    const timestamp = Date.now();

    await this.addToExecutionQueue(
      {
        scheduleId: record.scheduleId,
        canvasId: record.canvasId,
        uid: record.uid,
        scheduledAt: new Date().toISOString(),
        scheduleRecordId: record.scheduleRecordId,
        priority,
      },
      `schedule:${record.scheduleId}:retry:${scheduleRecordId}:${timestamp}`,
      priority,
    );

    this.logger.log(
      `Retrying schedule record ${scheduleRecordId} for schedule ${record.scheduleId} with priority ${priority}`,
    );

    return {
      scheduleRecordId,
      scheduleId: record.scheduleId,
      status: 'pending',
      priority,
    };
  }

  /**
   * Create or update a scheduled record for the next execution
   * This record represents a future execution that hasn't started yet
   */
  async createOrUpdateScheduledRecord(
    uid: string,
    scheduleId: string,
    canvasId: string,
    scheduledAt: Date,
  ): Promise<void> {
    // Get canvas title for workflowTitle
    const canvas = await this.prisma.canvas.findUnique({
      where: { canvasId },
      select: { title: true },
    });

    // Check if a scheduled record already exists for this schedule
    const existingScheduledRecord = await this.prisma.workflowScheduleRecord.findFirst({
      where: {
        scheduleId,
        status: 'scheduled',
        workflowExecutionId: null, // Only scheduled records without execution
      },
    });

    if (existingScheduledRecord) {
      // Update existing scheduled record
      await this.prisma.workflowScheduleRecord.update({
        where: { scheduleRecordId: existingScheduledRecord.scheduleRecordId },
        data: {
          scheduledAt,
          workflowTitle: canvas?.title || 'Untitled',
        },
      });
    } else {
      // Create new scheduled record
      const scheduleRecordId = genScheduleRecordId();
      await this.prisma.workflowScheduleRecord.create({
        data: {
          scheduleRecordId,
          scheduleId,
          uid,
          canvasId,
          workflowTitle: canvas?.title || 'Untitled',
          status: 'scheduled',
          scheduledAt,
          priority: 5, // Default priority, will be recalculated when actually executed
        },
      });
    }
  }

  /**
   * Delete scheduled record for a schedule
   */
  async deleteScheduledRecord(scheduleId: string): Promise<void> {
    await this.prisma.workflowScheduleRecord.deleteMany({
      where: {
        scheduleId,
        status: 'scheduled',
        workflowExecutionId: null,
      },
    });
  }

  /**
   * Helper to add a job to the execution queue with standard options
   */
  private async addToExecutionQueue(
    data: {
      scheduleId: string;
      canvasId: string;
      uid: string;
      scheduledAt: string;
      priority: number;
      scheduleRecordId: string;
    },
    jobId: string,
    priority: number,
  ): Promise<void> {
    await this.scheduleQueue.add('execute-scheduled-workflow', data, {
      jobId,
      priority,
      ...SCHEDULE_JOB_OPTIONS,
    });
  }
}
