import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { MiscService } from '../misc/misc.service';
import { CanvasService } from '../canvas/canvas.service';
import { WorkflowAppService } from '../workflow-app/workflow-app.service';
import { QUEUE_SCHEDULE_EXECUTION } from '../../utils/const';
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

@Processor(QUEUE_SCHEDULE_EXECUTION)
export class ScheduleProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduleProcessor.name);
  private readonly CONCURRENT_LIMIT_KEY = 'schedule:concurrent:global';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly miscService: MiscService,
    private readonly canvasService: CanvasService,
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

    try {
      // 1. Global Rate Limiting Check
      await this.redisService.incrementWithExpire(this.CONCURRENT_LIMIT_KEY, 3600);

      // 2. Create simple user object (only uid needed, avoid BigInt serialization issues)
      // Note: We don't query the full user object to avoid passing BigInt fields to queues
      const user = { uid };

      // 3. Check if this is a retry (existing scheduleRecordId with snapshot)
      let existingRecord = null;
      if (existingRecordId) {
        existingRecord = await this.prisma.scheduleRecord.findUnique({
          where: { scheduleRecordId: existingRecordId },
        });
        if (existingRecord?.snapshotStorageKey) {
          isRetry = true;
          this.logger.log(`Retry detected for scheduleRecordId: ${existingRecordId}`);
        }
      }

      // 4. Create new ScheduleRecord if not a retry
      if (!isRetry) {
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
      } else {
        // Update status for retry
        await this.prisma.scheduleRecord.update({
          where: { scheduleRecordId },
          data: {
            status: 'pending',
            failureReason: null,
            errorDetails: null,
            triggeredAt: new Date(),
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

      // 6. Execute workflow using WorkflowAppService
      // Note: user is a simple object { uid } to avoid BigInt serialization issues
      // The methods called inside executeFromCanvasData only need user.uid
      const executionId = await this.workflowAppService.executeFromCanvasData(
        user,
        canvasData,
        canvasData.variables || [],
        { scheduleRecordId },
      );

      // 7. Update ScheduleRecord with success
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
          completedAt: new Date(),
        },
      });

      this.logger.log(`Successfully executed schedule ${scheduleId}, executionId: ${executionId}`);
      return executionId;
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
}
