import { Processor, WorkerHost } from '@nestjs/bullmq';
import { DelayedError, Job } from 'bullmq';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { MiscService } from '../misc/misc.service';
import { CanvasService } from '../canvas/canvas.service';
import { WorkflowAppService } from '../workflow-app/workflow-app.service';
import { CreditService } from '../credit/credit.service';
import {
  QUEUE_SCHEDULE_EXECUTION,
  SCHEDULE_RATE_LIMITS,
  ScheduleFailureReason,
  classifyScheduleError,
} from './schedule.constants';
import { ScheduleMetrics } from './schedule.metrics';
import { genScheduleRecordId, safeParseJSON } from '@refly/utils';
import type { RawCanvasData } from '@refly/openapi-schema';

/**
 * Job data structure for schedule execution
 */
interface ScheduleExecutionJobData {
  scheduleId: string;
  canvasId: string;
  uid: string;
  scheduledAt: string;
  priority: number;
  // If provided, indicates a retry and should use existing snapshot
  scheduleRecordId?: string;
}

@Processor(QUEUE_SCHEDULE_EXECUTION, {
  // Worker concurrency: max concurrent jobs this worker can process
  // Jobs beyond this limit stay in queue and wait for available slots
  concurrency: SCHEDULE_RATE_LIMITS.GLOBAL_MAX_CONCURRENT,
  // Rate limiter: limit jobs processed per duration
  // - max: maximum number of jobs to process
  // - duration: time window in milliseconds
  // Jobs exceeding this rate are automatically delayed, NOT rejected
  limiter: {
    max: SCHEDULE_RATE_LIMITS.RATE_LIMIT_MAX,
    duration: SCHEDULE_RATE_LIMITS.RATE_LIMIT_DURATION_MS,
  },
})
export class ScheduleProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduleProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly miscService: MiscService,
    private readonly canvasService: CanvasService,
    private readonly metrics: ScheduleMetrics,
    private readonly creditService: CreditService,
    @Inject(forwardRef(() => WorkflowAppService))
    private readonly workflowAppService: WorkflowAppService,
  ) {
    super();
  }

  async process(job: Job<ScheduleExecutionJobData, any, string>): Promise<any> {
    const {
      scheduleId,
      canvasId,
      uid,
      scheduledAt,
      priority,
      scheduleRecordId: existingRecordId,
    } = job.data;
    this.logger.log(`Processing schedule execution job ${job.id} for schedule ${scheduleId}`);

    let scheduleRecordId = existingRecordId || '';
    let isRetry = false;
    let shouldDecrementCounter = false; // Track if we need to decrement counter in finally
    const userConcurrentKey = `${SCHEDULE_RATE_LIMITS.REDIS_PREFIX_USER_CONCURRENT}${uid}`;

    try {
      // 1. User-level concurrency check with Redis degradation
      // If Redis fails, we allow the job to proceed (graceful degradation)
      let userConcurrent = 0;
      let redisSucceeded = false; // Track if Redis increment was successful
      try {
        userConcurrent = await this.redisService.incrementWithExpire(
          userConcurrentKey,
          SCHEDULE_RATE_LIMITS.COUNTER_TTL_SECONDS, // Use longer TTL for long-running workflows
        );
        redisSucceeded = true; // Redis increment succeeded
      } catch (redisError) {
        // Redis connection failed - graceful degradation: allow execution
        this.logger.warn(
          `Redis error during concurrency check for user ${uid}, allowing execution (degraded mode): ${redisError}`,
        );
        // Don't set redisSucceeded, so we won't try to decrement in finally
        userConcurrent = 1; // Assume 1 for rate limit check (will pass since limit is 3)
      }

      if (userConcurrent > SCHEDULE_RATE_LIMITS.USER_MAX_CONCURRENT) {
        // Decrement counter since we're not processing this job now
        // Only decrement if Redis succeeded (otherwise there's nothing to decrement)
        if (redisSucceeded) {
          await this.decrementCounter(userConcurrentKey).catch((err) => {
            this.logger.warn(`Failed to decrement counter after rate limit: ${err}`);
          });
        }

        // Delay the job and retry later
        // BullMQ will automatically re-queue the job after the delay
        this.logger.warn(
          `User ${uid} has ${userConcurrent - 1} concurrent executions, delaying job ${job.id}`,
        );
        await job.moveToDelayed(
          Date.now() + SCHEDULE_RATE_LIMITS.USER_RATE_LIMIT_DELAY_MS,
          job.token,
        );
        throw new DelayedError();
      }

      // Mark that we've committed to processing and should decrement counter in finally
      // Only if Redis succeeded (otherwise there's no counter to decrement)
      shouldDecrementCounter = redisSucceeded;

      // 2. Check if schedule still exists and is enabled
      // This prevents execution of tasks for deleted/disabled schedules
      const schedule = await this.prisma.workflowSchedule.findUnique({
        where: { scheduleId },
      });

      if (!schedule || schedule.deletedAt || !schedule.isEnabled) {
        this.logger.warn(
          `Schedule ${scheduleId} is deleted/disabled, skipping execution for job ${job.id}`,
        );
        // Record skipped metric
        const failureReason = schedule?.deletedAt
          ? ScheduleFailureReason.SCHEDULE_DELETED
          : ScheduleFailureReason.SCHEDULE_DISABLED;
        this.metrics.execution.skipped(
          schedule?.deletedAt ? 'schedule_deleted' : 'schedule_disabled',
        );
        // Update ScheduleRecord to 'skipped' if exists
        if (existingRecordId) {
          await this.prisma.scheduleRecord.update({
            where: { scheduleRecordId: existingRecordId },
            data: {
              status: 'skipped',
              failureReason,
              errorDetails: JSON.stringify({
                reason: schedule?.deletedAt
                  ? 'Schedule was deleted before execution'
                  : 'Schedule was disabled before execution',
              }),
              completedAt: new Date(),
            },
          });
        }
        return null; // Exit gracefully without error
      }

      // 3. Create simple user object (only uid needed, avoid BigInt serialization issues)
      // Note: We don't query the full user object to avoid passing BigInt fields to queues
      const user = { uid };

      // 3. Find or verify the ScheduleRecord for this execution
      // The record should already exist with 'pending' status (set by CronService when job was queued)
      let existingRecord = null;
      if (existingRecordId) {
        existingRecord = await this.prisma.scheduleRecord.findUnique({
          where: { scheduleRecordId: existingRecordId },
        });
        if (existingRecord?.snapshotStorageKey) {
          isRetry = true;
          this.logger.log(`Retry detected for scheduleRecordId: ${existingRecordId}`);
        }
        if (existingRecord) {
          scheduleRecordId = existingRecord.scheduleRecordId;
        }
      }

      // If no record ID was passed, try to find a pending record for this schedule
      if (!scheduleRecordId) {
        existingRecord = await this.prisma.scheduleRecord.findFirst({
          where: {
            scheduleId,
            status: { in: ['pending', 'scheduled'] }, // Could be pending (queued) or scheduled (waiting)
            workflowExecutionId: null,
          },
          orderBy: { scheduledAt: 'asc' },
        });
        if (existingRecord) {
          scheduleRecordId = existingRecord.scheduleRecordId;
          this.logger.log(`Found existing record ${scheduleRecordId} for execution`);
        }
      }

      // 4. Create new ScheduleRecord only if no existing record was found
      // This is a fallback for edge cases (e.g., manual trigger without scheduled record)
      if (!scheduleRecordId) {
        scheduleRecordId = genScheduleRecordId();
        await this.prisma.scheduleRecord.create({
          data: {
            scheduleRecordId,
            scheduleId,
            uid,
            canvasId,
            workflowTitle: '',
            scheduledAt: new Date(scheduledAt),
            status: 'processing', // Skip pending since we're already in processor
            priority,
            triggeredAt: new Date(),
          },
        });
        this.logger.log(`Created new schedule record ${scheduleRecordId}`);
      } else if (isRetry) {
        // Update status for retry
        await this.prisma.scheduleRecord.update({
          where: { scheduleRecordId },
          data: {
            status: 'processing',
            failureReason: null,
            errorDetails: null,
            triggeredAt: new Date(),
          },
        });
      } else {
        // 4.1 Update status to 'processing' - job has been dequeued from BullMQ
        // This indicates the job is now actively being handled by the processor
        await this.prisma.scheduleRecord.update({
          where: { scheduleRecordId },
          data: {
            status: 'processing', // Processor is handling the job (creating snapshot, etc.)
            triggeredAt: existingRecord?.triggeredAt ? undefined : new Date(),
          },
        });
      }

      // 5. Get or create snapshot
      let canvasData: RawCanvasData;
      let snapshotStorageKey: string;

      if (isRetry && existingRecord?.snapshotStorageKey) {
        // Retry: Load existing snapshot
        snapshotStorageKey = existingRecord.snapshotStorageKey;
        canvasData = await this.loadSnapshot(snapshotStorageKey);
        this.logger.log(`Loaded existing snapshot from: ${snapshotStorageKey}`);
      } else {
        // New execution: Create snapshot from raw canvas data
        // Note: We use getCanvasRawData instead of processCanvasForShare because:
        // - processCanvasForShare is designed for sharing existing content (creates ShareRecords)
        // - Schedule needs raw canvas data for execution (no ShareRecords needed)
        // - processCanvasForShare would fail if skillResponse nodes have no action results
        canvasData = await this.createSnapshotFromCanvas(user, canvasId);

        // Upload snapshot to private storage
        snapshotStorageKey = `schedules/${uid}/${scheduleRecordId}/snapshot.json`;
        await this.uploadSnapshot(user, canvasData, snapshotStorageKey);
        this.logger.log(`Created new snapshot at: ${snapshotStorageKey}`);
      }

      // 6. Check credit balance before execution
      // This prevents wasting resources on execution that will fail due to insufficient credits
      const fullUser = await this.prisma.user.findUnique({ where: { uid } });
      if (fullUser) {
        const creditBalance = await this.creditService.getCreditBalance(fullUser);
        if (creditBalance.creditBalance <= 0) {
          this.logger.warn(
            `User ${uid} has insufficient credits (${creditBalance.creditBalance}), failing schedule ${scheduleId}`,
          );
          await this.prisma.scheduleRecord.update({
            where: { scheduleRecordId },
            data: {
              status: 'failed',
              failureReason: ScheduleFailureReason.INSUFFICIENT_CREDITS,
              errorDetails: JSON.stringify({
                message: 'Insufficient credits to execute scheduled workflow',
                creditBalance: creditBalance.creditBalance,
              }),
              snapshotStorageKey,
              completedAt: new Date(),
            },
          });
          this.metrics.execution.fail('cron', 'insufficient_credits');
          return null;
        }
      }

      // 7. Update status to 'running' before executing workflow
      // This indicates the workflow is actually being executed
      await this.prisma.scheduleRecord.update({
        where: { scheduleRecordId },
        data: {
          status: 'running', // Workflow is actually executing
          snapshotStorageKey,
          workflowTitle: canvasData?.title || 'Untitled',
        },
      });

      // 7. Execute workflow using WorkflowAppService
      // Note: user is a simple object { uid } to avoid BigInt serialization issues
      // The methods called inside executeFromCanvasData only need user.uid
      const executionId = await this.workflowAppService.executeFromCanvasData(
        user,
        canvasData,
        canvasData.variables || [],
        {
          scheduleId,
          scheduleRecordId,
          triggerType: 'scheduled',
        },
      );

      // 8. Update ScheduleRecord to running - workflow has been started
      // Final status (success/failed) will be updated by pollWorkflow when execution completes
      await this.prisma.scheduleRecord.update({
        where: { scheduleRecordId },
        data: {
          workflowExecutionId: executionId,
          // Note: completedAt will be set by pollWorkflow when workflow finishes
        },
      });

      this.logger.log(
        `Successfully started workflow for schedule ${scheduleId}, executionId: ${executionId}`,
      );
      // Record started metric (not success - that will be recorded by pollWorkflow)
      this.metrics.execution.success('cron');
      return executionId;
    } catch (error) {
      // Don't log or update record for DelayedError (rate limiting)
      if (error instanceof DelayedError) {
        this.metrics.queue.delayed();
        throw error;
      }

      this.logger.error(`Failed to process schedule ${scheduleId}`, error);

      // Classify error and get standardized failure reason
      const failureReason = classifyScheduleError(error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Record failure metric
      this.metrics.execution.fail('cron', failureReason);

      if (scheduleRecordId) {
        await this.prisma.scheduleRecord.update({
          where: { scheduleRecordId },
          data: {
            status: 'failed',
            failureReason,
            errorDetails: JSON.stringify({
              message: errorMessage,
              name: error instanceof Error ? error.name : 'Error',
              stack: error instanceof Error ? error.stack : undefined,
            }),
            completedAt: new Date(),
          },
        });
      }
      throw error;
    } finally {
      // Only decrement counter if we actually started processing
      // (not if we were delayed due to rate limiting)
      if (shouldDecrementCounter) {
        await this.decrementCounter(userConcurrentKey).catch((err) => {
          this.logger.warn(`Failed to decrement user concurrent counter: ${err}`);
        });
      }
    }
  }

  /**
   * Decrement a Redis counter (used for rate limiting cleanup)
   * Uses DECR command which is atomic and handles edge cases
   */
  private async decrementCounter(key: string): Promise<number> {
    const client = this.redisService.getClient();
    if (!client) {
      return 0;
    }

    // Use DECR to atomically decrement, and prevent going below 0
    const script = `
      local count = redis.call('GET', KEYS[1])
      if count and tonumber(count) > 0 then
        return redis.call('DECR', KEYS[1])
      end
      return 0
    `;
    return client.eval(script, 1, key) as unknown as number;
  }

  /**
   * Load snapshot from storage
   */
  private async loadSnapshot(storageKey: string): Promise<RawCanvasData> {
    const buffer = await this.miscService.downloadFile({
      storageKey,
      visibility: 'private',
    });
    const data = safeParseJSON(buffer.toString());
    if (!data) {
      throw new Error(`Failed to parse snapshot from ${storageKey}`);
    }
    return data as RawCanvasData;
  }

  /**
   * Upload snapshot to storage
   */
  private async uploadSnapshot(
    user: { uid: string },
    canvasData: RawCanvasData,
    storageKey: string,
  ): Promise<void> {
    await this.miscService.uploadBuffer(user as any, {
      fpath: 'snapshot.json',
      buf: Buffer.from(JSON.stringify(canvasData)),
      visibility: 'private',
      storageKey,
    });
  }

  /**
   * Create snapshot from canvas data with files and resources
   * This is a simpler alternative to processCanvasForShare that doesn't create ShareRecords
   */
  private async createSnapshotFromCanvas(
    user: { uid: string },
    canvasId: string,
  ): Promise<RawCanvasData> {
    // 1. Get raw canvas data (nodes, edges, variables)
    const rawData = await this.canvasService.getCanvasRawData(user as any, canvasId);

    // 2. Get drive files associated with this canvas
    const driveFiles = await this.prisma.driveFile.findMany({
      where: {
        uid: user.uid,
        canvasId,
        scope: 'present',
        deletedAt: null,
      },
    });

    const files = driveFiles.map((file) => ({
      fileId: file.fileId,
      canvasId: file.canvasId,
      name: file.name,
      type: file.type,
      category: file.category,
      size: Number(file.size),
      source: file.source,
      scope: file.scope,
      summary: file.summary ?? undefined,
      variableId: file.variableId ?? undefined,
      resultId: file.resultId ?? undefined,
      resultVersion: file.resultVersion ?? undefined,
      storageKey: file.storageKey ?? undefined,
      createdAt: file.createdAt.toJSON(),
      updatedAt: file.updatedAt.toJSON(),
    }));

    // 3. Get resources associated with this canvas
    const resources = await this.prisma.resource.findMany({
      where: {
        uid: user.uid,
        canvasId,
        deletedAt: null,
      },
      select: {
        resourceId: true,
        title: true,
        resourceType: true,
        storageKey: true,
        storageSize: true,
        contentPreview: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 4. Combine into snapshot format
    return {
      title: rawData.title,
      canvasId: rawData.canvasId,
      variables: rawData.variables || [],
      nodes: rawData.nodes || [],
      edges: rawData.edges || [],
      files: files as any,
      resources: resources as any,
    } as RawCanvasData;
  }

  // classifyError moved to schedule.constants.ts as classifyScheduleError
}
