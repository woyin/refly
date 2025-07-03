import {
  CanvasState,
  CanvasNode,
  CanvasEdge,
  NodeDiff,
  EdgeDiff,
  CanvasTransaction,
  CanvasData,
} from '@refly/openapi-schema';
import { genCanvasVersionId, genTransactionId } from '@refly/utils';

export const initEmptyCanvasState = (): CanvasState => {
  return {
    version: genCanvasVersionId(),
    nodes: [],
    edges: [],
    transactions: [],
    history: [],
  };
};

export const applyCanvasStateTransaction = (
  data: CanvasData,
  tx: CanvasTransaction,
): CanvasData => {
  // Start with a copy of the current state
  let newNodes = [...(data.nodes ?? [])];
  let newEdges = [...(data.edges ?? [])];

  // Apply node diffs
  for (const nodeDiff of tx.nodeDiffs) {
    switch (nodeDiff.type) {
      case 'add':
        if (nodeDiff.to) {
          newNodes.push(nodeDiff.to);
        }
        break;
      case 'update':
        newNodes = newNodes.map((node) =>
          node.id === nodeDiff.id && nodeDiff.to ? { ...node, ...nodeDiff.to } : node,
        );
        break;
      case 'delete':
        newNodes = newNodes.filter((node) => node.id !== nodeDiff.id);
        break;
    }
  }

  // Apply edge diffs
  for (const edgeDiff of tx.edgeDiffs) {
    switch (edgeDiff.type) {
      case 'add':
        if (edgeDiff.to) {
          newEdges.push(edgeDiff.to);
        }
        break;
      case 'update':
        newEdges = newEdges.map((edge) =>
          edge.id === edgeDiff.id && edgeDiff.to ? { ...edge, ...edgeDiff.to } : edge,
        );
        break;
      case 'delete':
        newEdges = newEdges.filter((edge) => edge.id !== edgeDiff.id);
        break;
    }
  }

  return {
    nodes: newNodes,
    edges: newEdges,
  };
};

/**
 * Get actual canvas data from canvas initial state and replayed transactions
 * @param state - The canvas state
 * @returns The canvas data
 */
export const getCanvasDataFromState = (state: CanvasState): CanvasData => {
  let currentData = {
    nodes: state.nodes,
    edges: state.edges,
  };

  for (const transaction of state.transactions) {
    currentData = applyCanvasStateTransaction(currentData, transaction);
  }

  return currentData;
};

export class CanvasConflictException extends Error {
  constructor(
    public readonly conflictType: 'node' | 'edge',
    public readonly itemId: string,
    public readonly state1Item: CanvasNode | CanvasEdge,
    public readonly state2Item: CanvasNode | CanvasEdge,
  ) {
    super(`Canvas conflict detected for ${conflictType} with id: ${itemId}`);
    this.name = 'CanvasConflictException';
  }
}

/**
 * Deep compare two objects excluding the 'id' and other fields that are not relevant
 */
const deepCompareExcludingId = (obj1: any, obj2: any): boolean => {
  if (obj1 === obj2) return true;

  if (obj1 == null || obj2 == null) return obj1 === obj2;

  if (typeof obj1 !== typeof obj2) return false;

  if (typeof obj1 !== 'object') return obj1 === obj2;

  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;

  if (Array.isArray(obj1)) {
    if (obj1.length !== obj2.length) return false;
    for (let i = 0; i < obj1.length; i++) {
      if (!deepCompareExcludingId(obj1[i], obj2[i])) return false;
    }
    return true;
  }

  const keys1 = Object.keys(obj1).filter((key) => key !== 'id' && key !== 'selected');
  const keys2 = Object.keys(obj2).filter((key) => key !== 'id' && key !== 'selected');

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepCompareExcludingId(obj1[key], obj2[key])) return false;
  }

  return true;
};

/**
 * Update canvas state with new transactions
 * @param state - The current canvas state
 * @param transactions - The new transactions
 * @returns The updated canvas state
 */
export const updateCanvasState = (
  state: CanvasState,
  transactions: CanvasTransaction[],
): CanvasState => {
  const currentTxIds = new Set(state.transactions.map((tx) => tx.txId));

  for (const transaction of transactions) {
    if (currentTxIds.has(transaction.txId)) {
      continue;
    }
    state.transactions.push(transaction);
  }

  state.transactions.sort((a, b) => a.createdAt - b.createdAt);

  return state;
};

