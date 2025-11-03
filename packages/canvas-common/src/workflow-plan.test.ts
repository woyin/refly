import { describe, it, expect } from 'vitest';
import { generateCanvasDataFromWorkflowPlan } from './workflow-plan';

// Helper to create a minimal task
const createTask = (
  id: string,
  title: string,
  prompt: string,
  options: {
    products?: string[];
    dependentTasks?: string[];
    dependentProducts?: string[];
    toolsets?: string[];
  } = {},
) => ({
  id,
  title,
  prompt,
  ...options,
});

// Helper to create a workflow plan
const createWorkflowPlan = (
  tasks: any[],
  products: Array<{ id: string; type: any; title: string }> = [],
  variables: any[] = [],
) => ({
  tasks,
  products,
  variables,
});

// Helper to create available toolsets
const createToolsets = (
  toolsets: Array<{ id: string; name: string; type?: string; selectedTools?: string[] }>,
) =>
  toolsets.map((t) => ({
    id: t.id,
    name: t.name,
    type: (t.type ?? 'regular') as 'regular' | 'mcp',
    selectedTools: t.selectedTools ?? [],
  }));

describe('generateCanvasDataFromWorkflowPlan', () => {
  it('should return empty canvas data when workflow plan has no tasks', () => {
    const workflowPlan = createWorkflowPlan([]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    expect(result).toEqual({ nodes: [], edges: [] });
  });

  it('should create task nodes with correct properties', () => {
    const task = createTask('task-1', 'Test Task', 'Test prompt');
    const workflowPlan = createWorkflowPlan([task]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    expect(result.nodes).toHaveLength(1);
    const taskNode = result.nodes[0];

    expect(taskNode.type).toBe('skillResponse');
    expect(taskNode.position).toEqual({ x: 0, y: 0 });
    expect(taskNode.data?.title).toBe('Test Task');
    expect(taskNode.data?.contentPreview).toBe('');
    expect((taskNode.data?.metadata?.structuredData as any)?.query).toBe('Test prompt');
    expect(taskNode.data?.metadata?.contextItems).toEqual([]);
  });

  it('should create task nodes with toolsets metadata', () => {
    const toolsets = createToolsets([
      { id: 'toolset1', name: 'Toolset 1', selectedTools: ['tool1', 'tool2'] },
      { id: 'toolset2', name: 'Toolset 2', selectedTools: ['tool3'] },
    ]);
    const task = createTask('task-1', 'Test Task', 'Test prompt', {
      toolsets: ['toolset1', 'toolset2'],
    });
    const workflowPlan = createWorkflowPlan([task]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, toolsets);

    const taskNode = result.nodes[0];
    expect(taskNode.data?.metadata?.selectedToolsets).toHaveLength(2);
    const selectedToolsets = taskNode.data?.metadata?.selectedToolsets as any[];
    expect(selectedToolsets[0]).toEqual({
      type: 'regular',
      id: 'toolset1',
      name: 'Toolset 1',
      selectedTools: ['tool1', 'tool2'],
    });
    expect(selectedToolsets[1]).toEqual({
      type: 'regular',
      id: 'toolset2',
      name: 'Toolset 2',
      selectedTools: ['tool3'],
    });
  });

  it('should handle empty toolsets array', () => {
    const task = createTask('task-1', 'Test Task', 'Test prompt', { toolsets: [] });
    const workflowPlan = createWorkflowPlan([task]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    const taskNode = result.nodes[0];
    expect(taskNode.data?.metadata?.selectedToolsets).toEqual([]);
  });

  it('should filter out toolsets not found in available toolsets', () => {
    const availableToolsets = createToolsets([
      { id: 'valid', name: 'Valid Toolset', selectedTools: ['tool1'] },
    ]);
    const task = createTask('task-1', 'Test Task', 'Test prompt', {
      toolsets: ['valid', 'invalid'],
    });
    const workflowPlan = createWorkflowPlan([task]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, availableToolsets);

    const taskNode = result.nodes[0];
    expect(taskNode.data?.metadata?.selectedToolsets).toHaveLength(1);
    const selectedToolsets = taskNode.data?.metadata?.selectedToolsets as any[];
    expect(selectedToolsets[0].id).toBe('valid');
  });

  it('should create product nodes with correct properties and position', () => {
    const planProducts = [
      { id: 'prod-1', type: 'document', title: 'Document Product' },
      { id: 'prod-2', type: 'codeArtifact', title: 'Code Product' },
    ];
    const task = createTask('task-1', 'Test Task', 'Test prompt', {
      products: ['prod-1', 'prod-2'],
    });
    const workflowPlan = createWorkflowPlan([task], planProducts);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    expect(result.nodes).toHaveLength(3); // 1 task + 2 products

    const productNodes = result.nodes.slice(1);
    expect(productNodes[0].type).toBe('document');
    expect(productNodes[0].position).toEqual({ x: 480, y: 0 });
    expect(productNodes[0].data?.title).toBe('Document Product');
    expect(productNodes[0].data?.metadata?.parentResultId).toBe(result.nodes[0].data?.entityId);

    expect(productNodes[1].type).toBe('codeArtifact');
    expect(productNodes[1].position).toEqual({ x: 480, y: 180 });
  });

  it('should create edges between tasks and their products', () => {
    const planProducts = [{ id: 'prod-1', type: 'document', title: 'Product' }];
    const task = createTask('task-1', 'Test Task', 'Test prompt', { products: ['prod-1'] });
    const workflowPlan = createWorkflowPlan([task], planProducts);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    expect(result.edges).toHaveLength(1);
    const edge = result.edges[0];

    expect(edge.source).toBe(result.nodes[0].id); // Task node
    expect(edge.target).toBe(result.nodes[1].id); // Product node
    expect(edge.type).toBe('default');
  });

  it('should create edges from dependent tasks and products to tasks', () => {
    const planProducts = [{ id: 'prod-1', type: 'document', title: 'Product' }];
    const task1 = createTask('task-1', 'Task 1', 'Prompt 1', { products: ['prod-1'] });
    const task2 = createTask('task-2', 'Task 2', 'Prompt 2', {
      dependentTasks: ['task-1'],
      dependentProducts: ['prod-1'],
    });

    const workflowPlan = createWorkflowPlan([task1, task2], planProducts);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    expect(result.edges).toHaveLength(3); // 1 task-to-product + 2 dependency edges (task + product)

    // Should have edge from task1 to task2 (dependent task)
    const taskDependencyEdge = result.edges.find(
      (e) => e.source === result.nodes[0].id && e.target === result.nodes[2].id,
    );
    expect(taskDependencyEdge).toBeDefined();

    // Should have edge from prod-1 to task2 (dependent product)
    const productDependencyEdge = result.edges.find(
      (e) => e.source === result.nodes[1].id && e.target === result.nodes[2].id,
    );
    expect(productDependencyEdge).toBeDefined();
  });

  it('should handle dependent products', () => {
    const planProducts = [{ id: 'prod-1', type: 'document', title: 'Product' }];
    const task1 = createTask('task-1', 'Task 1', 'Prompt 1', { products: ['prod-1'] });
    const task2 = createTask('task-2', 'Task 2', 'Prompt 2', { dependentProducts: ['prod-1'] });

    const workflowPlan = createWorkflowPlan([task1, task2], planProducts);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    expect(result.edges).toHaveLength(2); // task1->prod1 + prod1->task2

    const contextEdge = result.edges.find(
      (e) => e.source === result.nodes[1].id && e.target === result.nodes[2].id,
    );
    expect(contextEdge).toBeDefined();
  });

  it('should position multiple tasks vertically', () => {
    const task1 = createTask('task-1', 'Task 1', 'Prompt 1');
    const task2 = createTask('task-2', 'Task 2', 'Prompt 2');
    const task3 = createTask('task-3', 'Task 3', 'Prompt 3');

    const workflowPlan = createWorkflowPlan([task1, task2, task3]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    expect(result.nodes[0].position).toEqual({ x: 0, y: 0 });
    expect(result.nodes[1].position).toEqual({ x: 0, y: 240 });
    expect(result.nodes[2].position).toEqual({ x: 0, y: 480 });
  });

  it('should position multiple products for same task vertically', () => {
    const planProducts = [
      { id: 'prod-1', type: 'document', title: 'Product 1' },
      { id: 'prod-2', type: 'codeArtifact', title: 'Product 2' },
      { id: 'prod-3', type: 'image', title: 'Product 3' },
    ];
    const task = createTask('task-1', 'Test Task', 'Test prompt', {
      products: ['prod-1', 'prod-2', 'prod-3'],
    });
    const workflowPlan = createWorkflowPlan([task], planProducts);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    const productNodes = result.nodes.slice(1);
    expect(productNodes[0].position).toEqual({ x: 480, y: 0 });
    expect(productNodes[1].position).toEqual({ x: 480, y: 180 });
    expect(productNodes[2].position).toEqual({ x: 480, y: 360 });
  });

  it('should handle missing task properties gracefully', () => {
    const task = {
      // Missing id, title, prompt
    };
    const workflowPlan = createWorkflowPlan([task]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    expect(result.nodes).toHaveLength(1);
    const taskNode = result.nodes[0];

    expect(taskNode.data?.title).toBe('');
    expect((taskNode.data?.metadata?.structuredData as any)?.query).toBe('');
  });

  it('should skip products not found in plan products', () => {
    const planProducts = [{ id: 'prod-1', type: 'document', title: 'Product 1' }];
    const task = createTask('task-1', 'Test Task', 'Test prompt', {
      products: ['prod-1', 'missing-prod'],
    });
    const workflowPlan = createWorkflowPlan([task], planProducts);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    expect(result.nodes).toHaveLength(2); // 1 task + 1 found product
    const productNodes = result.nodes.slice(1);

    expect(productNodes[0].type).toBe('document');
    expect(productNodes[0].data?.title).toBe('Product 1');
  });

  it('should skip creating edges for invalid dependent tasks/products', () => {
    const task = createTask('task-1', 'Test Task', 'Test prompt', {
      dependentTasks: ['invalid-id'], // non-existent task id
      dependentProducts: ['invalid-product'], // non-existent product id
    });
    const workflowPlan = createWorkflowPlan([task]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    // Should only create the task node, no edges
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });

  it('should handle non-array dependentTasks/dependentProducts gracefully', () => {
    const task = {
      id: 'task-1',
      title: 'Test Task',
      prompt: 'Test prompt',
      dependentTasks: 'not-an-array',
      dependentProducts: 'not-an-array',
    };
    const workflowPlan = createWorkflowPlan([task]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });

  it('should handle non-array products gracefully', () => {
    const task = {
      id: 'task-1',
      title: 'Test Task',
      prompt: 'Test prompt',
      products: 'not-an-array',
    };
    const workflowPlan = createWorkflowPlan([task]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });

  it('should handle non-array toolsets gracefully', () => {
    const task = {
      id: 'task-1',
      title: 'Test Task',
      prompt: 'Test prompt',
      toolsets: 'not-an-array',
    };
    const workflowPlan = createWorkflowPlan([task]);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    expect(result.nodes).toHaveLength(1);
    const taskNode = result.nodes[0];
    expect(taskNode.data?.metadata?.selectedToolsets).toEqual([]);
  });

  it('should create complex workflow with multiple interconnected tasks', () => {
    // Plan-level products
    const planProducts = [
      { id: 'doc-1', type: 'document', title: 'Research Document' },
      { id: 'code-1', type: 'codeArtifact', title: 'Analysis Code' },
      { id: 'ppt-1', type: 'document', title: 'Presentation' },
    ];

    // Task 1 with products
    const task1 = createTask('research', 'Research Task', 'Research prompt', {
      products: ['doc-1', 'code-1'],
    });

    // Task 2 that references Task 1's output
    const task2 = createTask('presentation', 'Presentation Task', 'Create presentation', {
      dependentTasks: ['research'],
      dependentProducts: ['doc-1'],
      products: ['ppt-1'],
    });

    // Task 3 that references multiple items
    const task3 = createTask('review', 'Review Task', 'Review all outputs', {
      dependentTasks: ['presentation'],
      dependentProducts: ['code-1', 'ppt-1'],
    });

    const workflowPlan = createWorkflowPlan([task1, task2, task3], planProducts);
    const result = generateCanvasDataFromWorkflowPlan(workflowPlan, []);

    // Should have: 3 tasks + 3 products = 6 nodes
    expect(result.nodes).toHaveLength(6);

    // Should have edges: task1->doc-1, task1->code-1, research->presentation, doc-1->presentation, presentation->ppt-1, presentation->review, code-1->review, ppt-1->review
    expect(result.edges).toHaveLength(8);

    // Verify task nodes
    const taskNodes = result.nodes.filter((n) => n.type === 'skillResponse');
    expect(taskNodes).toHaveLength(3);

    // Verify product nodes
    const productNodes = result.nodes.filter((n) => n.type !== 'skillResponse');
    expect(productNodes).toHaveLength(3);
    expect(productNodes.map((n) => n.type)).toEqual(['document', 'codeArtifact', 'document']);
  });
});
