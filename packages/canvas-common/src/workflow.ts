import { CanvasState, CanvasNode, CanvasEdge } from '@refly/openapi-schema';
import { getCanvasDataFromState } from './sync';
import { NodeExecutor, WorkflowNode } from './node-executor';

export interface WorkflowExecutionResult {
  success: boolean;
  executedNodes: string[];
  error?: string;
}

export class WorkflowExecutor {
  private nodes: Map<string, WorkflowNode> = new Map();
  private executionQueue: string[] = [];
  private executedNodes: Set<string> = new Set();
  // Track currently executing node IDs
  private executingNodes = new Set<string>();
  // Store the current canvas state for workflow execution
  private canvasState: CanvasState | null = null;
  // Node executor for handling individual node execution
  private nodeExecutor: NodeExecutor;

  constructor() {
    this.nodeExecutor = new NodeExecutor();
  }

  /**
   * Execute workflow in canvas
   * @param canvasState - Canvas state
   * @returns Execution result
   */
  async executeWorkflow(canvasState: CanvasState): Promise<WorkflowExecutionResult> {
    try {
      // Store canvas state for context access
      this.canvasState = canvasState;
      this.nodeExecutor.setCanvasState(canvasState);

      // Get canvas data
      const canvasData = getCanvasDataFromState(canvasState);
      const { nodes, edges } = canvasData;

      // Build workflow graph
      this.buildWorkflowGraph(nodes, edges);

      // Find start nodes (nodes without parents)
      const startNodes = this.findStartNodes();
      if (startNodes.length === 0) {
        return {
          success: false,
          executedNodes: [],
          error: 'No start nodes found',
        };
      }

      // Add start nodes to execution queue
      this.executionQueue.push(...startNodes);

      // Start execution
      await this.executeNodes();

      return {
        success: true,
        executedNodes: Array.from(this.executedNodes),
      };
    } catch (error) {
      return {
        success: false,
        executedNodes: Array.from(this.executedNodes),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute nodes synchronously
   */
  private async executeNodes(): Promise<void> {
    while (this.executionQueue.length > 0) {
      const nodeId = this.executionQueue.shift()!;

      if (this.executedNodes.has(nodeId) || this.executingNodes.has(nodeId)) {
        continue;
      }

      const node = this.nodes.get(nodeId);
      if (!node) continue;

      // Check if all parent nodes are completed
      const allParentsFinished = node.parents.every((parentId) => this.executedNodes.has(parentId));

      if (!allParentsFinished) {
        // If parent nodes are not completed, add current node back to queue end
        this.executionQueue.push(nodeId);
        continue;
      }

      // Start executing node
      this.executingNodes.add(nodeId);
      node.status = 'executing';
      node.startTime = Date.now();
      node.progress = 0;

      try {
        await this.nodeExecutor.executeNode(node);

        // Mark node as completed
        node.status = 'finished';
        node.progress = 100;
        this.executedNodes.add(node.id);
        this.executingNodes.delete(node.id);

        // Add child nodes to execution queue
        for (const childId of node.children) {
          if (!this.executedNodes.has(childId) && !this.executingNodes.has(childId)) {
            this.executionQueue.push(childId);
          }
        }
      } catch (error) {
        console.error(`Node execution failed: ${node.title}`, error);
        node.status = 'failed';
        this.executingNodes.delete(nodeId);
        throw error;
      }
    }
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(): {
    totalNodes: number;
    executedNodes: number;
    executingNodes: number;
    waitingNodes: number;
    failedNodes: number;
    averageProgress: number;
  } {
    let executed = 0;
    let executing = 0;
    let waiting = 0;
    let failed = 0;
    let totalProgress = 0;
    let nodesWithProgress = 0;

    for (const node of this.nodes.values()) {
      switch (node.status) {
        case 'finished':
          executed++;
          totalProgress += 100;
          nodesWithProgress++;
          break;
        case 'executing':
          executing++;
          totalProgress += node.progress ?? 0;
          nodesWithProgress++;
          break;
        case 'failed':
          failed++;
          break;
        case 'waiting':
          waiting++;
          break;
      }
    }

    return {
      totalNodes: this.nodes.size,
      executedNodes: executed,
      executingNodes: executing,
      waitingNodes: waiting,
      failedNodes: failed,
      averageProgress: nodesWithProgress > 0 ? totalProgress / nodesWithProgress : 0,
    };
  }

  /**
   * Build workflow graph
   */
  private buildWorkflowGraph(nodes: CanvasNode[], edges: CanvasEdge[]): void {
    this.nodes.clear();

    // Initialize all nodes
    for (const node of nodes) {
      this.nodes.set(node.id, {
        id: node.id,
        type: node.type,
        entityId: node.data?.entityId || '',
        title: node.data?.title || '',
        status: 'waiting',
        children: [],
        parents: [],
        progress: 0,
      });
    }

    // Build parent-child relationships
    for (const edge of edges) {
      const sourceNode = this.nodes.get(edge.source);
      const targetNode = this.nodes.get(edge.target);

      if (sourceNode && targetNode) {
        sourceNode.children.push(targetNode.id);
        targetNode.parents.push(sourceNode.id);
      }
    }
  }

  /**
   * Find start nodes (nodes without parents)
   */
  private findStartNodes(): string[] {
    const startNodes: string[] = [];
    for (const [nodeId, node] of this.nodes) {
      if (node.parents.length === 0) {
        startNodes.push(nodeId);
      }
    }
    return startNodes;
  }
}

/**
 * Service method to execute workflow
 * @param canvasState - Canvas state
 * @returns Execution result
 */
export async function executeCanvasWorkflow(
  canvasState: CanvasState,
): Promise<WorkflowExecutionResult> {
  const executor = new WorkflowExecutor();
  return await executor.executeWorkflow(canvasState);
}