/**
 * Merge two canvas states with conflict detection
 * @param local Local canvas state
 * @param remote Remote canvas state
 * @returns Merged canvas state
 * @throws CanvasConflictException if conflicts are detected
 */
export const mergeCanvasStates = (local: CanvasState, remote: CanvasState): CanvasState => {
  // Rule 1: If version and transactions are completely the same, return either local or remote
  if (local.version === remote.version) {
    const localTxIds = new Set(local.transactions.map((tx) => tx.txId));
    const remoteTxIds = new Set(remote.transactions.map((tx) => tx.txId));

    // Check if transactions are exactly the same
    if (
      localTxIds.size === remoteTxIds.size &&
      [...localTxIds].every((txId) => remoteTxIds.has(txId))
    ) {
      return local; // Return local as they are identical
    }

    // Rule 2: Same version, different transactions
    // Find transactions that exist only in local or only in remote
    const localOnlyTxIds = new Set([...localTxIds].filter((txId) => !remoteTxIds.has(txId)));
    const remoteOnlyTxIds = new Set([...remoteTxIds].filter((txId) => !localTxIds.has(txId)));

    const localTxMap = new Map(local.transactions.map((tx) => [tx.txId, tx]));
    const remoteTxMap = new Map(remote.transactions.map((tx) => [tx.txId, tx]));

    // Check for conflicts - find object IDs that are modified by different transactions
    const localModifiedIds = new Set<string>();
    const remoteModifiedIds = new Set<string>();

    // Collect all modified object IDs from local-only transactions
    for (const txId of localOnlyTxIds) {
      const tx = localTxMap.get(txId);
      if (tx) {
        for (const nodeDiff of tx.nodeDiffs) {
          localModifiedIds.add(nodeDiff.id);
        }
        for (const edgeDiff of tx.edgeDiffs) {
          localModifiedIds.add(edgeDiff.id);
        }
      }
    }

    // Collect all modified object IDs from remote-only transactions
    for (const txId of remoteOnlyTxIds) {
      const tx = remoteTxMap.get(txId);
      if (tx) {
        for (const nodeDiff of tx.nodeDiffs) {
          remoteModifiedIds.add(nodeDiff.id);
        }
        for (const edgeDiff of tx.edgeDiffs) {
          remoteModifiedIds.add(edgeDiff.id);
        }
      }
    }

    // Check for conflicts - if same object ID is modified by both local and remote
    const conflictingIds = [...localModifiedIds].filter((id) => remoteModifiedIds.has(id));

    if (conflictingIds.length > 0) {
      // Rule 2.2: Same object IDs modified - throw conflict exception
      const conflictingId = conflictingIds[0];

      // Find the conflicting items
      let localItem: CanvasNode | CanvasEdge | undefined;
      let remoteItem: CanvasNode | CanvasEdge | undefined;
      let conflictType: 'node' | 'edge' = 'node';

      // Find local conflicting item
      for (const txId of localOnlyTxIds) {
        const tx = localTxMap.get(txId);
        if (tx) {
          const nodeDiff = tx.nodeDiffs.find((diff) => diff.id === conflictingId);
          if (nodeDiff) {
            localItem = nodeDiff.to || nodeDiff.from;
            conflictType = 'node';
            break;
          }
          const edgeDiff = tx.edgeDiffs.find((diff) => diff.id === conflictingId);
          if (edgeDiff) {
            localItem = edgeDiff.to || edgeDiff.from;
            conflictType = 'edge';
            break;
          }
        }
      }

      // Find remote conflicting item
      for (const txId of remoteOnlyTxIds) {
        const tx = remoteTxMap.get(txId);
        if (tx) {
          const nodeDiff = tx.nodeDiffs.find((diff) => diff.id === conflictingId);
          if (nodeDiff) {
            remoteItem = nodeDiff.to || nodeDiff.from;
            break;
          }
          const edgeDiff = tx.edgeDiffs.find((diff) => diff.id === conflictingId);
          if (edgeDiff) {
            remoteItem = edgeDiff.to || edgeDiff.from;
            break;
          }
        }
      }

      if (localItem && remoteItem) {
        throw new CanvasConflictException(conflictType, conflictingId, localItem, remoteItem);
      }
    }

    // Rule 2.1: Different object IDs modified - merge transactions
    const mergedTransactions: CanvasTransaction[] = [];

    // Add all transactions from local
    for (const tx of local.transactions) {
      mergedTransactions.push(tx);
    }

    // Add transactions that only exist in remote
    for (const txId of remoteOnlyTxIds) {
      const tx = remoteTxMap.get(txId);
      if (tx) {
        mergedTransactions.push(tx);
      }
    }

    // Sort by createdAt
    mergedTransactions.sort((a, b) => a.createdAt - b.createdAt);

    return {
      version: local.version, // Same version
      nodes: local.nodes, // Use local as base
      edges: local.edges, // Use local as base
      transactions: mergedTransactions,
      history: local.history, // Use local history
    };
  }

  // Rule 3: Different versions - throw conflict exception
  // Create a version conflict exception
  throw new CanvasConflictException(
    'node',
    'version-conflict',
    { id: local.version, position: { x: 0, y: 0 } } as CanvasNode,
    { id: remote.version, position: { x: 0, y: 0 } } as CanvasNode,
  );
};

