import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CanvasData, CanvasNodeType, WorkflowVariable } from '@refly/openapi-schema';
import { processQueryWithTypes, prepareNodeExecutions, WorkflowNode } from './workflow';
import { ResponseNodeMeta } from './types';

// Mock id generators for deterministic outputs
let sequences = {
  nodeIds: [] as string[],
  entityIds: [] as string[],
};

vi.mock('@refly/utils', () => {
  let nodeIdIdx = 0;
  let entityIdIdx = 0;

  return {
    genNodeID: vi.fn(() => sequences.nodeIds[nodeIdIdx++] ?? `N${nodeIdIdx}`),
    genNodeEntityId: vi.fn(() => sequences.entityIds[entityIdIdx++] ?? `E${entityIdIdx}`),
  };
});

// Helper function to set mock sequences
const setMockSequences = (s: {
  nodeIds?: string[];
  entityIds?: string[];
}) => {
  sequences = {
    nodeIds: s.nodeIds ?? [],
    entityIds: s.entityIds ?? [],
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
        id: 'S',
        type: 'start',
        position: {
          x: 0,
          y: 0,
        },
        data: {
          title: 'Start',
          entityId: 'entityStart',
          metadata: {
            contextItems: [],
          },
        },
      },
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
            modelInfo: {
              name: 'openai/gpt-5',
              providerItemId: 'pi-1',
              label: 'GPT-5',
              provider: 'openai',
              contextLimit: 1000,
              maxOutput: 1000,
            },
          } as ResponseNodeMeta,
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
            contextItems: [
              {
                entityId: 'entityA',
                type: 'skillResponse',
                title: 'Node A',
                metadata: { withHistory: true },
              },
              { entityId: 'entityB', type: 'document', title: 'Test Document' },
            ],
            modelInfo: {
              name: 'openai/gpt-5-mini',
              providerItemId: 'pi-2',
              label: 'GPT-5 Mini',
              provider: 'openai',
              contextLimit: 1000,
              maxOutput: 1000,
            },
          } as ResponseNodeMeta,
        },
      },
    ];
    const edges = [
      { id: 'e0', source: 'S', target: 'A' },
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'C' },
      { id: 'e3', source: 'A', target: 'C' },
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
      nodeIds: ['N1', 'N2', 'N3', 'N4'],
      entityIds: ['E1', 'E2', 'E3', 'E4'],
    });
  });

  it('computes start nodes automatically and marks subtree nodes as waiting (isNewCanvas=false)', () => {
    const canvas = buildCanvas();
    const { nodeExecutions, startNodes } = prepareNodeExecutions({
      executionId: 'exec1',
      canvasData: canvas,
      variables,
      isNewCanvas: false,
    });

    expect(startNodes).toEqual(['S']);
    expect(nodeExecutions).toEqual([
      {
        nodeId: 'S',
        nodeType: 'start',
        entityId: 'entityStart',
        childNodeIds: ['A'],
        parentNodeIds: [],
        connectTo: [],
        sourceNodeId: 'S',
        sourceEntityId: 'entityStart',
        status: 'waiting',
        title: 'Start',
        node: {
          type: 'start',
          id: 'S',
          position: {
            x: 0,
            y: 0,
          },
          data: {
            title: 'Start',
            entityId: 'entityStart',
            metadata: {
              contextItems: [],
            },
          },
        },
      },
      {
        nodeId: 'A',
        nodeType: 'skillResponse',
        childNodeIds: ['B', 'C'],
        parentNodeIds: ['S'],
        originalQuery: 'Hello @topic world',
        processedQuery: 'Hello TypeScript world',
        sourceEntityId: 'entityA',
        sourceNodeId: 'A',
        status: 'waiting',
        title: 'Node A',
        connectTo: [
          {
            type: 'start',
            entityId: 'entityStart',
            handleType: 'source',
          },
        ],
        entityId: 'entityA',
        resultHistory: [],
        node: {
          data: {
            entityId: 'entityA',
            metadata: {
              contextItems: [],
              structuredData: {
                query: 'Hello @topic world',
              },
              modelInfo: {
                name: 'openai/gpt-5',
                providerItemId: 'pi-1',
                label: 'GPT-5',
                provider: 'openai',
                contextLimit: 1000,
                maxOutput: 1000,
              },
            },
            title: 'Node A',
          },
          id: 'A',
          position: {
            x: 0,
            y: 0,
          },
          type: 'skillResponse',
        },
      },
      {
        nodeId: 'B',
        nodeType: 'document',
        childNodeIds: ['C'],
        parentNodeIds: ['A'],
        entityId: 'entityB',
        sourceEntityId: 'entityB',
        sourceNodeId: 'B',
        status: 'waiting',
        title: 'Test Document',
        connectTo: [
          {
            entityId: 'entityA',
            handleType: 'source',
            type: 'skillResponse',
          },
        ],

        node: {
          data: {
            entityId: 'entityB',
            title: 'Test Document',
          },
          id: 'B',
          position: {
            x: 0,
            y: 0,
          },
          type: 'document',
        },
      },
      {
        nodeId: 'C',
        nodeType: 'skillResponse',
        originalQuery: 'No var here',
        parentNodeIds: ['B', 'A'],
        processedQuery: 'No var here',
        sourceEntityId: 'entityC',
        sourceNodeId: 'C',
        status: 'waiting',
        title: 'Node C',
        childNodeIds: [],
        entityId: 'entityC',
        connectTo: [
          {
            entityId: 'entityB',
            handleType: 'source',
            type: 'document',
          },
          {
            entityId: 'entityA',
            handleType: 'source',
            type: 'skillResponse',
          },
        ],
        resultHistory: [
          {
            title: 'Node A',
            resultId: 'entityA',
          },
        ],
        node: {
          data: {
            entityId: 'entityC',
            metadata: {
              structuredData: {
                query: 'No var here',
              },
              contextItems: [
                {
                  entityId: 'entityA',
                  title: 'Node A',
                  type: 'skillResponse',
                  metadata: {
                    withHistory: true,
                  },
                },
                {
                  entityId: 'entityB',
                  title: 'Test Document',
                  type: 'document',
                },
              ],
              modelInfo: {
                contextLimit: 1000,
                label: 'GPT-5 Mini',
                maxOutput: 1000,
                name: 'openai/gpt-5-mini',
                provider: 'openai',
                providerItemId: 'pi-2',
              },
            },
            title: 'Node C',
          },
          id: 'C',
          position: {
            x: 0,
            y: 0,
          },
          type: 'skillResponse',
        },
      },
    ] as WorkflowNode[]);
  });

  it('uses provided startNodes when isNewCanvas=false', () => {
    const canvas = buildCanvas();
    const { startNodes } = prepareNodeExecutions({
      executionId: 'exec3',
      canvasData: canvas,
      variables,
      startNodes: ['C'], // This should be used when isNewCanvas=false
      isNewCanvas: false,
    });

    expect(startNodes).toEqual(['C']);
  });

  it('ignores provided startNodes and auto-detects root nodes when isNewCanvas=true', () => {
    const canvas = buildCanvas();
    const { nodeExecutions, startNodes } = prepareNodeExecutions({
      executionId: 'exec2',
      canvasData: canvas,
      variables,
      startNodes: ['B'], // This should be ignored when isNewCanvas=true
      isNewCanvas: true,
    });

    // startNodes should be auto-detected (node A has no parents), mapped to new id N1
    expect(startNodes).toEqual(['N1']);
    expect(nodeExecutions).toEqual([
      {
        nodeId: 'N1',
        nodeType: 'start',
        title: 'Start',
        parentNodeIds: [],
        sourceEntityId: 'entityStart',
        sourceNodeId: 'S',
        status: 'waiting',
        childNodeIds: ['N2'],
        connectTo: [],
        entityId: 'E1',
        node: {
          data: {
            entityId: 'E1',
            metadata: {
              contextItems: [],
            },
            title: 'Start',
          },
          id: 'N1',
          position: {
            x: 0,
            y: 0,
          },
          type: 'start',
        },
      },
      {
        nodeId: 'N2',
        nodeType: 'skillResponse',
        title: 'Node A',
        originalQuery: 'Hello @topic world',
        parentNodeIds: ['N1'],
        processedQuery: 'Hello TypeScript world',
        resultHistory: [],
        sourceEntityId: 'entityA',
        sourceNodeId: 'A',
        status: 'waiting',
        childNodeIds: ['N3', 'N4'],
        entityId: 'E2',
        connectTo: [
          {
            entityId: 'E1',
            handleType: 'source',
            type: 'start',
          },
        ],
        node: {
          data: {
            entityId: 'E2',
            metadata: {
              contextItems: [],
              modelInfo: {
                contextLimit: 1000,
                label: 'GPT-5',
                maxOutput: 1000,
                name: 'openai/gpt-5',
                provider: 'openai',
                providerItemId: 'pi-1',
              },
              structuredData: {
                query: 'Hello @topic world',
              },
            },
            title: 'Node A',
          },
          id: 'N2',
          position: {
            x: 0,
            y: 0,
          },
          type: 'skillResponse',
        },
      },
      {
        nodeId: 'N3',
        nodeType: 'document',
        parentNodeIds: ['N2'],
        sourceEntityId: 'entityB',
        sourceNodeId: 'B',
        status: 'waiting',
        title: 'Test Document',
        childNodeIds: ['N4'],
        connectTo: [
          {
            entityId: 'E2',
            handleType: 'source',
            type: 'skillResponse',
          },
        ],
        entityId: 'E3',
        node: {
          data: {
            entityId: 'E3',
            title: 'Test Document',
          },
          id: 'N3',
          position: {
            x: 0,
            y: 0,
          },
          type: 'document',
        },
      },
      {
        nodeId: 'N4',
        nodeType: 'skillResponse',
        originalQuery: 'No var here',
        parentNodeIds: ['N3', 'N2'],
        processedQuery: 'No var here',
        resultHistory: [
          {
            title: 'Node A',
            resultId: 'E2',
          },
        ],
        sourceEntityId: 'entityC',
        sourceNodeId: 'C',
        status: 'waiting',
        title: 'Node C',
        childNodeIds: [],
        connectTo: [
          {
            entityId: 'E3',
            handleType: 'source',
            type: 'document',
          },
          {
            entityId: 'E2',
            handleType: 'source',
            type: 'skillResponse',
          },
        ],
        entityId: 'E4',
        node: {
          data: {
            entityId: 'E4',
            metadata: {
              contextItems: [
                {
                  entityId: 'entityA',
                  metadata: {
                    withHistory: true,
                  },
                  title: 'Node A',
                  type: 'skillResponse',
                },
                {
                  entityId: 'entityB',
                  title: 'Test Document',
                  type: 'document',
                },
                {
                  entityId: 'E2',
                  metadata: {
                    withHistory: true,
                  },
                  title: 'Node A',
                  type: 'skillResponse',
                },
                {
                  entityId: 'E3',
                  title: 'Test Document',
                  type: 'document',
                },
              ],
              modelInfo: {
                contextLimit: 1000,
                label: 'GPT-5 Mini',
                maxOutput: 1000,
                name: 'openai/gpt-5-mini',
                provider: 'openai',
                providerItemId: 'pi-2',
              },
              structuredData: {
                query: 'No var here',
              },
            },
            title: 'Node C',
          },
          id: 'N4',
          position: {
            x: 0,
            y: 0,
          },
          type: 'skillResponse',
        },
      },
    ] as WorkflowNode[]);
  });
});
