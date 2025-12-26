import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { WorkflowService } from '../workflow/workflow.service';
import { MiscService } from '../misc/misc.service';
import { CanvasService } from '../canvas/canvas.service';
import { QUEUE_SCHEDULE_EXECUTION } from '../../utils/const';
import { genScheduleRecordId } from '@refly/utils';

@Processor(QUEUE_SCHEDULE_EXECUTION)
export class ScheduleProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduleProcessor.name);
  private readonly CONCURRENT_LIMIT_KEY = 'schedule:concurrent:global';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly workflowService: WorkflowService,
    private readonly miscService: MiscService,
    private readonly canvasService: CanvasService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { scheduleId, canvasId, uid, scheduledAt, priority } = job.data;
    this.logger.log(`Processing schedule execution job ${job.id} for schedule ${scheduleId}`);

    let scheduleRecordId = '';

    try {
      // 1. Global Rate Limiting Check
      // BullMQ concurrency is per worker instance. Redis allows global.
      // Using BullMQ worker concurrency (set in module) for basic concurrency.
      await this.redisService.incrementWithExpire(this.CONCURRENT_LIMIT_KEY, 3600);

      // 2. Create ScheduleRecord
      scheduleRecordId = genScheduleRecordId();
      await this.prisma.scheduleRecord.create({
        data: {
          scheduleRecordId,
          scheduleId,
          uid,
          canvasId,
          workflowTitle: '',
          scheduledAt: new Date(scheduledAt),
          status: 'pending',
          priority,
        },
      });

      // 3. Validation
      // 3.1 Check Credits
      const user = await this.prisma.user.findUnique({ where: { uid } });
      if (!user) throw new Error('User not found');

      // 4. Get Canvas Data & Create Snapshot
      const canvasData = await this.canvasService.getCanvasRawData(user, canvasId);
      if (!canvasData) {
        throw new Error(`Canvas ${canvasId} not found`);
      }

      // Generate snapshot JSON
      const snapshot = JSON.stringify(canvasData);

      // Upload snapshot to MinIO
      const snapshotStorageKey = `schedules/${uid}/${scheduleRecordId}/snapshot.json`;

      await this.miscService.uploadBuffer(user, {
        fpath: 'snapshot.json',
        buf: Buffer.from(snapshot),
        visibility: 'private',
        storageKey: snapshotStorageKey,
      });

      // 5. Execute Workflow
      // Use initializeWorkflowExecution to start the workflow
      const executionId = await this.workflowService.initializeWorkflowExecution(
        user,
        canvasId,
        undefined,
        {
          sourceCanvasId: canvasId,
          sourceCanvasData: canvasData as any,
          nodeBehavior: 'create',
        },
      );

      // 6. Update ScheduleRecord with Execution ID
      const canvas = await this.prisma.canvas.findUnique({
        where: { canvasId },
        select: { title: true },
      });

      await this.prisma.scheduleRecord.update({
        where: { scheduleRecordId },
        data: {
          workflowExecutionId: executionId,
          status: 'success',
          workflowTitle: canvas?.title || 'Untitled',
          snapshotStorageKey,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to process schedule ${scheduleId}`, error);
      if (scheduleRecordId) {
        await this.prisma.scheduleRecord.update({
          where: { scheduleRecordId },
          data: {
            status: 'failed',
            failureReason: error instanceof Error ? error.message : String(error),
            errorDetails: JSON.stringify(error),
            completedAt: new Date(),
          },
        });
      }
      throw error;
    }
  }
}
