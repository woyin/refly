import { describe, it, expect } from 'vitest';
import {
  initEmptyCanvasState,
  applyCanvasTransaction,
  getCanvasDataFromState,
  updateCanvasState,
  mergeCanvasStates,
  CanvasConflictException,
} from './sync';
import type {
  CanvasState,
  CanvasNode,
  CanvasEdge,
  CanvasTransaction,
  CanvasNodeType,
  CanvasData,
} from '@refly/openapi-schema';

const TEST_NODE_TYPE: CanvasNodeType = 'document';
const createNode = (id: string, extra: Partial<CanvasNode> = {}): CanvasNode => ({
  id,
  type: TEST_NODE_TYPE,
  position: { x: 0, y: 0 },
  data: { title: `Node ${id}`, entityId: id },
  ...extra,
});
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
const createTx = (
  id: string,
  nodeDiffs = [],
  edgeDiffs = [],
  extra: Partial<CanvasTransaction> = {},
): CanvasTransaction => ({
  txId: id,
  createdAt: Date.now(),
  nodeDiffs,
  edgeDiffs,
  revoked: false,
  deleted: false,
  ...extra,
});

describe('initEmptyCanvasState', () => {
  it('should return a valid empty canvas state', () => {
    const state = initEmptyCanvasState();
    expect(state.nodes).toEqual([]);
    expect(state.edges).toEqual([]);
    expect(state.transactions).toEqual([]);
    expect(state.history).toEqual([]);
    expect(typeof state.version).toBe('string');
  });
});

describe('applyCanvasTransaction', () => {
  it('should add a node and edge', () => {
    const data: CanvasData = { nodes: [], edges: [] };
    const node = createNode('n1');
    const edge = createEdge('e1', 'n1', 'n2');
    const tx = createTx(
      'tx1',
      [{ type: 'add', id: 'n1', to: node }],
      [{ type: 'add', id: 'e1', to: edge }],
    );
    const result = applyCanvasTransaction(data, tx);
    expect(result.nodes).toContainEqual(node);
    expect(result.edges).toContainEqual(edge);
  });
  it('should update a node', () => {
    const node = createNode('n1', { data: { title: 'Old', entityId: 'n1' } });
    const updated = { ...node, data: { ...node.data, title: 'New' } };
    const data: CanvasData = { nodes: [node], edges: [] };
    const tx = createTx('tx2', [{ type: 'update', id: 'n1', from: node, to: updated }]);
    const result = applyCanvasTransaction(data, tx);
    expect(result.nodes).toContainEqual(updated);
  });
  it('should delete a node', () => {
    const node = createNode('n1');
    const data: CanvasData = { nodes: [node], edges: [] };
    const tx = createTx('tx3', [{ type: 'delete', id: 'n1', from: node }]);
    const result = applyCanvasTransaction(data, tx);
    expect(result.nodes).not.toContainEqual(node);
  });
  it('should reverse a transaction', () => {
    const node = createNode('n1');
    const data: CanvasData = { nodes: [], edges: [] };
    const tx = createTx('tx4', [{ type: 'add', id: 'n1', to: node }]);
    const result = applyCanvasTransaction(data, tx, { reverse: true });
    expect(result.nodes).not.toContainEqual(node);
  });
});

describe('getCanvasDataFromState', () => {
  it('should replay transactions on initial state', () => {
    const node = createNode('n1');
    const tx = createTx('tx1', [{ type: 'add', id: 'n1', to: node }]);
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx],
      history: [],
    };
    const data = getCanvasDataFromState(state);
    expect(data.nodes).toContainEqual(node);
  });
  it('should skip revoked/deleted transactions', () => {
    const node = createNode('n1');
    const tx = createTx('tx1', [{ type: 'add', id: 'n1', to: node }], [], { revoked: true });
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx],
      history: [],
    };
    const data = getCanvasDataFromState(state);
    expect(data.nodes).not.toContainEqual(node);
  });
});

describe('updateCanvasState', () => {
  it('should add new transactions', () => {
    const tx = createTx('tx1');
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [],
      history: [],
    };
    const updated = updateCanvasState(state, [tx]);
    expect(updated.transactions).toContainEqual(tx);
  });
  it('should replace existing transactions by txId', () => {
    const tx1 = createTx('tx1', [{ type: 'add' as const, id: 'n1', to: createNode('n1') }]);
    const tx2 = {
      ...tx1,
      nodeDiffs: [{ type: 'delete' as const, id: 'n1', from: createNode('n1') }],
    };
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx1],
      history: [],
    };
    const updated = updateCanvasState(state, [tx2]);
    expect(updated.transactions.find((t) => t.txId === 'tx1')?.nodeDiffs[0].type).toBe('delete');
  });
  it('should sort transactions by createdAt', () => {
    const tx1 = createTx('tx1', [], [], { createdAt: 2 });
    const tx2 = createTx('tx2', [], [], { createdAt: 1 });
    const state: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx1],
      history: [],
    };
    const updated = updateCanvasState(state, [tx2]);
    expect(updated.transactions[0].txId).toBe('tx2');
    expect(updated.transactions[1].txId).toBe('tx1');
  });
});

describe('mergeCanvasStates', () => {
  it('should return local if version and transactions are identical', () => {
    const tx = createTx('tx1');
    const local: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx],
      history: [],
    };
    const remote = { ...local };
    expect(mergeCanvasStates(local, remote)).toBe(local);
  });
  it('should merge non-conflicting transactions', () => {
    const tx1 = createTx('tx1', [{ type: 'add', id: 'n1', to: createNode('n1') }]);
    const tx2 = createTx('tx2', [{ type: 'add', id: 'n2', to: createNode('n2') }]);
    const local: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx1],
      history: [],
    };
    const remote: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx2],
      history: [],
    };
    const merged = mergeCanvasStates(local, remote);
    expect(merged.transactions).toHaveLength(2);
    expect(merged.transactions.some((t) => t.txId === 'tx1')).toBe(true);
    expect(merged.transactions.some((t) => t.txId === 'tx2')).toBe(true);
  });
  it('should throw CanvasConflictException for conflicting transactions', () => {
    const tx1 = createTx('tx1', [{ type: 'add', id: 'n1', to: createNode('n1') }]);
    const tx2 = createTx('tx2', [
      {
        type: 'update',
        id: 'n1',
        from: createNode('n1'),
        to: createNode('n1', { data: { title: 'Changed', entityId: 'n1' } }),
      },
    ]);
    const local: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx1],
      history: [],
    };
    const remote: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [tx2],
      history: [],
    };
    expect(() => mergeCanvasStates(local, remote)).toThrow(CanvasConflictException);
  });
  it('should throw CanvasConflictException for version conflict', () => {
    const local: CanvasState = {
      version: 'v1',
      nodes: [],
      edges: [],
      transactions: [],
      history: [],
    };
    const remote: CanvasState = {
      version: 'v2',
      nodes: [],
      edges: [],
      transactions: [],
      history: [],
    };
    expect(() => mergeCanvasStates(local, remote)).toThrow(CanvasConflictException);
  });
});

describe('CanvasConflictException', () => {
  it('should set properties and message', () => {
    const node = createNode('n1');
    const err = new CanvasConflictException('node', 'n1', node, node);
    expect(err.conflictType).toBe('node');
    expect(err.itemId).toBe('n1');
    expect(err.state1Item).toBe(node);
    expect(err.state2Item).toBe(node);
    expect(err.message).toContain('Canvas conflict detected');
    expect(err.name).toBe('CanvasConflictException');
  });
});
