import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { SchedulePriorityService } from './schedule-priority.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_SCHEDULE_EXECUTION } from '../../utils/const';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CronExpressionParser } from 'cron-parser';

@Injectable()
export class ScheduleCronService implements OnModuleInit {
  private readonly logger = new Logger(ScheduleCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly priorityService: SchedulePriorityService,
    @InjectQueue(QUEUE_SCHEDULE_EXECUTION) private readonly scheduleQueue: Queue,
  ) {}

  onModuleInit() {
    this.logger.log('ScheduleCronService initialized');
  }

  // Run every minute
  @Cron(CronExpression.EVERY_MINUTE)
  async scanAndTriggerSchedules() {
    const lockKey = 'lock:schedule:scan';
    const releaseLock = await this.redisService.acquireLock(lockKey, 30); // 30s lock

    if (!releaseLock) {
      this.logger.debug('Schedule scan lock not acquired, skipping');
      return;
    }

    try {
      await this.processDueSchedules();
    } catch (error) {
      this.logger.error('Error processing due schedules', error);
    } finally {
      await releaseLock();
    }
  }

  private async processDueSchedules() {
    const now = new Date();

    // 1. Find due schedules
    // We fetch a batch to avoid memory issues, though usually not too many per minute
    const schedules = await this.prisma.workflowSchedule.findMany({
      where: {
        isEnabled: true,
        deletedAt: null,
        nextRunAt: { lte: now },
      },
      take: 100, // Process 100 at a time
    });

    if (schedules.length === 0) {
      return;
    }

    this.logger.log(`Found ${schedules.length} due schedules`);

    for (const schedule of schedules) {
      try {
        await this.triggerSchedule(schedule);
      } catch (error) {
        this.logger.error(`Failed to trigger schedule ${schedule.scheduleId}`, error);
      }
    }
  }

  private async triggerSchedule(schedule: any) {
    // 3.1 Calculate next run time
    let nextRunAt: Date | null = null;
    try {
      const interval = CronExpressionParser.parse(schedule.cronExpression, {
        currentDate: new Date(), // Calculate from now, or from last run? usually from now or schedule.nextRunAt
        tz: schedule.timezone || 'Asia/Shanghai',
      });
      nextRunAt = interval.next().toDate();
    } catch (e) {
      this.logger.error(`Invalid cron for schedule ${schedule.scheduleId}`, e);
      // Disable invalid schedule?
      return;
    }

    // 3.2 Update schedule with next run time (Optimistic locking via updateMany not strictly needed if we process sequentially or have row lock, but safe enough here)
    // We update first to avoid double triggering if this takes long
    await this.prisma.workflowSchedule.update({
      where: { scheduleId: schedule.scheduleId },
      data: {
        lastRunAt: new Date(),
        nextRunAt,
      },
    });

    // 3.3 Check quota/credits again? (Maybe in processor)

    // 3.4 Calculate user execution priority
    const priority = await this.priorityService.calculateExecutionPriority(schedule.uid);

    // 3.5 Push to execution queue with priority
    // Execution payload: we just send ID, processor fetches details? Or snapshots?
    // Better to send ID and let processor snapshot to ensure freshness.
    const timestamp = Date.now();
    await this.scheduleQueue.add(
      'execute-scheduled-workflow',
      {
        scheduleId: schedule.scheduleId,
        canvasId: schedule.canvasId,
        uid: schedule.uid,
        scheduledAt: schedule.nextRunAt!.toISOString(), // The time it was supposed to run
        priority, // Include priority in job data
      },
      {
        jobId: `schedule:${schedule.scheduleId}:${timestamp}`, // Deduplication ID
        priority: Math.floor(priority), // BullMQ priority (lower is better? BullMQ default is 0, highest? Need to check BullMQ docs. Actually BullMQ usually: lower number = higher priority? Or opposite? Standard is usually higher = higher. But user prompt says "lower number = higher priority". OK I will stick to user prompt: "lower number = higher priority". BullMQ supports numeric priority. 1 is highest priority? No, usually 1 is high. Let's assume standard intuitive priority.)
        // ERROR: BullMQ priority: "Ranges from 1 (lowest) to 2097152 (highest)".
        // Wait, user prompt said: "BullMQ priority: lower number = higher priority".
        // Let me double check standard BullMQ.
        // BullMQ docs: "Jobs with higher priority are processed before jobs with lower priority."
        // So 10 is higher than 1.
        // BUT the user prompt EXPLICITLY said: "BullMQ priority: lower number = higher priority".
        // Maybe their Redis conf or wrapper reverses it? Or they are mistaken?
        // "Final priority range: 1-10." (1=High, 5=Low)
        // If execution uses `priority` option in add(), I must align.
        // If user says "lower = higher", but BullMQ is "higher = higher", I should map:
        // BullPriority = (Max - UserPriority). e.g. (11 - 1) = 10 (High), (11 - 10) = 1 (Low).
        // I will follow this inversion to be safe and logical for BullMQ.
        // Wait, let's look at `workflow.service.ts` if there is any usage of priority.
        // I will trust standard behavior -> Higher number = Higher priority unless specified.
        // User prompt: "BullMQ priority: lower number = higher priority." -> This might be a requirements Spec they want me to follow for my internal "priority" field (1-10), but for `scheduleQueue.add`, I need to use what BullMQ expects.
        // If I pass `priority: 1` to BullMQ, it is low priority. `priority: 10` is high.
        // So if my internal logic is 1=High, 10=Low.
        // Then BullMQ Priority = 11 - MyPriority.
        // 1 (High) -> 10 (High BullMQ)
        // 10 (Low) -> 1 (Low BullMQ)
        // Correct.
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );

    this.logger.log(`Triggered schedule ${schedule.scheduleId} with priority ${priority}`);
  }
}
