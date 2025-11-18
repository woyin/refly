/**
 * Canvas Sync Helper
 * Provides helper functions to sync tool execution results to canvas
 * This replaces the functionality previously provided by @ToolExecutionSync decorator
 */

import { Logger } from '@nestjs/common';
import type { User, CanvasNode, CanvasNodeType, EntityType } from '@refly/openapi-schema';
import { genActionResultID, genMediaID, safeParseJSON } from '@refly/utils';
import type { ActionResult } from '../../../generated/client';
import { ActionResultNotFoundError } from '@refly/errors';
import type { PrismaService } from '../../common/prisma.service';
import type { CanvasSyncService } from '../../canvas-sync/canvas-sync.service';
import type { MiscService } from '../../misc/misc.service';

/**
 * Configuration for canvas sync
 */
export interface CanvasSyncOptions {
  /**
   * Type of result/node being generated (audio, video, image, document, code, etc.)
   */
  resultType: string;

  /**
   * Parent result ID (optional)
   */
  parentResultId?: string;

  /**
   * Title/prompt for the result
   */
  title: string;

  /**
   * Model name (optional)
   */
  model?: string;

  /**
   * Provider item ID (optional)
   */
  providerItemId?: string;

  /**
   * Whether to create canvas node automatically (default: true)
   */
  createCanvasNode?: boolean;

  /**
   * Whether to update workflow node execution (default: true)
   */
  updateWorkflowNode?: boolean;

  /**
   * Custom metadata
   */
  metadata?: Record<string, any>;

  /**
   * Target ID (canvas ID) - optional, can be extracted from parent
   */
  targetId?: string;

  /**
   * Target type (canvas, etc.) - optional, can be extracted from parent
   */
  targetType?: EntityType;

  /**
   * Request data to store
   */
  requestData?: any;
}

/**
 * Result data from tool execution
 */
export interface ToolExecutionResultData {
  // File data - either URL/storageKey (already uploaded) or buffer (to be uploaded)
  outputUrl?: string;
  storageKey?: string;
  buffer?: Buffer;
  filename?: string;
  mimetype?: string;
  // Metadata
  duration?: number;
  format?: string;
  size?: number;
  text?: string;
  segments?: any[];
  [key: string]: any;
}

/**
 * Canvas sync context
 */
export interface CanvasSyncContext {
  actionResult: ActionResult;
  parentResult?: any;
  nodeExecutionToUpdate?: { nodeExecutionId: string; nodeData: CanvasNode } | null;
}

/**
 * Canvas Sync Helper class
 */
export class CanvasSyncHelper {
  private readonly logger = new Logger(CanvasSyncHelper.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly canvasSyncService: CanvasSyncService,
    private readonly miscService?: MiscService,
  ) {}

  /**
   * Initialize canvas sync context
   * Creates ActionResult and looks up parent/workflow nodes
   */
  async initialize(user: User, options: CanvasSyncOptions): Promise<CanvasSyncContext> {
    const {
      resultType,
      parentResultId,
      title,
      model,
      providerItemId,
      updateWorkflowNode = true,
      requestData,
    } = options;

    let { targetId, targetType } = options;
    let parentResult: any = null;
    let nodeExecutionToUpdate: { nodeExecutionId: string; nodeData: CanvasNode } | null = null;

    // Step 1: Handle parent result and workflow node lookup
    if (parentResultId) {
      parentResult = await this.prismaService.actionResult.findFirst({
        select: {
          targetId: true,
          targetType: true,
          workflowNodeExecutionId: true,
          modelName: true,
        },
        where: { resultId: parentResultId },
        orderBy: { version: 'desc' },
      });

      if (!parentResult) {
        throw new ActionResultNotFoundError(`Action result ${parentResultId} not found`);
      }

      // Inherit targetId/targetType from parent if not provided
      targetId = targetId || parentResult.targetId;
      targetType = (targetType || parentResult.targetType) as EntityType;

      // Look for workflow node execution to update
      if (updateWorkflowNode && parentResult.workflowNodeExecutionId) {
        nodeExecutionToUpdate = await this.findWorkflowNodeToUpdate(
          parentResult.workflowNodeExecutionId,
          resultType,
        );
      }
    }

    // Step 2: Create ActionResult
    const actionResult = await this.prismaService.actionResult.create({
      data: {
        resultId: genActionResultID(),
        uid: user.uid,
        type: resultType,
        title: title,
        modelName: model || parentResult?.modelName,
        targetType: targetType || parentResult?.targetType,
        targetId: targetId || parentResult?.targetId,
        providerItemId: providerItemId,
        status: 'waiting',
        input: requestData ? JSON.stringify(requestData) : null,
        version: 0,
        parentResultId: parentResultId,
      },
    });

    // Step 3: Update status to executing
    await this.prismaService.actionResult.update({
      where: { pk: actionResult.pk },
      data: { status: 'executing' },
    });

    return {
      actionResult,
      parentResult,
      nodeExecutionToUpdate,
    };
  }

