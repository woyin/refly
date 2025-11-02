// import { describe, it, expect } from 'vitest';
// import { generateCanvasDataFromWorkflowPlan } from './workflow-plan';

// // Helper to create a minimal task
// const createTask = (
//   id: string,
//   title: string,
//   prompt: string,
//   options: {
//     products?: Array<{ id: string; type: string; title: string }>;
//     contextItems?: Array<{ id: string; type: 'task' | 'product' }>;
//     selectedToolsets?: Array<{ key: string; tools: string[] }>;
//   } = {},
// ) => ({
//   id,
//   title,
//   prompt,
//   ...options,
// });

// // Helper to create a workflow plan
// const createWorkflowPlan = (tasks: any[], variables: any[] = []) => ({
//   tasks,
//   variables,
// });

// describe('generateCanvasDataFromWorkflowPlan', () => {
//   it('should return empty canvas data when workflow plan has no tasks', () => {
//     const workflowPlan = createWorkflowPlan([]);
//     const result = generateCanvasDataFromWorkflowPlan(workflowPlan);

//     expect(result).toEqual({ nodes: [], edges: [] });
//   });

//   it('should create task nodes with correct properties', () => {
//     const task = createTask('task-1', 'Test Task', 'Test prompt');
//     const workflowPlan = createWorkflowPlan([task]);
//     const result = generateCanvasDataFromWorkflowPlan(workflowPlan);

//     expect(result.nodes).toHaveLength(1);
//     const taskNode = result.nodes[0];

//     expect(taskNode.type).toBe('skillResponse');
//     expect(taskNode.position).toEqual({ x: 0, y: 0 });
//     expect(taskNode.data?.title).toBe('Test Task');
//     expect(taskNode.data?.contentPreview).toBe('');
//     expect((taskNode.data?.metadata?.structuredData as any)?.query).toBe('Test prompt');
//     expect(taskNode.data?.metadata?.contextItems).toEqual([]);
//   });

//   it('should create task nodes with toolsets metadata', () => {
//     const selectedToolsets = [
//       { key: 'toolset1', tools: ['tool1', 'tool2'] },
//       { key: 'toolset2', tools: ['tool3'] },
//     ];
//     const task = createTask('task-1', 'Test Task', 'Test prompt', { selectedToolsets });
//     const workflowPlan = createWorkflowPlan([task]);
//     const result = generateCanvasDataFromWorkflowPlan(workflowPlan);

//     const taskNode = result.nodes[0];
//     expect(taskNode.data?.metadata?.selectedToolsets).toHaveLength(2);
//     const toolsets = taskNode.data?.metadata?.selectedToolsets as any[];
//     expect(toolsets[0]).toEqual({
//       type: 'regular',
//       id: 'toolset1',
//       name: 'toolset1',
//       selectedTools: ['tool1', 'tool2'],
//     });
//     expect(toolsets[1]).toEqual({
//       type: 'regular',
//       id: 'toolset2',
//       name: 'toolset2',
//       selectedTools: ['tool3'],
//     });
//   });

//   it('should handle empty toolsets array', () => {
//     const task = createTask('task-1', 'Test Task', 'Test prompt', { selectedToolsets: [] });
//     const workflowPlan = createWorkflowPlan([task]);
//     const result = generateCanvasDataFromWorkflowPlan(workflowPlan);

//     const taskNode = result.nodes[0];
//     expect(taskNode.data?.metadata?.selectedToolsets).toEqual([]);
//   });

//   it('should filter out toolsets without key', () => {
//     const selectedToolsets = [
//       { key: 'valid', tools: ['tool1'] },
//       { key: undefined as any, tools: ['tool2'] }, // Missing key
//       { key: '', tools: ['tool3'] }, // Empty key
//     ];
//     const task = createTask('task-1', 'Test Task', 'Test prompt', { selectedToolsets });
//     const workflowPlan = createWorkflowPlan([task]);
//     const result = generateCanvasDataFromWorkflowPlan(workflowPlan);

