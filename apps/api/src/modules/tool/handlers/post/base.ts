/**
 * Base post-handler
 * Combines billing processing, resource upload, and canvas sync in a single unified handler
 */

import { Logger } from '@nestjs/common';
import type {
  BillingConfig,
  HandlerContext,
  HandlerRequest,
  HandlerResponse,
  UploadResult,
  User,
  CanvasNode,
  CanvasNodeType,
  EntityType,
  ToolResourceType,
} from '@refly/openapi-schema';
import { genActionResultID, genMediaID, safeParseJSON } from '@refly/utils';
import { ActionResultNotFoundError } from '@refly/errors';
import type { ResourceUploader } from '../types';
import {
  calculateCredits,
  getValueByPath,
  setValueByPath,
  uploadResourceItem,
  uploadResourceItems,
} from '../../utils';
import type { PrismaService } from '../../../common/prisma.service';
import type { CanvasSyncService } from '../../../canvas-sync/canvas-sync.service';
import type { ActionResult } from '../../../../generated/client';

/**
 * Configuration for canvas sync
 */
export interface CanvasSyncConfig {
  /**
   * Type of result/node being generated (audio, video, image, document, code, etc.)
   */
  resultType: string;

  /**
   * Function to extract parentResultId from request
   */
  getParentResultId: (request: HandlerRequest) => string | undefined;

  /**
   * Function to extract title/prompt from request
   */
  getTitle: (request: HandlerRequest) => string;

  /**
   * Function to extract model name from request (optional)
   */
  getModel?: (request: HandlerRequest) => string | undefined;

  /**
   * Function to extract provider item ID from request (optional)
   */
  getProviderItemId?: (request: HandlerRequest) => string | undefined;

  /**
   * Whether to create canvas node automatically (default: true)
   */
  createCanvasNode?: boolean;

  /**
   * Whether to update workflow node execution (default: true)
   */
  updateWorkflowNode?: boolean;

  /**
   * Custom metadata extractor (optional)
   */
  getMetadata?: (request: HandlerRequest, response: HandlerResponse) => Record<string, any>;

  /**
   * User context (required for canvas operations)
   */
  user: User;

  /**
   * Target ID (canvas ID) - optional, can be extracted from parent
   */
  targetId?: string;

  /**
   * Target type (canvas, etc.) - optional, can be extracted from parent
   */
  targetType?: EntityType;
}

/**
 * Configuration for base post-handler
 */
export interface BasePostHandlerConfig {
  /**
   * Billing configuration
   */
  billing?: BillingConfig;

  /**
   * Resource uploader instance
   */
  uploader?: ResourceUploader;

  /**
   * Canvas sync configuration
   */
  canvasSync?: CanvasSyncConfig;

  /**
   * Prisma service instance (required if canvasSync is enabled)
   */
  prismaService?: PrismaService;

  /**
   * Canvas sync service instance (required if canvasSync is enabled)
   */
  canvasSyncService?: CanvasSyncService;
}

/**
 * Create base post-handler
 * Handles billing calculation, resource upload, and canvas sync in correct order:
 * 1. Process billing (if configured)
 * 2. Upload resources (if configured)
 * 3. Sync canvas nodes (if configured)
 */
export function createBasePostHandler(
  config: BasePostHandlerConfig = {},
): (
  response: HandlerResponse,
  request: HandlerRequest,
  context: HandlerContext,
) => Promise<HandlerResponse> {
  const logger = new Logger('BasePostHandler');

  return async (
    response: HandlerResponse,
    request: HandlerRequest,
    context: HandlerContext,
  ): Promise<HandlerResponse> => {
    let processedResponse = response;

    // Skip all processing if request failed
    if (!response.success) {
      return response;
    }

    // Step 1: Process billing
    if (config.billing?.enabled) {
      processedResponse = await processBilling(processedResponse, request, config.billing, logger);
    }

    // Step 2: Upload resources
    if (config.uploader && processedResponse.data) {
      processedResponse = await processResourceUpload(
        processedResponse,
        request,
        context,
        config.uploader,
        logger,
      );
    }

    // Step 3: Sync canvas nodes
    if (config.canvasSync && config.prismaService && config.canvasSyncService) {
      processedResponse = await syncCanvasNodes(
        processedResponse,
        request,
        config.canvasSync,
        config.prismaService,
        config.canvasSyncService,
        logger,
      );
    }

    return processedResponse;
  };
}

/**
 * Process billing calculation
 */
