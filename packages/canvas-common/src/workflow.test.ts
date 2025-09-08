import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CanvasData,
  CanvasNodeType,
  WorkflowVariable,
  CanvasEdge,
  GenericToolset,
  ModelInfo,
  InvokeSkillRequest,
} from '@refly/openapi-schema';
import { processQueryWithTypes, prepareNodeExecutions } from './workflow';
import { ResponseNodeMeta } from './types';
import { IContextItem } from '@refly/common-types';

// Mock id generators for deterministic outputs
let sequences = {
  nodeIds: [] as string[],
  entityIds: [] as string[],
  nodeExecutionIds: [] as string[],
};

vi.mock('@refly/utils', () => {
  let nodeIdIdx = 0;
  let entityIdIdx = 0;
  let nodeExecIdIdx = 0;

  return {
    genNodeID: vi.fn(() => sequences.nodeIds[nodeIdIdx++] ?? `nid-${nodeIdIdx}`),
    genNodeEntityId: vi.fn(() => sequences.entityIds[entityIdIdx++] ?? `eid-${entityIdIdx}`),
    genWorkflowNodeExecutionID: vi.fn(
      () => sequences.nodeExecutionIds[nodeExecIdIdx++] ?? `wne-${nodeExecIdIdx}`,
    ),
    omit: vi.fn(<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
      const result = { ...obj };
      for (const key of keys) {
        delete result[key];
      }
      return result;
    }),
    safeParseJSON: vi.fn((str: string, fallback: any = {}) => {
      try {
        return JSON.parse(str);
      } catch {
        return fallback;
      }
    }),
    getClientOrigin: vi.fn(() => 'http://localhost:3000'),
  };
});

// Helper function to set mock sequences
const setMockSequences = (s: {
  nodeIds?: string[];
  entityIds?: string[];
  nodeExecutionIds?: string[];
}) => {
  sequences = {
    nodeIds: s.nodeIds ?? [],
    entityIds: s.entityIds ?? [],
    nodeExecutionIds: s.nodeExecutionIds ?? [],
  };
};

describe('processQueryWithTypes', () => {
  it('returns original query when variables empty or query falsy', () => {
    expect(processQueryWithTypes('', [])).toBe('');
    expect(processQueryWithTypes('no vars here')).toBe('no vars here');
  });

  it('ignores resource type variables', () => {
    const query = 'find @doc ';
    const variables: WorkflowVariable[] = [
      {
        variableId: 'v1',
        name: 'doc',
        value: [
          {
            type: 'resource',
            resource: { name: 'a.pdf', fileType: 'application/pdf', storageKey: 's1' },
          },
        ],
        variableType: 'resource',
      },
    ];
    expect(processQueryWithTypes(query, variables)).toBe(query);
  });

  it('replaces string variables with text values', () => {
    const query = 'hello @name world';
    const variables: WorkflowVariable[] = [
      {
        variableId: 'v1',
        name: 'name',
        value: [{ type: 'text', text: 'Alice' }],
        variableType: 'string',
      },
    ];
    expect(processQueryWithTypes(query, variables)).toBe('hello Alice world');
  });

  it('replaces multiple occurrences and joins option values with comma', () => {
    const query = '@topic is cool. I love @topic so much';
    const variables: WorkflowVariable[] = [
      {
        variableId: 'v1',
        name: 'topic',
        value: [
          { type: 'text', text: 'TypeScript' },
          { type: 'text', text: 'React' },
        ],
        variableType: 'option',
        options: ['TypeScript', 'React'],
      },
    ];
    const expected = 'TypeScript, React is cool. I love TypeScript, React so much';
    expect(processQueryWithTypes(query, variables)).toBe(expected);
  });

  it('handles missing text values by removing the placeholder token', () => {
    const query = 'hello @name world';
    const variables: WorkflowVariable[] = [
      {
        variableId: 'v1',
        name: 'name',
        value: [{ type: 'text' }],
        variableType: 'string',
      },
    ];
    // Note: replacement keeps a single space in place of the placeholder
    expect(processQueryWithTypes(query, variables)).toBe('hello  world');
  });
});