//     const taskNode = result.nodes[0];
//     expect(taskNode.data?.metadata?.selectedToolsets).toHaveLength(1);
//     const toolsets = taskNode.data?.metadata?.selectedToolsets as any[];
//     expect(toolsets[0].id).toBe('valid');
//   });

//   it('should create product nodes with correct properties and position', () => {
//     const products = [
//       { id: 'prod-1', type: 'document', title: 'Document Product' },
//       { id: 'prod-2', type: 'codeArtifact', title: 'Code Product' },
//     ];
//     const task = createTask('task-1', 'Test Task', 'Test prompt', { products });
//     const workflowPlan = createWorkflowPlan([task]);
//     const result = generateCanvasDataFromWorkflowPlan(workflowPlan);

//     expect(result.nodes).toHaveLength(3); // 1 task + 2 products

//     const productNodes = result.nodes.slice(1);
//     expect(productNodes[0].type).toBe('document');
//     expect(productNodes[0].position).toEqual({ x: 480, y: 0 });
//     expect(productNodes[0].data?.title).toBe('Document Product');
//     expect(productNodes[0].data?.metadata?.parentResultId).toBe(result.nodes[0].data?.entityId);

//     expect(productNodes[1].type).toBe('codeArtifact');
//     expect(productNodes[1].position).toEqual({ x: 480, y: 180 });
//   });

//   it('should create edges between tasks and their products', () => {
//     const products = [{ id: 'prod-1', type: 'document', title: 'Product' }];
//     const task = createTask('task-1', 'Test Task', 'Test prompt', { products });
//     const workflowPlan = createWorkflowPlan([task]);
//     const result = generateCanvasDataFromWorkflowPlan(workflowPlan);

//     expect(result.edges).toHaveLength(1);
//     const edge = result.edges[0];

//     expect(edge.source).toBe(result.nodes[0].id); // Task node
//     expect(edge.target).toBe(result.nodes[1].id); // Product node
//     expect(edge.type).toBe('default');
//   });

//   it('should create edges from context items to tasks', () => {
//     const task1 = createTask('task-1', 'Task 1', 'Prompt 1');
//     const contextItems = [
//       { id: 'task-1', type: 'task' as const },
//       { id: 'prod-1', type: 'product' as const },
//     ];
//     const task2 = createTask('task-2', 'Task 2', 'Prompt 2', { contextItems });
//     const products = [{ id: 'prod-1', type: 'document', title: 'Product' }];
//     task1.products = products;

//     const workflowPlan = createWorkflowPlan([task1, task2]);
//     const result = generateCanvasDataFromWorkflowPlan(workflowPlan);

//     expect(result.edges).toHaveLength(3); // 1 task-to-product + 2 context-to-task (task + product)

//     // Should have edge from task1 to task2 (context reference)
//     const taskContextEdge = result.edges.find(
//       (e) => e.source === result.nodes[0].id && e.target === result.nodes[2].id,
//     );
//     expect(taskContextEdge).toBeDefined();

//     // Should have edge from prod-1 to task2 (context reference)
//     const productContextEdge = result.edges.find(
//       (e) => e.source === result.nodes[1].id && e.target === result.nodes[2].id,
//     );
//     expect(productContextEdge).toBeDefined();
//   });

//   it('should handle context items referencing products', () => {
//     const products = [{ id: 'prod-1', type: 'document', title: 'Product' }];
//     const task1 = createTask('task-1', 'Task 1', 'Prompt 1', { products });

//     const contextItems = [{ id: 'prod-1', type: 'product' as const }];
//     const task2 = createTask('task-2', 'Task 2', 'Prompt 2', { contextItems });

//     const workflowPlan = createWorkflowPlan([task1, task2]);
//     const result = generateCanvasDataFromWorkflowPlan(workflowPlan);

//     expect(result.edges).toHaveLength(2); // task1->prod1 + prod1->task2

//     const contextEdge = result.edges.find(
//       (e) => e.source === result.nodes[1].id && e.target === result.nodes[2].id,
//     );
//     expect(contextEdge).toBeDefined();
//   });