async function processBilling(
  response: HandlerResponse,
  request: HandlerRequest,
  billingConfig: BillingConfig,
  logger: Logger,
): Promise<HandlerResponse> {
  try {
    const credits = calculateCredits(billingConfig, request.params);

    logger.log(
      `Calculated ${credits} credits for ${request.provider}.${request.method} (type: ${billingConfig.type})`,
    );

    return {
      ...response,
      metadata: {
        ...response.metadata,
        creditCost: credits,
        billingType: billingConfig.type,
      },
    };
  } catch (error) {
    logger.error(
      `Failed to calculate credits: ${(error as Error).message}`,
      (error as Error).stack,
    );
    // Don't fail the request if billing calculation fails
    return response;
  }
}

/**
 * Check if value is a buffer object
 */
interface BufferObject {
  buffer: Buffer;
  filename?: string;
  mimetype?: string;
}

function isBufferObject(value: unknown): value is BufferObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    'buffer' in value &&
    Buffer.isBuffer((value as BufferObject).buffer)
  );
}

/**
 * Detect resource type from MIME type
 */
function detectResourceTypeFromMimeType(mimetype: string | undefined): ToolResourceType {
  if (!mimetype) return 'document';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('image/')) return 'image';
  return 'document';
}

/**
 * Process resource upload
 */
async function processResourceUpload(
  response: HandlerResponse,
  request: HandlerRequest,
  context: HandlerContext,
  uploader: ResourceUploader,
  logger: Logger,
): Promise<HandlerResponse> {
  // 🔴 First layer: Check if entire response.data is a buffer object (binary response)
  if (isBufferObject(response.data)) {
    logger.log('Detected binary response (buffer object), uploading directly as resource');

    const resourceType = detectResourceTypeFromMimeType(response.data.mimetype);

    try {
      const result = await uploadResourceItem(
        response.data,
        'data',
        resourceType,
        request,
        uploader,
        logger,
        context,
      );

      if (result) {
        return {
          ...response,
          data: {
            url: result.url,
            entityId: result.entityId,
            storageKey: result.storageKey,
            // Preserve metadata
            filename: response.data.filename,
            mimetype: response.data.mimetype,
            size: response.data.buffer?.length,
          },
          // Backward compatibility fields
          entityId: result.entityId,
          storageKey: result.storageKey,
          url: result.url,
          fileId: result.fileId,
        };
      }
    } catch (error) {
      logger.error(
        `Failed to upload binary response: ${(error as Error).message}`,
        (error as Error).stack,
      );
      // Return original response if upload fails
      return response;
    }
  }

  // 🟢 Second layer: Process JSON response with resource fields marked in schema
  // Skip if no output resource fields configured
  if (!context.outputResourceFields || context.outputResourceFields.length === 0) {
    return response;
  }

  if (!response.data) {
    return response;
  }

  const uploadResults: UploadResult[] = [];

  // Process each output resource field
  for (const resourceField of context.outputResourceFields) {
    try {
      const value = getValueByPath(response.data, resourceField.fieldPath);

      if (!value) {
        continue;
      }

      if (resourceField.isArray) {
        // Handle array of resources
        if (!Array.isArray(value)) {
          logger.warn(
            `Expected array for resource field ${resourceField.fieldPath}, got ${typeof value}`,
          );
          continue;
        }

        const results = await uploadResourceItems(
          value,
          resourceField.fieldPath,
          resourceField.type,
          request,
          uploader,
          logger,
          context,
        );

        uploadResults.push(...results);

        // Update response data with upload results
        const updatedArray = results.map((result) => ({
          url: result.url,
          entityId: result.entityId,
          storageKey: result.storageKey,
        }));
        setValueByPath(response.data, resourceField.fieldPath, updatedArray);
      } else {
        // Handle single resource
        const result = await uploadResourceItem(
          value,
          resourceField.fieldPath,
          resourceField.type,
          request,
          uploader,
          logger,
          context,
        );

        if (result) {
          uploadResults.push(result);

          // Update response data with upload result
          setValueByPath(response.data, resourceField.fieldPath, {
            url: result.url,
            entityId: result.entityId,
            storageKey: result.storageKey,
          });
        }
      }
    } catch (error) {
      logger.error(
        `Failed to upload resource field ${resourceField.fieldPath}: ${(error as Error).message}`,
      );
      // Continue processing other fields even if one fails
    }
  }

  // Add upload results to response
  return {
    ...response,
    uploadResults: uploadResults.length > 0 ? uploadResults : undefined,
    // For backward compatibility, set single resource fields
    ...(uploadResults.length === 1 && {
      entityId: uploadResults[0].entityId,
      storageKey: uploadResults[0].storageKey,
      url: uploadResults[0].url,
      fileId: uploadResults[0].fileId,
    }),
  };
}