  /**
   * Finalize canvas sync
   * Uploads files, updates workflow nodes, creates canvas nodes, and updates ActionResult
   */
  async finalize(
    user: User,
    context: CanvasSyncContext,
    options: CanvasSyncOptions,
    resultData: ToolExecutionResultData,
  ): Promise<ToolExecutionResultData> {
    const { resultType, title, parentResultId, createCanvasNode = true, metadata = {} } = options;

    const { actionResult, nodeExecutionToUpdate } = context;

    let outputUrl = resultData.outputUrl;
    let storageKey = resultData.storageKey;

    // Step 1: Upload file if buffer is provided
    if (resultData.buffer && this.miscService) {
      try {
        const uploadResult = await this.miscService.uploadFile(
          {
            uid: user.uid,
            email: user.email || '',
          },
          {
            file: {
              buffer: resultData.buffer,
              mimetype: resultData.mimetype || 'application/octet-stream',
              originalname: resultData.filename || `file.${this.getExtension(resultType)}`,
            },
            entityId: actionResult.resultId,
            entityType: 'mediaResult',
            visibility: 'private',
          },
        );

        outputUrl = uploadResult.url;
        storageKey = uploadResult.storageKey;
      } catch (error) {
        this.logger.error(
          `Failed to upload file: ${(error as Error).message}`,
          (error as Error).stack,
        );
        throw error;
      }
    }

    // Step 2: Update workflow node if exists
    if (nodeExecutionToUpdate && outputUrl && storageKey) {
      await this.updateWorkflowNode(
        nodeExecutionToUpdate,
        resultType,
        title,
        outputUrl,
        storageKey,
        { ...metadata, ...resultData },
      );
    }

    // Step 3: Create canvas node if configured
    if (
      createCanvasNode &&
      actionResult.targetType === 'canvas' &&
      actionResult.targetId &&
      outputUrl &&
      storageKey
    ) {
      await this.createCanvasNode(
        user,
        actionResult,
        resultType,
        title,
        outputUrl,
        storageKey,
        parentResultId,
        { ...metadata, ...resultData },
      );
    }

    // Step 4: Update ActionResult to finish
    await this.prismaService.actionResult.update({
      where: { pk: actionResult.pk },
      data: {
        status: 'finish',
        outputUrl,
        storageKey,
      },
    });

    // Step 5: Return updated result data
    return {
      ...resultData,
      outputUrl,
      storageKey,
      entityId: actionResult.resultId,
    };
  }

  /**
   * Mark execution as failed
   */
  async markFailed(context: CanvasSyncContext): Promise<void> {
    const { actionResult, nodeExecutionToUpdate } = context;

    await this.prismaService.actionResult.update({
      where: { pk: actionResult.pk },
      data: { status: 'failed' },
    });

    if (nodeExecutionToUpdate) {
      await this.updateWorkflowNodeStatus(nodeExecutionToUpdate.nodeExecutionId, 'failed');
    }
  }