//   it('should position multiple tasks vertically', () => {
//     const task1 = createTask('task-1', 'Task 1', 'Prompt 1');
//     const task2 = createTask('task-2', 'Task 2', 'Prompt 2');
//     const task3 = createTask('task-3', 'Task 3', 'Prompt 3');

//     const workflowPlan = createWorkflowPlan([task1, task2, task3]);
//     const result = generateCanvasDataFromWorkflowPlan(workflowPlan);

//     expect(result.nodes[0].position).toEqual({ x: 0, y: 0 });
//     expect(result.nodes[1].position).toEqual({ x: 0, y: 240 });
//     expect(result.nodes[2].position).toEqual({ x: 0, y: 480 });
//   });

//   it('should position multiple products for same task vertically', () => {
//     const products = [
//       { id: 'prod-1', type: 'document', title: 'Product 1' },
//       { id: 'prod-2', type: 'codeArtifact', title: 'Product 2' },
//       { id: 'prod-3', type: 'image', title: 'Product 3' },
//     ];
//     const task = createTask('task-1', 'Test Task', 'Test prompt', { products });
//     const workflowPlan = createWorkflowPlan([task]);
//     const result = generateCanvasDataFromWorkflowPlan(workflowPlan);

//     const productNodes = result.nodes.slice(1);
//     expect(productNodes[0].position).toEqual({ x: 480, y: 0 });
//     expect(productNodes[1].position).toEqual({ x: 480, y: 180 });
//     expect(productNodes[2].position).toEqual({ x: 480, y: 360 });
//   });

//   it('should handle missing task properties gracefully', () => {
//     const task = {
//       // Missing id, title, prompt
//     };
//     const workflowPlan = createWorkflowPlan([task]);
//     const result = generateCanvasDataFromWorkflowPlan(workflowPlan);

//     expect(result.nodes).toHaveLength(1);
//     const taskNode = result.nodes[0];

//     expect(taskNode.data?.title).toBe('');
//     expect((taskNode.data?.metadata?.structuredData as any)?.query).toBe('');
//   });

//   it('should handle missing product properties gracefully', () => {
//     const products = [
//       { id: undefined as any, type: undefined as any, title: undefined as any },
//       { id: 'prod-2', type: undefined as any, title: undefined as any },
//     ];
//     const task = createTask('task-1', 'Test Task', 'Test prompt', { products });
//     const workflowPlan = createWorkflowPlan([task]);
//     const result = generateCanvasDataFromWorkflowPlan(workflowPlan);

//     expect(result.nodes).toHaveLength(3); // 1 task + 2 products
//     const productNodes = result.nodes.slice(1);

//     expect(productNodes[0].type).toBe('document'); // default type
//     expect(productNodes[0].data?.title).toBe('');

//     expect(productNodes[1].type).toBe('document'); // default type
//     expect(productNodes[1].data?.title).toBe('');
//   });

//   it('should skip creating edges for invalid context items', () => {
//     const contextItems = [
//       { id: undefined as any, type: 'task' as any }, // missing id
//       { id: 'invalid-id', type: 'task' as any }, // non-existent id
//       { id: 'task-1', type: 'invalid' as any }, // invalid type
//     ];
//     const task = createTask('task-1', 'Test Task', 'Test prompt', { contextItems });
//     const workflowPlan = createWorkflowPlan([task]);
//     const result = generateCanvasDataFromWorkflowPlan(workflowPlan);

//     // Should only create the task node, no edges
//     expect(result.nodes).toHaveLength(1);
//     expect(result.edges).toHaveLength(0);
//   });

//   it('should handle non-array contextItems gracefully', () => {
//     const task = {
//       id: 'task-1',
//       title: 'Test Task',
//       prompt: 'Test prompt',
//       contextItems: 'not-an-array',
//     };
//     const workflowPlan = createWorkflowPlan([task]);
//     const result = generateCanvasDataFromWorkflowPlan(workflowPlan);

//     expect(result.nodes).toHaveLength(1);
//     expect(result.edges).toHaveLength(0);
//   });

//   it('should handle non-array products gracefully', () => {
//     const task = {
//       id: 'task-1',
//       title: 'Test Task',
//       prompt: 'Test prompt',
//       products: 'not-an-array',
//     };
//     const workflowPlan = createWorkflowPlan([task]);
//     const result = generateCanvasDataFromWorkflowPlan(workflowPlan);