/**
 * Sync canvas nodes and ActionResult
 * Called after resource upload is complete
 */
async function syncCanvasNodes(
  response: HandlerResponse,
  request: HandlerRequest,
  config: CanvasSyncConfig,
  prismaService: PrismaService,
  canvasSyncService: CanvasSyncService,
  logger: Logger,
): Promise<HandlerResponse> {
  // Skip if request failed
  if (!response.success) {
    return response;
  }

  try {
    const {
      resultType,
      getParentResultId,
      getTitle,
      getModel,
      getProviderItemId,
      getMetadata,
      user,
      createCanvasNode = true,
      updateWorkflowNode = true,
    } = config;

    const parentResultId = getParentResultId(request);
    const title = getTitle(request);

    let parentResult: any = null;
    let nodeExecutionToUpdate: { nodeExecutionId: string; nodeData: CanvasNode } | null = null;
    let targetId = config.targetId;
    let targetType = config.targetType;

    // Step 1: Handle parent result and workflow node lookup
    if (parentResultId) {
      parentResult = await prismaService.actionResult.findFirst({
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
        nodeExecutionToUpdate = await findWorkflowNodeToUpdate(
          prismaService,
          parentResult.workflowNodeExecutionId,
          resultType,
        );
      }
    }

    // Step 2: Create ActionResult
    const actionResult = await prismaService.actionResult.create({
      data: {
        resultId: genActionResultID(),
        uid: user.uid,
        type: resultType,
        title: title,
        modelName: getModel?.(request) || parentResult?.modelName,
        targetType: targetType || parentResult?.targetType,
        targetId: targetId || parentResult?.targetId,
        providerItemId: getProviderItemId?.(request),
        status: 'executing',
        input: JSON.stringify(request.params),
        version: 0,
        parentResultId: parentResultId,
      },
    });

    // Step 3: Extract output data from response (already uploaded by base handler)
    const outputUrl = (response.url || response.data?.url) as string | undefined;
    const storageKey = (response.storageKey || response.data?.storageKey) as string | undefined;
    const metadata = getMetadata?.(request, response) || {};

    // Step 4: Update workflow node if exists
    if (nodeExecutionToUpdate && outputUrl && storageKey) {
      await updateWorkflowNodeWithResults(
        prismaService,
        nodeExecutionToUpdate,
        resultType,
        title,
        outputUrl,
        storageKey,
        metadata,
      );
    }

    // Step 5: Create canvas node if configured
    if (
      createCanvasNode &&
      actionResult.targetType === 'canvas' &&
      actionResult.targetId &&
      outputUrl &&
      storageKey
    ) {
      await createCanvasNodeForResult(
        canvasSyncService,
        user,
        actionResult,
        resultType,
        title,
        outputUrl,
        storageKey,
        parentResultId,
        metadata,
      );
    }

    // Step 6: Update ActionResult to finish
    await prismaService.actionResult.update({
      where: { pk: actionResult.pk },
      data: {
        status: 'finish',
        outputUrl,
        storageKey,
      },
    });

    // Step 7: Add metadata to response
    return {
      ...response,
      metadata: {
        ...response.metadata,
        resultId: actionResult.resultId,
        actionResultPk: actionResult.pk,
      },
    };
  } catch (error) {
    logger.error(`Canvas sync failed: ${(error as Error).message}`, (error as Error).stack);
    // Don't fail the request if canvas sync fails, just log it
    return response;
  }
}

/**
 * Find workflow node execution to update
 */
async function findWorkflowNodeToUpdate(
  prismaService: PrismaService,
  workflowNodeExecutionId: string,
  resultType: string,
): Promise<{ nodeExecutionId: string; nodeData: CanvasNode } | null> {
  const nodeExecution = await prismaService.workflowNodeExecution.findUnique({
    where: { nodeExecutionId: workflowNodeExecutionId },
  });

  if (!nodeExecution?.childNodeIds) {
    return null;
  }

  const childNodeIds = safeParseJSON(nodeExecution.childNodeIds) as string[];
  const mediaNodeExecution = await prismaService.workflowNodeExecution.findFirst({
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
async function updateWorkflowNodeWithResults(
  prismaService: PrismaService,
  nodeExecutionToUpdate: { nodeExecutionId: string; nodeData: CanvasNode },
  resultType: string,
  title: string,
  outputUrl: string,
  storageKey: string,
  customMetadata: Record<string, any> = {},
): Promise<void> {
  await prismaService.workflowNodeExecution.update({
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
 * Create canvas node for the execution result
 */
async function createCanvasNodeForResult(
  canvasSyncService: CanvasSyncService,
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
  await canvasSyncService.addNodeToCanvas(
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
