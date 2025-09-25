import { User } from '../../generated/client';
import {
  CreateWorkflowAppRequest,
  WorkflowVariable,
  ListWorkflowAppsData,
} from '@refly/openapi-schema';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CanvasService } from '../canvas/canvas.service';
import { MiscService } from '../misc/misc.service';
import { genCanvasID, genWorkflowAppID } from '@refly/utils';
import { WorkflowService } from '../workflow/workflow.service';
import { workflowAppPO2DTO } from './workflow-app.dto';
import { Injectable } from '@nestjs/common';
import { ShareCommonService } from '../share/share-common.service';
import { ShareCreationService } from '../share/share-creation.service';
import { ShareNotFoundError } from '@refly/errors';

@Injectable()
export class WorkflowAppService {
  private logger = new Logger(WorkflowAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly canvasService: CanvasService,
    private readonly miscService: MiscService,
    private readonly workflowService: WorkflowService,
    private readonly shareCommonService: ShareCommonService,
    private readonly shareCreationService: ShareCreationService,
  ) {}

  async createWorkflowApp(user: User, body: CreateWorkflowAppRequest) {
    const { canvasId, title, query, variables, description } = body;

    const existingWorkflowApp = await this.prisma.workflowApp.findFirst({
      where: { canvasId, uid: user.uid, deletedAt: null },
    });

    const appId = existingWorkflowApp?.appId ?? genWorkflowAppID();

    const canvas = await this.prisma.canvas.findUnique({
      where: { canvasId, uid: user.uid, deletedAt: null },
    });

    if (!canvas) {
      throw new Error('canvas not found');
    }

    const canvasData = await this.canvasService.getCanvasRawData(user, canvasId);

    if (title) {
      canvasData.title = title;
    }

    // Publish minimap
    if (canvas.minimapStorageKey) {
      const minimapUrl = await this.miscService.publishFile(canvas.minimapStorageKey);
      canvasData.minimapUrl = minimapUrl;
    }

    // Upload public canvas data to Minio
    const { storageKey } = await this.miscService.uploadBuffer(user, {
      fpath: 'canvas.json',
      buf: Buffer.from(JSON.stringify(canvasData)),
      entityId: canvasId,
      entityType: 'canvas',
      visibility: 'public',
    });

    if (existingWorkflowApp) {
      await this.prisma.workflowApp.update({
        where: { appId },
        data: {
          title: canvasData.title,
          query,
          variables: JSON.stringify(variables),
          description,
          storageKey,
          updatedAt: new Date(),
        },
      });
    } else {
      await this.prisma.workflowApp.create({
        data: {
          appId,
          title: canvasData.title,
          uid: user.uid,
          query,
          variables: JSON.stringify(variables),
          description,
          canvasId,
          storageKey,
        },
      });
    }

    // Create share for workflow app
    try {
      const { shareRecord } = await this.shareCreationService.createShareForWorkflowApp(user, {
        entityId: appId,
        entityType: 'workflowApp',
        title: canvasData.title,
        parentShareId: null,
        allowDuplication: true,
      });

      // Update WorkflowApp record with shareId
      await this.prisma.workflowApp.update({
        where: { appId },
        data: {
          shareId: shareRecord.shareId,
        },
      });

      this.logger.log(`Created share for workflow app: ${appId}, shareId: ${shareRecord.shareId}`);
    } catch (error) {
      this.logger.error(`Failed to create share for workflow app ${appId}: ${error.stack}`);
      // Don't throw error, just log it - workflow app creation should still succeed
    }

    const workflowApp = await this.prisma.workflowApp.findUnique({
      where: { appId, uid: user.uid, deletedAt: null },
    });

    return workflowAppPO2DTO(workflowApp);
  }

  async getWorkflowAppDetail(user: User, appId: string) {
    const workflowApp = await this.prisma.workflowApp.findUnique({
      where: { appId, uid: user.uid, deletedAt: null },
    });

    if (!workflowApp) {
      throw new ShareNotFoundError();
    }

    return workflowAppPO2DTO(workflowApp);
  }

  async executeWorkflowApp(user: User, shareId: string, variables: WorkflowVariable[]) {
    const workflowApp = await this.prisma.workflowApp.findFirst({
      where: { shareId, deletedAt: null },
    });

    if (!workflowApp?.canvasId) {
      throw new ShareNotFoundError();
    }

    const newCanvasId = genCanvasID();

    // Note: Internal workflow execution still uses appId for tracking purposes
    return this.workflowService.initializeWorkflowExecution(
      user,
      workflowApp.canvasId,
      newCanvasId,
      variables,
      { appId: workflowApp.appId }, // Keep appId for internal workflow tracking
    );
  }

  async listWorkflowApps(user: User, query: ListWorkflowAppsData) {
    const { canvasId } = query.query ?? {};

    const whereClause: any = {
      uid: user.uid,
      deletedAt: null,
    };

    if (canvasId) {
      whereClause.canvasId = canvasId;
    }

    const workflowApps = await this.prisma.workflowApp.findMany({
      where: whereClause,
      orderBy: { updatedAt: 'desc' },
      take: 1, // Only get the latest one
    });

    return workflowApps.map(workflowAppPO2DTO).filter(Boolean);
  }
}
