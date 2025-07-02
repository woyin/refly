import { CanvasState, CanvasNode, CanvasEdge, NodeDiff, EdgeDiff } from '@refly/openapi-schema';

export interface Transaction {
  nodeDiffs: NodeDiff[];
  edgeDiffs: EdgeDiff[];
}

export const applyCanvasStateTransaction = (state: CanvasState, tx: Transaction): CanvasState => {
  // Start with a copy of the current state
  let newNodes = [...state.nodes];
  let newEdges = [...state.edges];

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
    ...state,
    nodes: newNodes,
    edges: newEdges,
  };
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
 * Deep compare two objects excluding the 'id' field
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

  const keys1 = Object.keys(obj1).filter((key) => key !== 'id');
  const keys2 = Object.keys(obj2).filter((key) => key !== 'id');

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepCompareExcludingId(obj1[key], obj2[key])) return false;
  }

  return true;
};

/**
 * Merge two canvas states with conflict detection
 * @param state1 First canvas state
 * @param state2 Second canvas state
 * @returns Merged canvas state
 * @throws CanvasConflictException if conflicts are detected
 */
export const mergeCanvasStates = (state1: CanvasState, state2: CanvasState): CanvasState => {
  // Merge nodes
  const nodeMap = new Map<string, CanvasNode>();

  // Add nodes from state1
  for (const node of state1.nodes) {
    nodeMap.set(node.id, node);
  }

  // Add nodes from state2, checking for conflicts
  for (const node of state2.nodes) {
    const existingNode = nodeMap.get(node.id);
    if (existingNode) {
      // Check if they are identical (excluding id)
      if (!deepCompareExcludingId(existingNode, node)) {
        throw new CanvasConflictException('node', node.id, existingNode, node);
      }
      // If identical, keep the existing one (no need to update)
    } else {
      // No conflict, add the node
      nodeMap.set(node.id, node);
    }
  }

  // Merge edges
  const edgeMap = new Map<string, CanvasEdge>();

  // Add edges from state1
  for (const edge of state1.edges) {
    edgeMap.set(edge.id, edge);
  }

  // Add edges from state2, checking for conflicts
  for (const edge of state2.edges) {
    const existingEdge = edgeMap.get(edge.id);
    if (existingEdge) {
      // Check if they are identical (excluding id)
      if (!deepCompareExcludingId(existingEdge, edge)) {
        throw new CanvasConflictException('edge', edge.id, existingEdge, edge);
      }
      // If identical, keep the existing one (no need to update)
    } else {
      // No conflict, add the edge
      edgeMap.set(edge.id, edge);
    }
  }

  return {
    title: state1.title || state2.title,
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
};