//     expect(result.nodes).toHaveLength(1);
//     expect(result.edges).toHaveLength(0);
//   });

//   it('should handle non-array selectedToolsets gracefully', () => {
//     const task = {
//       id: 'task-1',
//       title: 'Test Task',
//       prompt: 'Test prompt',
//       selectedToolsets: 'not-an-array',
//     };
//     const workflowPlan = createWorkflowPlan([task]);
//     const result = generateCanvasDataFromWorkflowPlan(workflowPlan);

//     expect(result.nodes).toHaveLength(1);
//     const taskNode = result.nodes[0];
//     expect(taskNode.data?.metadata?.selectedToolsets).toEqual([]);
//   });

//   it('should handle non-array tasks gracefully', () => {
//     const workflowPlan = {
//       tasks: 'not-an-array' as any,
//       variables: [],
//     };
//     const result = generateCanvasDataFromWorkflowPlan(workflowPlan);

//     expect(result).toEqual({ nodes: [], edges: [] });
//   });

//   it('should generate unique IDs for all nodes and edges', () => {
//     const products = [{ id: 'prod-1', type: 'document', title: 'Product' }];
//     const task1 = createTask('task-1', 'Task 1', 'Prompt 1', { products });
//     const task2 = createTask('task-2', 'Task 2', 'Prompt 2');

//     const workflowPlan = createWorkflowPlan([task1, task2]);
//     const result = generateCanvasDataFromWorkflowPlan(workflowPlan);

//     const nodeIds = result.nodes.map((n) => n.id);
//     const edgeIds = result.edges.map((e) => e.id);

//     expect(new Set(nodeIds).size).toBe(nodeIds.length); // All node IDs unique
//     expect(new Set(edgeIds).size).toBe(edgeIds.length); // All edge IDs unique
//   });

//   it('should create complex workflow with multiple interconnected tasks', () => {
//     // Task 1 with products
//     const products1 = [
//       { id: 'doc-1', type: 'document', title: 'Research Document' },
//       { id: 'code-1', type: 'codeArtifact', title: 'Analysis Code' },
//     ];
//     const task1 = createTask('research', 'Research Task', 'Research prompt', {
//       products: products1,
//     });

//     // Task 2 that references Task 1's output
//     const contextItems2 = [
//       { id: 'research', type: 'task' as const },
//       { id: 'doc-1', type: 'product' as const },
//     ];
//     const products2 = [{ id: 'ppt-1', type: 'document', title: 'Presentation' }];
//     const task2 = createTask('presentation', 'Presentation Task', 'Create presentation', {
//       contextItems: contextItems2,
//       products: products2,
//     });

//     // Task 3 that references multiple items
//     const contextItems3 = [
//       { id: 'presentation', type: 'task' as const },
//       { id: 'code-1', type: 'product' as const },
//       { id: 'ppt-1', type: 'product' as const },
//     ];
//     const task3 = createTask('review', 'Review Task', 'Review all outputs', {
//       contextItems: contextItems3,
//     });

//     const workflowPlan = createWorkflowPlan([task1, task2, task3]);
//     const result = generateCanvasDataFromWorkflowPlan(workflowPlan);

//     // Should have: 3 tasks + 3 products = 6 nodes
//     expect(result.nodes).toHaveLength(6);

//     // Should have edges: task1->doc-1, task1->code-1, research->presentation, doc-1->presentation, presentation->ppt-1, presentation->review, code-1->review, ppt-1->review
//     expect(result.edges).toHaveLength(8);

//     // Verify task nodes
//     const taskNodes = result.nodes.filter((n) => n.type === 'skillResponse');
//     expect(taskNodes).toHaveLength(3);

//     // Verify product nodes
//     const productNodes = result.nodes.filter((n) => n.type !== 'skillResponse');
//     expect(productNodes).toHaveLength(3);
//     expect(productNodes.map((n) => n.type)).toEqual(['document', 'codeArtifact', 'document']);
//   });
// });
