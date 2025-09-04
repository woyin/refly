import { User } from '../../generated/client';
import { CreateWorkflowAppRequest, WorkflowVariable } from '@refly/openapi-schema';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CanvasService } from '../canvas/canvas.service';
import { MiscService } from '../misc/misc.service';
import { genCanvasID, genWorkflowAppID } from '@refly/utils';
import { WorkflowService } from '../workflow/workflow.service';
import { workflowAppPO2DTO } from './workflow-app.dto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkflowAppService {
  private logger = new Logger(WorkflowAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly canvasService: CanvasService,
    private readonly miscService: MiscService,
    private readonly workflowService: WorkflowService,
  ) {}

  async createWorkflowApp(user: User, body: CreateWorkflowAppRequest) {
    const { canvasId, title, query, variables, description } = body;

    const existingWorkflowApp = await this.prisma.workflowApp.findFirst({
      where: { canvasId, uid: user.uid, deletedAt: null },
    });

    const workflowAppId = existingWorkflowApp?.workflowAppId ?? genWorkflowAppID();

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
        where: { workflowAppId },
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
          workflowAppId,
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

    const workflowApp = await this.prisma.workflowApp.findUnique({
      where: { workflowAppId, uid: user.uid, deletedAt: null },
    });

    return workflowAppPO2DTO(workflowApp);
  }

  async getWorkflowAppDetail(user: User, workflowAppId: string) {
    const workflowApp = await this.prisma.workflowApp.findUnique({
      where: { workflowAppId, uid: user.uid, deletedAt: null },
    });

    return workflowAppPO2DTO(workflowApp);
  }

  async executeWorkflowApp(user: User, workflowAppId: string, variables: WorkflowVariable[]) {
    const workflowApp = await this.getWorkflowAppDetail(user, workflowAppId);

    const newCanvasId = genCanvasID();

    return this.workflowService.initializeWorkflowExecution(
      user,
      workflowApp.canvasId,
      newCanvasId,
      variables,
    );
  }
}
