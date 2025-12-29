import { Injectable, Logger, OnModuleInit, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { SchedulePriorityService } from './schedule-priority.service';
import { ScheduleService } from './schedule.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_SCHEDULE_EXECUTION } from './schedule.constants';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CronExpressionParser } from 'cron-parser';

@Injectable()
export class ScheduleCronService implements OnModuleInit {
  private readonly logger = new Logger(ScheduleCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly priorityService: SchedulePriorityService,
    @Inject(forwardRef(() => ScheduleService))
    private readonly scheduleService: ScheduleService,
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

    // 3.3 Find or create the ScheduleRecord for this execution
    // First, check if there's a 'scheduled' record that should be converted
    const scheduleRecord = await this.prisma.scheduleRecord.findFirst({
      where: {
        scheduleId: schedule.scheduleId,
        status: 'scheduled',
        workflowExecutionId: null,
      },
      orderBy: { scheduledAt: 'asc' },
    });

    if (scheduleRecord) {
      // Update existing scheduled record to 'pending' (queued in BullMQ)
      await this.prisma.scheduleRecord.update({
        where: { scheduleRecordId: scheduleRecord.scheduleRecordId },
        data: {
          status: 'pending', // Job is now in the BullMQ queue, waiting to be processed
          triggeredAt: new Date(),
        },
      });
    }
    // Note: If no scheduled record exists, Processor will create one with 'pending' status

    // 3.4 Create or update scheduled record for the NEXT execution (future)
    if (nextRunAt) {
      await this.scheduleService.createOrUpdateScheduledRecord(
        schedule.uid,
        schedule.scheduleId,
        schedule.canvasId,
        nextRunAt,
      );
    }

    // 3.5 Calculate user execution priority
    // Priority range: 1-10 (higher number = higher priority, aligned with BullMQ)
    const priority = await this.priorityService.calculateExecutionPriority(schedule.uid);

    // 3.6 Push to execution queue with priority
    // The job will stay in 'wait' state in BullMQ until a worker picks it up
    // During this time, the ScheduleRecord status is 'pending' (visible to frontend)
    const timestamp = Date.now();
    await this.scheduleQueue.add(
      'execute-scheduled-workflow',
      {
        scheduleId: schedule.scheduleId,
        canvasId: schedule.canvasId,
        uid: schedule.uid,
        scheduledAt: schedule.nextRunAt!.toISOString(), // The time it was supposed to run
        priority, // Include priority in job data
        scheduleRecordId: scheduleRecord?.scheduleRecordId, // Pass record ID if exists
      },
      {
        jobId: `schedule:${schedule.scheduleId}:${timestamp}`, // Deduplication ID
        // Priority is already aligned with BullMQ (higher number = higher priority)
        priority: Math.floor(priority),
        attempts: 1,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );

    this.logger.log(`Triggered schedule ${schedule.scheduleId} with priority ${priority}`);
  }
}
