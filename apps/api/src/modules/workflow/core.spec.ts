import { CanvasData, CanvasNodeType, WorkflowVariable } from '@refly/openapi-schema';
import { processQueryWithTypes, prepareNodeExecutions } from './core';
import { ResponseNodeMeta } from '@refly/canvas-common';

// Mock id generators for deterministic outputs
jest.mock('@refly/utils', () => {
  let nodeIdIdx = 0;
  let entityIdIdx = 0;
  let nodeExecIdIdx = 0;
  let sequences = {
    nodeIds: [] as string[],
    entityIds: [] as string[],
    nodeExecutionIds: [] as string[],
  };

  return {
    genNodeID: jest.fn(() => sequences.nodeIds[nodeIdIdx++] ?? `nid-${nodeIdIdx}`),
    genNodeEntityId: jest.fn(() => sequences.entityIds[entityIdIdx++] ?? `eid-${entityIdIdx}`),
    genWorkflowNodeExecutionID: jest.fn(
      () => sequences.nodeExecutionIds[nodeExecIdIdx++] ?? `wne-${nodeExecIdIdx}`,
    ),
    __setIdSequences: (s: {
      nodeIds?: string[];
      entityIds?: string[];
      nodeExecutionIds?: string[];
    }) => {
      sequences = {
        nodeIds: s.nodeIds ?? [],
        entityIds: s.entityIds ?? [],
        nodeExecutionIds: s.nodeExecutionIds ?? [],
      };
      nodeIdIdx = 0;
      entityIdIdx = 0;
      nodeExecIdIdx = 0;
    },
  };
});

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
    const utilsMock = jest.requireMock('@refly/utils');
    utilsMock.__setIdSequences({
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
    const connectTo = JSON.parse(b.connectTo as string);
    expect(connectTo).toEqual([{ type: 'skillResponse', entityId: 'A', handleType: 'source' }]);

    // processedQuery takes from metadata.structuredData.query or title
    const a = byNodeId.A;
    expect(a.originalQuery).toBe('Hello @topic world');
    expect(a.processedQuery).toBe('Hello TypeScript world');

    const c = byNodeId.C;
    expect(c.originalQuery).toBe('No var here');
    expect(c.processedQuery).toBe('No var here');

    // Relationship ids are unchanged when not new canvas
    expect(JSON.parse(b.parentNodeIds as string)).toEqual(['A']);
    expect(JSON.parse(b.childNodeIds as string)).toEqual(['C']);

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
    const connectTo = JSON.parse(b.connectTo as string);
    expect(connectTo).toEqual([{ type: 'skillResponse', entityId: 'A', handleType: 'source' }]);

    // processedQuery takes from metadata.structuredData.query or title
    const a = byNodeId.A;
    expect(a.originalQuery).toBe('Hello @topic world');
    expect(a.processedQuery).toBe('Hello TypeScript world');

    const c = byNodeId.C;
    expect(c.originalQuery).toBe('No var here');
    expect(c.processedQuery).toBe('No var here');

    // Relationship ids are unchanged when not new canvas
    expect(JSON.parse(b.parentNodeIds as string)).toEqual(['A']);
    expect(JSON.parse(b.childNodeIds as string)).toEqual(['C']);

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
    expect(JSON.parse(byNewNodeId.N1.parentNodeIds as string)).toEqual([]);
    expect(JSON.parse(byNewNodeId.N1.childNodeIds as string)).toEqual(['N2']);
    expect(JSON.parse(byNewNodeId.N2.parentNodeIds as string)).toEqual(['N1']);
    expect(JSON.parse(byNewNodeId.N2.childNodeIds as string)).toEqual(['N3']);

    // Entity ids remapped to generated ones
    expect(byNewNodeId.N1.entityId).toBe('E1');
    expect(byNewNodeId.N2.entityId).toBe('E2');
    expect(byNewNodeId.N3.entityId).toBe('E3');

    // connectTo for B uses parent's remapped entity id when isNewCanvas=true
    const connectToB = JSON.parse(byNewNodeId.N2.connectTo as string);
    expect(connectToB).toEqual([{ type: 'skillResponse', entityId: 'E1', handleType: 'source' }]);

    // nodeData contains new node id and remapped entityId; and contextItems remapped for skillResponse
    const aData = JSON.parse(byNewNodeId.N1.nodeData as string);
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
});