export const calculateCanvasStateDiff = (
  from: CanvasData,
  to: CanvasData,
): CanvasTransaction | null => {
  const nodeDiffs: NodeDiff[] = [];
  const edgeDiffs: EdgeDiff[] = [];

  // Create lookup maps for efficient comparison
  const fromNodesMap = new Map<string, CanvasNode>();
  const toNodesMap = new Map<string, CanvasNode>();
  const fromEdgesMap = new Map<string, CanvasEdge>();
  const toEdgesMap = new Map<string, CanvasEdge>();

  // Populate the lookup maps
  for (const node of from.nodes) {
    fromNodesMap.set(node.id, node);
  }
  for (const node of to.nodes) {
    toNodesMap.set(node.id, node);
  }
  for (const edge of from.edges) {
    fromEdgesMap.set(edge.id, edge);
  }
  for (const edge of to.edges) {
    toEdgesMap.set(edge.id, edge);
  }

  // Process node diffs
  const allNodeIds = new Set([...fromNodesMap.keys(), ...toNodesMap.keys()]);
  for (const nodeId of allNodeIds) {
    const fromNode = fromNodesMap.get(nodeId);
    const toNode = toNodesMap.get(nodeId);

    if (!fromNode && toNode) {
      // Node was added
      nodeDiffs.push({
        id: nodeId,
        type: 'add',
        to: toNode,
      });
    } else if (fromNode && !toNode) {
      // Node was deleted
      nodeDiffs.push({
        id: nodeId,
        type: 'delete',
        from: fromNode,
      });
    } else if (fromNode && toNode) {
      // Node exists in both states, check if it was modified
      if (!deepCompareExcludingId(fromNode, toNode)) {
        nodeDiffs.push({
          id: nodeId,
          type: 'update',
          from: fromNode,
          to: toNode,
        });
      }
    }
  }

  // Process edge diffs
  const allEdgeIds = new Set([...fromEdgesMap.keys(), ...toEdgesMap.keys()]);
  for (const edgeId of allEdgeIds) {
    const fromEdge = fromEdgesMap.get(edgeId);
    const toEdge = toEdgesMap.get(edgeId);

    if (!fromEdge && toEdge) {
      // Edge was added
      edgeDiffs.push({
        id: edgeId,
        type: 'add',
        to: toEdge,
      });
    } else if (fromEdge && !toEdge) {
      // Edge was deleted
      edgeDiffs.push({
        id: edgeId,
        type: 'delete',
        from: fromEdge,
      });
    } else if (fromEdge && toEdge) {
      // Edge exists in both states, check if it was modified
      if (!deepCompareExcludingId(fromEdge, toEdge)) {
        edgeDiffs.push({
          id: edgeId,
          type: 'update',
          from: fromEdge,
          to: toEdge,
        });
      }
    }
  }

  if (!nodeDiffs.length && !edgeDiffs.length) {
    return null;
  }

  return {
    txId: genTransactionId(),
    nodeDiffs,
    edgeDiffs,
    createdAt: Date.now(),
  };
};