describe('prepareNodeExecutions', () => {
  const buildCanvas = () => {
    const nodes = [
      {
        id: 'A',
        type: 'skillResponse' as CanvasNodeType,
        position: { x: 0, y: 0 },
        data: {
          title: 'Node A',
          entityId: 'entityA',
          metadata: {
            structuredData: { query: 'Hello @topic world' },
            contextItems: [],
          },
        },
      },
      {
        id: 'B',
        type: 'document' as CanvasNodeType,
        position: { x: 0, y: 0 },
        data: {
          title: 'Test Document',
          entityId: 'entityB',
        },
      },
      {
        id: 'C',
        type: 'skillResponse' as CanvasNodeType,
        position: { x: 0, y: 0 },
        data: {
          title: 'Node C',
          entityId: 'entityC',
          metadata: {
            structuredData: { query: 'No var here' },
          },
          contextItems: [{ entityId: 'entityB', type: 'document', title: 'Test Document' }],
        } as ResponseNodeMeta,
      },
    ];
    const edges = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'C' },
    ];
    return { nodes, edges } as CanvasData;
  };

  const variables: WorkflowVariable[] = [
    {
      variableId: 'v-topic',
      name: 'topic',
      value: [{ type: 'text', text: 'TypeScript' }],
      variableType: 'string',
    },
  ];

  beforeEach(() => {
    setMockSequences({
      nodeIds: ['N1', 'N2', 'N3'],
      entityIds: ['E1', 'E2', 'E3'],
      nodeExecutionIds: ['W1', 'W2', 'W3'],
    });
  });

  it('computes start nodes automatically and marks subtree nodes as waiting (isNewCanvas=false)', () => {
    const canvas = buildCanvas();
    const { nodeExecutions, startNodes } = prepareNodeExecutions({
      executionId: 'exec1',
      canvasId: 'canvas1',
      canvasData: canvas,
      variables,
      isNewCanvas: false,
    });

    expect(startNodes).toEqual(['A']);
    expect(nodeExecutions).toHaveLength(3);

    // All nodes reachable from A, so all are waiting
    expect(nodeExecutions.every((n) => n.status === 'waiting')).toBe(true);

    const byNodeId: Record<string, any> = {};
    for (const n of nodeExecutions) {
      byNodeId[n.nodeId] = n;
    }

    // Node B should connect to parent A using parent's node id (when not new canvas)
    const b = byNodeId.B;
    expect(b.connectTo).toEqual([
      { type: 'skillResponse', entityId: 'entityA', handleType: 'source' },
    ]);

    // processedQuery takes from metadata.structuredData.query or title
    const a = byNodeId.A;
    expect(a.originalQuery).toBe('Hello @topic world');
    expect(a.processedQuery).toBe('Hello TypeScript world');

    const c = byNodeId.C;
    expect(c.originalQuery).toBe('No var here');
    expect(c.processedQuery).toBe('No var here');

    // Relationship ids are unchanged when not new canvas
    expect(b.parentNodeIds).toEqual(['A']);
    expect(b.childNodeIds).toEqual(['C']);

    // Source ids preserved
    expect(a.sourceNodeId).toBe('A');
    expect(a.sourceEntityId).toBe('entityA');
  });

  it('uses provided startNodes when isNewCanvas=false', () => {
    const canvas = buildCanvas();
    const { nodeExecutions, startNodes } = prepareNodeExecutions({
      executionId: 'exec3',
      canvasId: 'canvas3',
      canvasData: canvas,
      variables,
      startNodes: ['C'], // This should be used when isNewCanvas=false
      isNewCanvas: false,
    });

    // startNodes should use the provided value
    expect(startNodes).toEqual(['C']);

    expect(nodeExecutions).toHaveLength(3);

    // Build index by node id
    const byNodeId: Record<string, any> = {};
    for (const n of nodeExecutions) {
      byNodeId[n.nodeId] = n;
    }

    // Only nodes in subtree of C should be waiting
    expect(byNodeId.A.status).toBe('finish');
    expect(byNodeId.B.status).toBe('finish');
    expect(byNodeId.C.status).toBe('waiting');

    // Node B should connect to parent A using parent's node id (when not new canvas)
    const b = byNodeId.B;
    expect(b.connectTo).toEqual([
      { type: 'skillResponse', entityId: 'entityA', handleType: 'source' },
    ]);

    // processedQuery takes from metadata.structuredData.query or title
    const a = byNodeId.A;
    expect(a.originalQuery).toBe('Hello @topic world');
    expect(a.processedQuery).toBe('Hello TypeScript world');

    const c = byNodeId.C;
    expect(c.originalQuery).toBe('No var here');
    expect(c.processedQuery).toBe('No var here');

    // Relationship ids are unchanged when not new canvas
    expect(b.parentNodeIds).toEqual(['A']);
    expect(b.childNodeIds).toEqual(['C']);

    // Source ids preserved
    expect(a.sourceNodeId).toBe('A');
    expect(a.sourceEntityId).toBe('entityA');
  });

  it('ignores provided startNodes and auto-detects root nodes when isNewCanvas=true', () => {
    const canvas = buildCanvas();
    const { nodeExecutions, startNodes } = prepareNodeExecutions({
      executionId: 'exec2',
      canvasId: 'canvas2',
      canvasData: canvas,
      variables,
      startNodes: ['B'], // This should be ignored when isNewCanvas=true
      isNewCanvas: true,
    });

    // startNodes should be auto-detected (node A has no parents), mapped to new id N1
    expect(startNodes).toEqual(['N1']);

    // Build index by target (new) node id
    const byNewNodeId: Record<string, any> = {};
    for (const n of nodeExecutions) {
      byNewNodeId[n.nodeId] = n;
    }

    // Status: All nodes are in subtree of A, so all are waiting
    expect(byNewNodeId.N1.status).toBe('waiting');
    expect(byNewNodeId.N2.status).toBe('waiting');
    expect(byNewNodeId.N3.status).toBe('waiting');

    // Parent/child id mapping
    expect(byNewNodeId.N1.parentNodeIds).toEqual([]);
    expect(byNewNodeId.N1.childNodeIds).toEqual(['N2']);
    expect(byNewNodeId.N2.parentNodeIds).toEqual(['N1']);
    expect(byNewNodeId.N2.childNodeIds).toEqual(['N3']);

    // Entity ids remapped to generated ones
    expect(byNewNodeId.N1.entityId).toBe('E1');
    expect(byNewNodeId.N2.entityId).toBe('E2');
    expect(byNewNodeId.N3.entityId).toBe('E3');

    // connectTo for B uses parent's remapped entity id when isNewCanvas=true
    expect(byNewNodeId.N2.connectTo).toEqual([
      { type: 'skillResponse', entityId: 'E1', handleType: 'source' },
    ]);

    // node contains new node id and remapped entityId; and contextItems remapped for skillResponse
    const aData = byNewNodeId.N1.node;
    expect(aData.id).toBe('N1');
    expect(aData.data?.entityId).toBe('E1');

    const contextItems = aData?.data?.metadata?.contextItems ?? [];
    const entityIds = Array.isArray(contextItems) ? contextItems.map((i: any) => i?.entityId) : [];
    // Node A has no contextItems, so entityIds should be empty
    expect(entityIds).toEqual([]);

    // Queries processed
    expect(byNewNodeId.N1.processedQuery).toBe('Hello TypeScript world');
    expect(byNewNodeId.N2.processedQuery).toBe('Test Document'); // Node B is a document, uses title
    expect(byNewNodeId.N3.processedQuery).toBe('No var here');

    // Source ids preserved even in new canvas mode
    expect(byNewNodeId.N1.sourceNodeId).toBe('A');
    expect(byNewNodeId.N1.sourceEntityId).toBe('entityA');
  });

  describe('invokeReq field validation', () => {
    const buildCanvasWithMetadata = (metadata: Partial<ResponseNodeMeta> = {}) => {
      const nodes = [
        {
          id: 'A',
          type: 'skillResponse' as CanvasNodeType,
          position: { x: 0, y: 0 },
          data: {
            title: 'Node A',
            entityId: 'entityA',
            metadata: {
              structuredData: { query: 'Hello @topic world' },
              contextItems: [],
              ...metadata,
            },
          },
        },
      ];
      const edges: any[] = [];
      return { nodes, edges } as CanvasData;
    };

    const variables: WorkflowVariable[] = [
      {
        variableId: 'v-topic',
        name: 'topic',
        value: [{ type: 'text', text: 'TypeScript' }],
        variableType: 'string',
      },
    ];

    beforeEach(() => {
      setMockSequences({
        nodeIds: ['N1'],
        entityIds: ['E1'],
        nodeExecutionIds: ['W1'],
      });
    });

    it('should create valid invokeReq with basic required fields', () => {
      const canvas = buildCanvasWithMetadata();
      const { nodeExecutions } = prepareNodeExecutions({
        executionId: 'exec1',
        canvasId: 'canvas1',
        canvasData: canvas,
        variables,
        isNewCanvas: false,
      });

      expect(nodeExecutions).toHaveLength(1);
      const nodeExecution = nodeExecutions[0];
      const invokeReq = nodeExecution.invokeReq as InvokeSkillRequest;

      // Test basic structure
      expect(invokeReq).toHaveProperty('resultId', 'entityA');
      expect(invokeReq).toHaveProperty('input');
      expect(invokeReq).toHaveProperty('target');
      expect(invokeReq).toHaveProperty('context');
      expect(invokeReq).toHaveProperty('resultHistory');

      // Test input fields
      expect(invokeReq.input).toHaveProperty('query', 'Hello TypeScript world');
      expect(invokeReq.input).toHaveProperty('originalQuery', 'Hello @topic world');
      expect(invokeReq.input).toHaveProperty('images', []);

      // Test target fields
      expect(invokeReq.target).toHaveProperty('entityType', 'canvas');
      expect(invokeReq.target).toHaveProperty('entityId', 'canvas1');

      // Test context and resultHistory are arrays
      expect(Array.isArray(invokeReq.context)).toBe(true);
      expect(Array.isArray(invokeReq.resultHistory)).toBe(true);
    });

    it('should handle contextItems in invokeReq context field', () => {
      const contextItems: IContextItem[] = [
        { entityId: 'doc1', type: 'document', title: 'Document 1' },
        { entityId: 'doc2', type: 'document', title: 'Document 2' },
      ];
      const canvas = buildCanvasWithMetadata({ contextItems });
      const { nodeExecutions } = prepareNodeExecutions({
        executionId: 'exec1',
        canvasId: 'canvas1',
        canvasData: canvas,
        variables,
        isNewCanvas: false,
      });

      const nodeExecution = nodeExecutions[0];
      const invokeReq = nodeExecution.invokeReq as InvokeSkillRequest;

      expect(invokeReq.context).toHaveLength(2);
      expect((invokeReq.context as any)[0]).toMatchObject({
        entityId: 'doc1',
        type: 'document',
        title: 'Document 1',
      });
      expect((invokeReq.context as any)[1]).toMatchObject({
        entityId: 'doc2',
        type: 'document',
        title: 'Document 2',
      });
    });

    it('should handle modelInfo in invokeReq', () => {
      const modelInfo: ModelInfo = {
        name: 'gpt-4',
        label: 'GPT-4',
        provider: 'openai',
        providerItemId: 'openai-gpt-4',
        contextLimit: 128000,
        maxOutput: 4096,
      };
      const canvas = buildCanvasWithMetadata({ modelInfo });
      const { nodeExecutions } = prepareNodeExecutions({
        executionId: 'exec1',
        canvasId: 'canvas1',
        canvasData: canvas,
        variables,
        isNewCanvas: false,
      });

      const nodeExecution = nodeExecutions[0];
      const invokeReq = nodeExecution.invokeReq as InvokeSkillRequest;

      expect(invokeReq.modelName).toBe('gpt-4');
      expect(invokeReq.modelItemId).toBe('openai-gpt-4');
    });

    it('should handle selectedToolsets in invokeReq', () => {
      const selectedToolsets: GenericToolset[] = [
        { id: 'tool1', name: 'Tool 1', type: 'regular' },
        { id: 'tool2', name: 'Tool 2', type: 'regular' },
        { id: 'tool3', name: 'Tool 3', type: 'regular' },
      ];
      const canvas = buildCanvasWithMetadata({ selectedToolsets });
      const { nodeExecutions } = prepareNodeExecutions({
        executionId: 'exec1',
        canvasId: 'canvas1',
        canvasData: canvas,
        variables,
        isNewCanvas: false,
      });

      const nodeExecution = nodeExecutions[0];
      const invokeReq = nodeExecution.invokeReq as InvokeSkillRequest;

      expect(invokeReq.toolsets).toEqual(selectedToolsets);
    });

    it('should handle images from contextItems in invokeReq input', () => {
      const contextItems: IContextItem[] = [
        { entityId: 'img1', type: 'image', title: 'Image 1' },
        { entityId: 'img2', type: 'image', title: 'Image 2' },
      ];
      const canvas = buildCanvasWithMetadata({ contextItems });
      const { nodeExecutions } = prepareNodeExecutions({
        executionId: 'exec1',
        canvasId: 'canvas1',
        canvasData: canvas,
        variables,
        isNewCanvas: false,
      });

      const nodeExecution = nodeExecutions[0];
      const invokeReq = nodeExecution.invokeReq as InvokeSkillRequest;

      expect(invokeReq.input?.images).toHaveLength(2);
      expect(invokeReq.input?.images?.[0]).toMatchObject({
        entityId: 'img1',
        type: 'image',
        title: 'Image 1',
      });
      expect(invokeReq.input?.images?.[1]).toMatchObject({
        entityId: 'img2',
        type: 'image',
        title: 'Image 2',
      });
    });

    it('should handle mixed contextItems (documents and images) correctly', () => {
      const contextItems: IContextItem[] = [
        { entityId: 'doc1', type: 'document', title: 'Document 1' },
        { entityId: 'img1', type: 'image', title: 'Image 1' },
        { entityId: 'doc2', type: 'document', title: 'Document 2' },
        { entityId: 'img2', type: 'image', title: 'Image 2' },
      ];
      const canvas = buildCanvasWithMetadata({ contextItems });
      const { nodeExecutions } = prepareNodeExecutions({
        executionId: 'exec1',
        canvasId: 'canvas1',
        canvasData: canvas,
        variables,
        isNewCanvas: false,
      });

      const nodeExecution = nodeExecutions[0];
      const invokeReq = nodeExecution.invokeReq as InvokeSkillRequest;

      // All items should be in context
      expect(invokeReq.context).toHaveLength(4);
      expect((invokeReq.context as any).map((item: any) => item.type)).toEqual([
        'document',
        'image',
        'document',
        'image',
      ]);

      // Only images should be in input.images
      expect(invokeReq.input?.images).toHaveLength(2);
      expect(invokeReq.input?.images?.map((item: any) => item.type)).toEqual(['image', 'image']);
    });

    it('should handle empty contextItems gracefully', () => {
      const canvas = buildCanvasWithMetadata({ contextItems: [] });
      const { nodeExecutions } = prepareNodeExecutions({
        executionId: 'exec1',
        canvasId: 'canvas1',
        canvasData: canvas,
        variables,
        isNewCanvas: false,
      });

      const nodeExecution = nodeExecutions[0];
      const invokeReq = nodeExecution.invokeReq as InvokeSkillRequest;

      expect(invokeReq.context).toEqual([]);
      expect(invokeReq.input?.images).toEqual([]);
    });

    it('should handle undefined contextItems gracefully', () => {
      const canvas = buildCanvasWithMetadata({ contextItems: undefined });
      const { nodeExecutions } = prepareNodeExecutions({
        executionId: 'exec1',
        canvasId: 'canvas1',
        canvasData: canvas,
        variables,
        isNewCanvas: false,
      });

      const nodeExecution = nodeExecutions[0];
      const invokeReq = nodeExecution.invokeReq as InvokeSkillRequest;

      expect(invokeReq.context).toEqual([]);
      expect(invokeReq.input?.images).toEqual([]);
    });

    it('should handle missing metadata gracefully', () => {
      const canvas = buildCanvasWithMetadata({});
      // Remove metadata to test undefined handling
      canvas.nodes[0].data.metadata = undefined as any;

      const { nodeExecutions } = prepareNodeExecutions({
        executionId: 'exec1',
        canvasId: 'canvas1',
        canvasData: canvas,
        variables,
        isNewCanvas: false,
      });

      const nodeExecution = nodeExecutions[0];
      const invokeReq = nodeExecution.invokeReq as InvokeSkillRequest;

      expect(invokeReq.context).toEqual([]);
      expect(invokeReq.input?.images).toEqual([]);
      expect(invokeReq.modelName).toBeUndefined();
      expect(invokeReq.modelItemId).toBeUndefined();
      expect(invokeReq.toolsets).toBeUndefined();
    });

    it('should map entity IDs correctly in new canvas mode', () => {
      const contextItems: IContextItem[] = [
        { entityId: 'oldEntity1', type: 'document', title: 'Document 1' },
        { entityId: 'oldEntity2', type: 'image', title: 'Image 1' },
      ];
      const canvas = buildCanvasWithMetadata({ contextItems });
      const { nodeExecutions } = prepareNodeExecutions({
        executionId: 'exec1',
        canvasId: 'canvas1',
        canvasData: canvas,
        variables,
        isNewCanvas: true,
      });

      const nodeExecution = nodeExecutions[0];
      const invokeReq = nodeExecution.invokeReq as InvokeSkillRequest;

      // resultId should be mapped to new entity ID
      expect(invokeReq.resultId).toBe('E1');

      // contextItems should have their entityIds mapped
      expect(invokeReq.context).toHaveLength(2);
      expect((invokeReq.context as any)?.[0]?.entityId).toBe('E1'); // oldEntity1 -> E1
      expect((invokeReq.context as any)?.[1]?.entityId).toBe('E1'); // oldEntity2 -> E1 (same mapping)
    });

    it('should handle query processing with variables correctly', () => {
      const canvas = buildCanvasWithMetadata({
        structuredData: { query: 'Find @topic and @category' },
      });
      const variables: WorkflowVariable[] = [
        {
          variableId: 'v-topic',
          name: 'topic',
          value: [{ type: 'text', text: 'TypeScript' }],
          variableType: 'string',
        },
        {
          variableId: 'v-category',
          name: 'category',
          value: [{ type: 'text', text: 'Programming' }],
          variableType: 'string',
        },
      ];

      const { nodeExecutions } = prepareNodeExecutions({
        executionId: 'exec1',
        canvasId: 'canvas1',
        canvasData: canvas,
        variables,
        isNewCanvas: false,
      });

      const nodeExecution = nodeExecutions[0];
      const invokeReq = nodeExecution.invokeReq as InvokeSkillRequest;

      expect(invokeReq.input?.query).toBe('Find TypeScript and Programming');
      expect(invokeReq.input?.originalQuery).toBe('Find @topic and @category');
    });

    it('should fallback to node title when structuredData.query is missing', () => {
      const canvas = buildCanvasWithMetadata({
        structuredData: {},
      });
      const { nodeExecutions } = prepareNodeExecutions({
        executionId: 'exec1',
        canvasId: 'canvas1',
        canvasData: canvas,
        variables,
        isNewCanvas: false,
      });

      const nodeExecution = nodeExecutions[0];
      const invokeReq = nodeExecution.invokeReq as InvokeSkillRequest;

      expect(invokeReq.input?.query).toBe('Node A');
      expect(invokeReq.input?.originalQuery).toBe('Node A');
    });

    it('should handle resultHistory with thread history correctly', () => {
      // Create a canvas with multiple nodes to test resultHistory
      const canvas = {
        nodes: [
          {
            id: 'A',
            type: 'skillResponse' as CanvasNodeType,
            position: { x: 0, y: 0 },
            data: {
              title: 'Node A',
              entityId: 'entityA',
              metadata: {
                structuredData: { query: 'Hello world' },
                contextItems: [],
              },
            },
          },
          {
            id: 'B',
            type: 'skillResponse' as CanvasNodeType,
            position: { x: 0, y: 0 },
            data: {
              title: 'Node B',
              entityId: 'entityB',
              metadata: {
                structuredData: { query: 'Another query' },
                contextItems: [{ entityId: 'entityA', type: 'skillResponse', title: 'Node A' }],
              },
            },
          },
        ],
        edges: [{ id: 'e1', source: 'A', target: 'B', type: 'default' }] as CanvasEdge[],
      } as CanvasData;

      const { nodeExecutions } = prepareNodeExecutions({
        executionId: 'exec1',
        canvasId: 'canvas1',
        canvasData: canvas,
        variables: [],
        isNewCanvas: false,
      });

      // Find node B execution
      const nodeBExecution = nodeExecutions.find((n) => n.nodeId === 'B');
      expect(nodeBExecution).toBeDefined();

      const invokeReq: InvokeSkillRequest = nodeBExecution!.invokeReq as InvokeSkillRequest;

      // resultHistory should contain the thread history
      expect(Array.isArray(invokeReq.resultHistory)).toBe(true);
      expect(invokeReq.resultHistory?.length).toBe(1);
      expect(invokeReq.resultHistory?.[0]).toMatchObject({
        title: 'Node A',
        resultId: 'entityA',
      });
    });
  });
});