  /**
   * Find workflow node execution to update
   */
  private async findWorkflowNodeToUpdate(
    workflowNodeExecutionId: string,
    resultType: string,
  ): Promise<{ nodeExecutionId: string; nodeData: CanvasNode } | null> {
    const nodeExecution = await this.prismaService.workflowNodeExecution.findUnique({
      where: { nodeExecutionId: workflowNodeExecutionId },
    });

    if (!nodeExecution?.childNodeIds) {
      return null;
    }

    const childNodeIds = safeParseJSON(nodeExecution.childNodeIds) as string[];
    const mediaNodeExecution = await this.prismaService.workflowNodeExecution.findFirst({
      where: {
        nodeId: { in: childNodeIds },
        status: 'waiting',
        nodeType: resultType as CanvasNodeType,
        executionId: nodeExecution.executionId,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!mediaNodeExecution?.entityId) {
      return null;
    }

    const nodeData: CanvasNode = safeParseJSON(mediaNodeExecution.nodeData);
    return {
      nodeExecutionId: mediaNodeExecution.nodeExecutionId,
      nodeData,
    };
  }

  /**
   * Update workflow node with execution results
   */
  private async updateWorkflowNode(
    nodeExecutionToUpdate: { nodeExecutionId: string; nodeData: CanvasNode },
    resultType: string,
    title: string,
    outputUrl: string,
    storageKey: string,
    customMetadata: Record<string, any> = {},
  ): Promise<void> {
    await this.prismaService.workflowNodeExecution.update({
      where: { nodeExecutionId: nodeExecutionToUpdate.nodeExecutionId },
      data: {
        title: title,
        entityId: nodeExecutionToUpdate.nodeData.data?.entityId || '',
        status: 'finish',
        nodeData: JSON.stringify({
          ...nodeExecutionToUpdate.nodeData,
          data: {
            ...nodeExecutionToUpdate.nodeData.data,
            title: title,
            entityId: nodeExecutionToUpdate.nodeData.data?.entityId || '',
            metadata: {
              ...nodeExecutionToUpdate.nodeData.data?.metadata,
              [`${resultType}Url`]: outputUrl,
              storageKey: storageKey,
              ...customMetadata,
            },
          },
        }),
      },
    });
  }

  /**
   * Update workflow node status only
   */
  private async updateWorkflowNodeStatus(
    nodeExecutionId: string,
    status: 'finish' | 'failed',
  ): Promise<void> {
    try {
      await this.prismaService.workflowNodeExecution.update({
        where: { nodeExecutionId },
        data: { status },
      });
    } catch (error) {
      this.logger.error(
        `Failed to update workflow node execution status to ${status}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Create canvas node for the execution result
   */
  private async createCanvasNode(
    user: User,
    actionResult: ActionResult,
    resultType: string,
    title: string,
    outputUrl: string,
    storageKey: string,
    parentResultId?: string,
    customMetadata: Record<string, any> = {},
  ): Promise<void> {
    const entityId = genMediaID(resultType as any);
    await this.canvasSyncService.addNodeToCanvas(
      user,
      actionResult.targetId,
      {
        type: resultType as CanvasNodeType,
        data: {
          title: title || `${resultType}-${Date.now()}`,
          entityId,
          metadata: {
            resultId: actionResult.resultId,
            storageKey,
            [`${resultType}Url`]: outputUrl,
            ...customMetadata,
          },
        },
      },
      parentResultId ? [{ type: 'skillResponse', entityId: parentResultId }] : undefined,
      { autoLayout: true },
    );
  }

  /**
   * Get file extension from result type
   */
  private getExtension(resultType: string): string {
    const lowerType = resultType.toLowerCase();
    if (lowerType.includes('video')) return 'mp4';
    if (lowerType.includes('audio')) return 'mp3';
    if (lowerType.includes('image')) return 'png';
    return 'bin'; // default
  }
}
