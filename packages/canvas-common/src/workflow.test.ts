import { describe, it, expect, beforeEach } from 'vitest';
import { executeCanvasWorkflow, WorkflowExecutor } from './workflow';
import type { CanvasState, CanvasNode, CanvasEdge, CanvasNodeType } from '@refly/openapi-schema';

// Use a valid CanvasNodeType for tests
const TEST_NODE_TYPE: CanvasNodeType = 'document';

// Helper to create a minimal CanvasNode
const createNode = (id: string, metadata: Record<string, any> = {}): CanvasNode => ({
  id,
  type: TEST_NODE_TYPE,
  position: { x: 0, y: 0 },
  data: { title: `Node ${id}`, entityId: id, metadata },
});

// Helper to create a minimal CanvasEdge
const createEdge = (
  id: string,
  source: string,
  target: string,
  extra: Partial<CanvasEdge> = {},
): CanvasEdge => ({
  id,
  source,
  target,
  type: 'default',
  ...extra,
});

// Helper to create a minimal CanvasState
const createCanvasState = (nodes: CanvasNode[], edges: CanvasEdge[]): CanvasState => ({
  nodes,
  edges,
  transactions: [],
});

describe('WorkflowExecutor', () => {
  describe('executeWorkflow', () => {
    it('should execute a simple linear workflow', async () => {
      const nodes = [
        createNode('A', { title: 'Start Node' }),
        createNode('B', { title: 'Process Node' }),
        createNode('C', { title: 'End Node' }),
      ];
      const edges = [createEdge('e1', 'A', 'B'), createEdge('e2', 'B', 'C')];
      const canvasState = createCanvasState(nodes, edges);

      const result = await executeCanvasWorkflow(canvasState);

      expect(result.success).toBe(true);
      expect(result.executedNodes).toEqual(['A', 'B', 'C']);
      expect(result.error).toBeUndefined();
    });

    it('should execute a parallel workflow', async () => {
      const nodes = [
        createNode('start', { title: 'Start Node' }),
        createNode('branch1', { title: 'Branch 1' }),
        createNode('branch2', { title: 'Branch 2' }),
        createNode('end', { title: 'End Node' }),
      ];
      const edges = [
        createEdge('e1', 'start', 'branch1'),
        createEdge('e2', 'start', 'branch2'),
        createEdge('e3', 'branch1', 'end'),
        createEdge('e4', 'branch2', 'end'),
      ];
      const canvasState = createCanvasState(nodes, edges);

      const result = await executeCanvasWorkflow(canvasState);

      expect(result.success).toBe(true);
      expect(result.executedNodes).toContain('start');
      expect(result.executedNodes).toContain('branch1');
      expect(result.executedNodes).toContain('branch2');
      expect(result.executedNodes).toContain('end');
      expect(result.executedNodes.length).toBe(4);
    });

    it('should handle workflow with no start nodes', async () => {
      const nodes = [createNode('A', { title: 'Node A' }), createNode('B', { title: 'Node B' })];
      const edges = [
        createEdge('e1', 'A', 'B'),
        createEdge('e2', 'B', 'A'), // Creates a cycle
      ];
      const canvasState = createCanvasState(nodes, edges);

      const result = await executeCanvasWorkflow(canvasState);

      expect(result.success).toBe(false);
      expect(result.executedNodes).toEqual([]);
      expect(result.error).toBe('No start nodes found');
    });

    it('should handle empty workflow', async () => {
      const canvasState = createCanvasState([], []);

      const result = await executeCanvasWorkflow(canvasState);

      expect(result.success).toBe(false);
      expect(result.executedNodes).toEqual([]);
      expect(result.error).toBe('No start nodes found');
    });

    it('should handle single node workflow', async () => {
      const nodes = [createNode('A', { title: 'Single Node' })];
      const canvasState = createCanvasState(nodes, []);

      const result = await executeCanvasWorkflow(canvasState);

      expect(result.success).toBe(true);
      expect(result.executedNodes).toEqual(['A']);
    });

    it('should handle complex workflow with multiple paths', async () => {
      const nodes = [
        createNode('A', { title: 'Start' }),
        createNode('B', { title: 'Branch 1' }),
        createNode('C', { title: 'Branch 2' }),
        createNode('D', { title: 'Merge 1' }),
        createNode('E', { title: 'Merge 2' }),
        createNode('F', { title: 'End' }),
      ];
      const edges = [
        createEdge('e1', 'A', 'B'),
        createEdge('e2', 'A', 'C'),
        createEdge('e3', 'B', 'D'),
        createEdge('e4', 'C', 'E'),
        createEdge('e5', 'D', 'F'),
        createEdge('e6', 'E', 'F'),
      ];
      const canvasState = createCanvasState(nodes, edges);

      const result = await executeCanvasWorkflow(canvasState);

      expect(result.success).toBe(true);
      expect(result.executedNodes).toContain('A');
      expect(result.executedNodes).toContain('B');
      expect(result.executedNodes).toContain('C');
      expect(result.executedNodes).toContain('D');
      expect(result.executedNodes).toContain('E');
      expect(result.executedNodes).toContain('F');
      expect(result.executedNodes.length).toBe(6);
    });
  });

  describe('WorkflowExecutor class methods', () => {
    let executor: WorkflowExecutor;

    beforeEach(() => {
      executor = new WorkflowExecutor();
    });

    it('should build workflow graph correctly', async () => {
      const nodes = [createNode('A', { title: 'Start' }), createNode('B', { title: 'Process' })];
      const edges = [createEdge('e1', 'A', 'B')];
      const canvasState = createCanvasState(nodes, edges);

      const result = await executor.executeWorkflow(canvasState);

      expect(result.success).toBe(true);
      expect(result.executedNodes).toEqual(['A', 'B']);
    });

    it('should get workflow status correctly', async () => {
      const nodes = [createNode('A', { title: 'Start' }), createNode('B', { title: 'Process' })];
      const edges = [createEdge('e1', 'A', 'B')];
      const canvasState = createCanvasState(nodes, edges);

      // Execute workflow first
      await executor.executeWorkflow(canvasState);

      const status = executor.getWorkflowStatus();
      expect(status.totalNodes).toBe(2);
      expect(status.executedNodes).toBe(2);
      expect(status.executingNodes).toBe(0);
      expect(status.waitingNodes).toBe(0);
      expect(status.failedNodes).toBe(0);
    });

    it('should handle nodes with no dependencies', async () => {
      const nodes = [
        createNode('A', { title: 'Independent Node 1' }),
        createNode('B', { title: 'Independent Node 2' }),
      ];
      const canvasState = createCanvasState(nodes, []);

      const result = await executor.executeWorkflow(canvasState);

      expect(result.success).toBe(true);
      expect(result.executedNodes).toContain('A');
      expect(result.executedNodes).toContain('B');
      expect(result.executedNodes.length).toBe(2);
    });

    it('should handle disconnected components', async () => {
      const nodes = [
        createNode('A', { title: 'Component 1 Start' }),
        createNode('B', { title: 'Component 1 End' }),
        createNode('C', { title: 'Component 2 Start' }),
        createNode('D', { title: 'Component 2 End' }),
      ];
      const edges = [createEdge('e1', 'A', 'B'), createEdge('e2', 'C', 'D')];
      const canvasState = createCanvasState(nodes, edges);

      const result = await executor.executeWorkflow(canvasState);

      expect(result.success).toBe(true);
      expect(result.executedNodes).toContain('A');
      expect(result.executedNodes).toContain('B');
      expect(result.executedNodes).toContain('C');
      expect(result.executedNodes).toContain('D');
      expect(result.executedNodes.length).toBe(4);
    });
  });

  describe('Node type execution', () => {
    it('should execute skill nodes with proper context', async () => {
      const nodes = [
        createNode('skill-1', { title: 'Test Skill', type: 'skill' }),
        createNode('response-1', { title: 'Test Response', type: 'response' }),
      ];
      const edges = [createEdge('e1', 'skill-1', 'response-1')];
      const canvasState = createCanvasState(nodes, edges);

      const result = await executeCanvasWorkflow(canvasState);

      expect(result.success).toBe(true);
      expect(result.executedNodes).toContain('skill-1');
      expect(result.executedNodes).toContain('response-1');
    });

    it('should execute different node types correctly', async () => {
      const nodes = [
        createNode('doc-1', { title: 'Test Document', type: 'document' }),
        createNode('resource-1', { title: 'Test Resource', type: 'resource' }),
        createNode('code-1', { title: 'Test Code', type: 'codeArtifact' }),
        createNode('tool-1', { title: 'Test Tool', type: 'tool' }),
      ];
      const canvasState = createCanvasState(nodes, []);

      const result = await executeCanvasWorkflow(canvasState);

      expect(result.success).toBe(true);
      expect(result.executedNodes).toContain('doc-1');
      expect(result.executedNodes).toContain('resource-1');
      expect(result.executedNodes).toContain('code-1');
      expect(result.executedNodes).toContain('tool-1');
    });

    it('should handle skill nodes with context building', async () => {
      const nodes = [createNode('skill-1', { title: 'Process workflow step', type: 'skill' })];
      const canvasState = createCanvasState(nodes, []);

      const executor = new WorkflowExecutor();
      const result = await executor.executeWorkflow(canvasState);

      expect(result.success).toBe(true);
      expect(result.executedNodes).toContain('skill-1');
    });
  });

  describe('Error handling', () => {
    it('should handle execution errors gracefully', async () => {
      const nodes = [createNode('A', { title: 'Error Node' })];
      const canvasState = createCanvasState(nodes, []);

      // Mock the NodeExecutor's executeNode method to throw an error
      const executor = new WorkflowExecutor();
      (executor as any).nodeExecutor.executeNode = async () => {
        throw new Error('Simulated execution error');
      };

      const result = await executor.executeWorkflow(canvasState);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Simulated execution error');
      expect(result.executedNodes).toEqual([]);
    });

    it('should handle invalid canvas state', async () => {
      const invalidCanvasState = {
        nodes: null,
        edges: [],
        transactions: [],
      } as any;

      const result = await executeCanvasWorkflow(invalidCanvasState);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Execution order', () => {
    it('should execute nodes in correct dependency order', async () => {
      const nodes = [
        createNode('A', { title: 'Root' }),
        createNode('B', { title: 'Child 1' }),
        createNode('C', { title: 'Child 2' }),
        createNode('D', { title: 'Grandchild' }),
      ];
      const edges = [
        createEdge('e1', 'A', 'B'),
        createEdge('e2', 'A', 'C'),
        createEdge('e3', 'B', 'D'),
      ];
      const canvasState = createCanvasState(nodes, edges);

      const result = await executeCanvasWorkflow(canvasState);

      expect(result.success).toBe(true);
      expect(result.executedNodes).toEqual(['A', 'B', 'C', 'D']);
    });

    it('should handle multiple start nodes', async () => {
      const nodes = [
        createNode('A', { title: 'Start 1' }),
        createNode('B', { title: 'Start 2' }),
        createNode('C', { title: 'Merge' }),
      ];
      const edges = [createEdge('e1', 'A', 'C'), createEdge('e2', 'B', 'C')];
      const canvasState = createCanvasState(nodes, edges);

      const result = await executeCanvasWorkflow(canvasState);

      expect(result.success).toBe(true);
      expect(result.executedNodes).toContain('A');
      expect(result.executedNodes).toContain('B');
      expect(result.executedNodes).toContain('C');
      expect(result.executedNodes.length).toBe(3);
    });
  });
});
