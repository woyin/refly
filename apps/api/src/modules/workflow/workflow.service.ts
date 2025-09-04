import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  User,
  InvokeSkillRequest,
  EntityType,
  CanvasNodeType,
  CanvasNode,
  WorkflowVariable,
  NodeDiff,
} from '@refly/openapi-schema';
import {
  ResponseNodeMeta,
  CanvasNodeFilter,
  convertContextItemsToInvokeParams,
} from '@refly/canvas-common';
import { SkillService } from '../skill/skill.service';
import { CanvasService } from '../canvas/canvas.service';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import { genWorkflowExecutionID, genTransactionId, safeParseJSON } from '@refly/utils';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WorkflowNodeExecution as WorkflowNodeExecutionPO } from '../../generated/client';
import { QUEUE_SYNC_WORKFLOW, QUEUE_RUN_WORKFLOW } from '../../utils/const';
import { SkillContext } from '@refly/openapi-schema';
import { WorkflowVariableService } from './workflow-variable.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { WorkflowExecutionNotFoundError } from '@refly/errors';
import { prepareNodeExecutions } from './utils';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly skillService: SkillService,
    private readonly canvasService: CanvasService,
    private readonly canvasSyncService: CanvasSyncService,
    private readonly workflowVariableService: WorkflowVariableService,
    private readonly knowledgeService: KnowledgeService,
    @InjectQueue(QUEUE_SYNC_WORKFLOW) private readonly syncWorkflowQueue?: Queue,
    @InjectQueue(QUEUE_RUN_WORKFLOW) private readonly runWorkflowQueue?: Queue,
  ) {}

  /**
   * Enhanced: Process query with workflow variables, inject resource variables into context
   * @param query - Original query string
   * @param canvasId - Canvas ID to get workflow variables from
   * @param user - User object
   * @param context - SkillContext to inject resources into
   * @returns Processed query string with variables replaced
   */
  private async processQueryWithVariables(
    query: string,
    canvasId: string,
    user: User,
    context?: SkillContext,
  ): Promise<string> {
    try {
      // Get canvas state to retrieve workflow variables
      const variables = await this.canvasSyncService.getWorkflowVariables(user, { canvasId });
      // New method: returns the processed query and resource type variables
      const { query: processedQuery, resourceVars } =
        this.workflowVariableService.processQueryWithTypes(query, variables);
      // Process resource type variables: fetch resource and inject into context.resources
      if (resourceVars.length && context) {
        for (const variable of resourceVars) {
          const values = variable.value;
          if (!values?.length) continue;

          // Process each storage key in the array
          for (const value of values) {
            if (!value?.resource?.storageKey) continue;

            // Find resource by storage key
            const resource = await this.knowledgeService.getResourceByStorageKey(
              user,
              value.resource.storageKey,
            );
            if (resource) {
              // Bind entityId/canvasId if not already bound
              if (!resource.canvasId || resource.canvasId !== canvasId) {
                await this.knowledgeService.bindResourceToCanvas(resource.resourceId, canvasId);
              }
              // Assemble SkillContextResourceItem
              context.resources = context.resources ?? [];
              context.resources.push({
                resourceId: resource.resourceId,
                resource: {
                  resourceId: resource.resourceId,
                  title: resource.title ?? '',
                  resourceType: (resource.resourceType as any) ?? 'text',
                  content: resource.contentPreview ?? '',
                  contentPreview: resource.contentPreview ?? '',
                },
                isCurrent: true,
                metadata: { fromWorkflowVariable: variable.name },
              });
            }
          }
        }
      }
      return processedQuery;
    } catch (error) {
      this.logger.warn(`Failed to process query with variables: ${error.message}`);
      // Return original query if processing fails
      return query;
    }
  }

  /**
   * Initialize workflow execution - entry method
   * @param user - The user to create the workflow for
   * @param sourceCanvasId - The canvas ID
   * @returns Promise<string> - The execution ID
   */
  async initializeWorkflowExecution(
    user: User,
    sourceCanvasId: string,
    targetCanvasId: string,
    variables?: WorkflowVariable[],
    options?: {
      appId?: string;
      startNodes?: string[];
    },
  ): Promise<string> {
    try {
      // Add a new execution mode: if a new canvas ID is provided, create a new canvas and add nodes to it one by one as they are executed.
      // Only the node being executed will be added to the new canvas at that time.

      // Get canvas state
      const canvasData = await this.canvasSyncService.getCanvasData(user, {
        canvasId: sourceCanvasId,
      });

      // Create workflow execution record
      const executionId = genWorkflowExecutionID();
      const canvas = await this.prisma.canvas.findUnique({
        where: { canvasId: sourceCanvasId },
        select: { title: true },
      });
      const isNewCanvas = targetCanvasId !== sourceCanvasId;

      // Note: Canvas creation is now handled on the frontend to avoid version conflicts
      if (isNewCanvas) {
        await this.canvasService.createCanvas(user, {
          canvasId: targetCanvasId,
          title: canvas?.title,
        });
        await this.canvasSyncService.updateWorkflowVariables(user, {
          canvasId: targetCanvasId,
          variables,
        });
      }

      const { nodeExecutions, startNodes } = prepareNodeExecutions(executionId, canvasData, {
        startNodes: options?.startNodes ?? [],
        isNewCanvas,
      });

      await this.prisma.$transaction([
        this.prisma.workflowExecution.create({
          data: {
            executionId,
            uid: user.uid,
            canvasId: targetCanvasId,
            sourceCanvasId: sourceCanvasId,
            title: canvas?.title || 'Workflow Execution',
            status: nodeExecutions.length > 0 ? 'executing' : 'finish',
            totalNodes: nodeExecutions.length,
            appId: options?.appId,
          },
        }),
        this.prisma.workflowNodeExecution.createMany({
          data: nodeExecutions,
        }),
      ]);

      // Add start nodes to runWorkflowQueue
      if (this.runWorkflowQueue) {
        for (const startNodeId of startNodes) {
          // Find the node execution record to get the new node ID
          const nodeExecution = nodeExecutions.find((ne) => ne.nodeId === startNodeId);
          await this.runWorkflowQueue.add('runWorkflow', {
            user: { uid: user.uid },
            executionId,
            nodeId: nodeExecution.nodeId,
            isNewCanvas,
          });
        }
      }

      this.logger.log(
        `Workflow execution ${executionId} initialized with ${nodeExecutions.length} nodes`,
      );
      return executionId;
    } catch (error) {
      this.logger.error(`Failed to initialize workflow execution: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add a node to a new canvas, when the workflow is executed in new canvas mode
   * @param user - The user to add the node to
   * @param node - The node to add
   * @param nodeExecution - The node execution to add
   * @param canvasId - The canvas ID to add the node to
   */
  private async addNodeToNewCanvas(
    user: User,
    node: CanvasNode,
    nodeExecution: WorkflowNodeExecutionPO,
    canvasId: string,
  ) {
    // Build connection filters based on parent nodes
    let connectToFilters: CanvasNodeFilter[] = [];
    const { executionId, parentNodeIds: parentNodeIdsStr } = nodeExecution;

    if (parentNodeIdsStr) {
      const parentNodeIds = (safeParseJSON(parentNodeIdsStr) ?? []) as string[];

      if (parentNodeIds.length > 0) {
        // Get all parent node executions to find their entity IDs
        const parentNodeExecutions = await this.prisma.workflowNodeExecution.findMany({
          where: {
            executionId,
            nodeId: { in: parentNodeIds },
          },
        });

        // Build connection filters based on parent entity IDs
        connectToFilters = parentNodeExecutions.map((nodeExecution) => ({
          type: nodeExecution.nodeType as CanvasNodeType,
          entityId: nodeExecution.entityId,
          handleType: 'source',
        }));
      }
    }

    // Add the new node to the new canvas using the canvas service with connection information
    await this.canvasSyncService.addNodeToCanvas(user, canvasId, node, connectToFilters);

    this.logger.log(
      `Added new node ${node.id} to canvas ${canvasId} for workflow execution ${executionId} with connections`,
    );
  }

  private async syncNodeDiffToCanvas(user: User, canvasId: string, nodeDiffs: NodeDiff[]) {
    await this.canvasSyncService.syncState(user, {
      canvasId,
      transactions: [
        {
          txId: genTransactionId(),
          createdAt: Date.now(),
          syncedAt: Date.now(),
          source: { type: 'system' },
          nodeDiffs,
          edgeDiffs: [],
        },
      ],
    });
  }

  /**
   * Process a skillResponse node and invoke the skill task
   * @param user - The user to process the node for
   * @param node - The CanvasNode to process
   * @param canvasId - The canvas ID
   * @param executionId - The workflow execution ID (optional)
   * @param newNodeId - The new node ID for new canvas mode (optional)
   * @returns Promise<void>
   */
  async executeSkillResponseNode(
    user: User,
    nodeExecution: WorkflowNodeExecutionPO,
    canvasId: string,
    isNewCanvas?: boolean,
  ): Promise<void> {
    const { nodeType, nodeData } = nodeExecution;

    // Check if the node is a skillResponse type
    if (nodeType !== 'skillResponse') {
      this.logger.warn(`Node type ${nodeType} is not skillResponse, skipping processing`);
      return;
    }

    const node = safeParseJSON(nodeData) as CanvasNode;
    const data = node?.data;
    const metadata = data?.metadata as ResponseNodeMeta;

    if (!data || !metadata) {
      this.logger.warn(
        `Node metadata is missing for node execution ${nodeExecution.nodeExecutionId}, skipping processing`,
      );
      return;
    }

    // Extract required parameters from ResponseNodeMeta
    const { modelInfo, selectedToolsets, contextItems = [] } = metadata;

    const { context, resultHistory, images } = convertContextItemsToInvokeParams(
      contextItems,
      () => resultHistory,
      () => [],
      () => [],
      () => [],
    );

    // Prefer to get query from data.metadata.structuredData?.query, fallback to data.title if not available
    const originalQuery = String(metadata?.structuredData?.query ?? data?.title ?? '');

    // Process query with workflow variables
    const processedQuery = await this.processQueryWithVariables(
      originalQuery,
      canvasId,
      user,
      context,
    );

    // Get resultId from entityId
    const resultId = nodeExecution.entityId;

    if (isNewCanvas) {
      // If it's new canvas mode, add the new node to the new canvas
      await this.addNodeToNewCanvas(user, node, nodeExecution, canvasId);
    } else {
      await this.syncNodeDiffToCanvas(user, canvasId, [
        {
          type: 'update',
          id: nodeExecution.nodeId,
          // from: node, // TODO: check if we need to pass the from
          to: {
            data: {
              title: processedQuery,
              contentPreview: '',
              metadata: {
                status: 'executing',
                structuredData: {
                  query: originalQuery, // Store original query in canvas node structuredData
                },
              },
            },
          },
        },
      ]);
    }

    // Prepare the invoke skill request
    const invokeRequest: InvokeSkillRequest = {
      resultId,
      input: {
        query: processedQuery, // Use processed query for skill execution
        originalQuery, // Pass original query separately
        images,
      },
      target: {
        entityType: 'canvas' as EntityType,
        entityId: canvasId,
      },
      modelName: modelInfo?.name,
      modelItemId: modelInfo?.providerItemId,
      context,
      resultHistory,
      toolsets: selectedToolsets,
      workflowExecutionId: nodeExecution.executionId,
      workflowNodeExecutionId: nodeExecution.nodeExecutionId,
    };

    // Send the invoke skill task
    await this.skillService.sendInvokeSkillTask(user, invokeRequest);

    this.logger.log(`Successfully sent invoke skill task for resultId: ${resultId}`);
  }

  /**
   * Sync workflow - called after skill-invoker finishes
   * @param user - The user with minimal PII (only uid)
   * @param nodeExecutionId - The node execution ID
   */
  async syncWorkflow(
    user: Pick<User, 'uid'>,
    nodeExecutionId: string,
    isNewCanvas?: boolean,
  ): Promise<void> {
    try {
      // Find the workflow node execution by nodeExecutionId
      const nodeExecution = await this.prisma.workflowNodeExecution.findUnique({
        where: {
          nodeExecutionId: nodeExecutionId,
        },
      });

      if (!nodeExecution) {
        this.logger.warn(`No node execution found for nodeExecutionId: ${nodeExecutionId}`);
        return;
      }

      // Only update if status is still executing
      if (nodeExecution.status === 'executing') {
        // Update node status to finish
        await this.prisma.workflowNodeExecution.update({
          where: { nodeExecutionId: nodeExecution.nodeExecutionId },
          data: {
            status: 'finish',
            progress: 100,
            endTime: new Date(),
          },
        });

        // Determine which canvas to update based on whether it's new canvas mode
        const targetCanvasId = nodeExecution.canvasId;
        const targetNodeId = nodeExecution.nodeId;

        await this.syncNodeDiffToCanvas(user, targetCanvasId, [
          {
            type: 'update',
            id: targetNodeId,
            from: { status: 'executing' },
            to: { status: 'finish' },
          },
        ]);
      }

      // Get all child nodes
      const childNodeIds = JSON.parse(nodeExecution.childNodeIds || '[]') as string[];

      // For each child node, check if all its parents are finished
      for (const childNodeId of childNodeIds) {
        const childNode = await this.prisma.workflowNodeExecution.findFirst({
          where: {
            executionId: nodeExecution.executionId,
            nodeId: childNodeId,
          },
        });

        if (!childNode) continue;

        // Get all parent nodes for this child
        const parentNodeIds = JSON.parse(childNode.parentNodeIds || '[]') as string[];

        // Check if all parents are finished
        const allParentsFinished =
          (await this.prisma.workflowNodeExecution.count({
            where: {
              executionId: nodeExecution.executionId,
              nodeId: { in: parentNodeIds },
              status: 'finish',
            },
          })) === parentNodeIds.length;

        // If all parents are finished and child is still waiting, add to queue
        if (allParentsFinished && childNode.status === 'waiting') {
          // Prevent duplicate queue entries by checking if already queued
          const existingJobs = await this.runWorkflowQueue?.getJobs(['waiting', 'active']);
          const isAlreadyQueued = existingJobs?.some(
            (job) =>
              job.data.executionId === nodeExecution.executionId && job.data.nodeId === childNodeId,
          );

          if (!isAlreadyQueued && this.runWorkflowQueue) {
            await this.runWorkflowQueue.add('runWorkflow', {
              user: { uid: user.uid },
              executionId: nodeExecution.executionId,
              nodeId: childNodeId,
              isNewCanvas,
            });
          }
        }
      }

      // Update workflow execution statistics
      await this.updateWorkflowExecutionStats(nodeExecution.executionId);

      this.logger.log(`Synced workflow for nodeExecutionId: ${nodeExecutionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to sync workflow for nodeExecutionId ${nodeExecutionId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Run workflow node - execute a single node
   * @param user - The user
   * @param executionId - The workflow execution ID
   * @param nodeId - The node ID to execute
   * @param newNodeId - The new node ID for new canvas mode (optional)
   */
  async runWorkflow(
    user: User,
    executionId: string,
    nodeId: string,
    isNewCanvas?: boolean,
  ): Promise<void> {
    try {
      // Get node execution record
      const nodeExecution = await this.prisma.workflowNodeExecution.findFirst({
        where: {
          executionId,
          nodeId,
        },
      });

      if (!nodeExecution) {
        this.logger.warn(
          `Node execution not found for executionId: ${executionId}, nodeId: ${nodeId}`,
        );
        return;
      }

      // Check if node is already being processed
      if (nodeExecution.status === 'executing') {
        this.logger.warn(`Node ${nodeId} is already being executed`);
        return;
      }

      // Get all parent nodes for this child
      const parentNodeIds = JSON.parse(nodeExecution.parentNodeIds || '[]') as string[];

      // Check if all parents are finished
      const allParentsFinished =
        (await this.prisma.workflowNodeExecution.count({
          where: {
            executionId: nodeExecution.executionId,
            nodeId: { in: parentNodeIds },
            status: 'finish',
          },
        })) === parentNodeIds.length;

      if (!allParentsFinished) {
        this.logger.warn(`Node ${nodeId} has unfinished parents`);
        return;
      }

      // Update node status to executing
      await this.prisma.workflowNodeExecution.update({
        where: { nodeExecutionId: nodeExecution.nodeExecutionId },
        data: {
          status: 'executing',
          startTime: new Date(),
          progress: 0,
        },
      });

      // Get canvas state to find the node
      const workflowExecution = await this.prisma.workflowExecution.findUnique({
        where: { executionId },
      });

      if (!workflowExecution) {
        throw new Error(`Workflow execution ${executionId} not found`);
      }

      // Execute node based on type
      if (nodeExecution.nodeType === 'skillResponse') {
        await this.executeSkillResponseNode(
          user,
          nodeExecution,
          workflowExecution.canvasId,
          isNewCanvas,
        );
      } else {
        // For other node types, just mark as finish for now
        await this.prisma.workflowNodeExecution.update({
          where: { nodeExecutionId: nodeExecution.nodeExecutionId },
          data: {
            status: 'finish',
            progress: 100,
            endTime: new Date(),
          },
        });
        await this.syncWorkflow(user, nodeExecution.nodeExecutionId);
      }

      this.logger.log(`Started execution of node ${nodeId} in workflow ${executionId}`);
    } catch (error) {
      // Mark node as failed
      const failedNodeExecution = await this.prisma.workflowNodeExecution.findFirst({
        where: {
          executionId,
          nodeId,
        },
      });

      if (failedNodeExecution) {
        await this.prisma.workflowNodeExecution.update({
          where: {
            nodeExecutionId: failedNodeExecution.nodeExecutionId,
          },
          data: {
            status: 'failed',
            errorMessage: error.message,
            endTime: new Date(),
          },
        });
      }

      this.logger.error(`Failed to run workflow node ${nodeId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update workflow execution statistics
   * @param executionId - The workflow execution ID
   */
  private async updateWorkflowExecutionStats(executionId: string): Promise<void> {
    const stats = await this.prisma.workflowNodeExecution.groupBy({
      by: ['status'],
      where: { executionId },
      _count: { status: true },
    });

    const executedNodes = stats.find((s) => s.status === 'finish')?._count.status || 0;
    const failedNodes = stats.find((s) => s.status === 'failed')?._count.status || 0;

    // Check if all nodes are finished
    const waitingNodes = stats.find((s) => s.status === 'waiting')?._count.status || 0;
    const executingNodes = stats.find((s) => s.status === 'executing')?._count.status || 0;

    let status = 'executing';
    if (failedNodes > 0) {
      status = 'failed';
    } else if (waitingNodes === 0 && executingNodes === 0) {
      status = 'finish';
    }

    await this.prisma.workflowExecution.update({
      where: { executionId },
      data: {
        executedNodes,
        failedNodes,
        status,
      },
    });
  }

  /**
   * Get workflow execution detail with node executions
   * @param user - The user requesting the workflow detail
   * @param executionId - The workflow execution ID
   * @returns Promise<WorkflowExecution> - The workflow execution detail
   */
  async getWorkflowDetail(user: User, executionId: string) {
    // Get workflow execution
    const workflowExecution = await this.prisma.workflowExecution.findUnique({
      where: { executionId, uid: user.uid },
    });

    if (!workflowExecution) {
      throw new WorkflowExecutionNotFoundError(`Workflow execution ${executionId} not found`);
    }

    // Get node executions
    const nodeExecutions = await this.prisma.workflowNodeExecution.findMany({
      where: { executionId },
      orderBy: { createdAt: 'asc' },
    });

    // Return workflow execution detail
    return { ...workflowExecution, nodeExecutions };
  }
}
