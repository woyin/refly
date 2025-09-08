import { Edge, Node } from '@xyflow/react';

export const findThreadHistory = ({
  resultId,
  startNode,
  nodes,
  edges,
}: {
  resultId?: string;
  startNode?: Node;
  nodes: Node[];
  edges: Edge[];
}) => {
  if (!startNode && !resultId) return [];

  if (!startNode) {
    startNode = nodes.find((node) => node.data?.entityId === resultId);
  }

  if (!startNode || startNode.type !== 'skillResponse') return [];

  const nodeMap = new Map<string, Node>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // Create two maps to handle bidirectional traversal if needed
  const targetToSourceMap = new Map();
  const sourceToTargetsMap = new Map();

  for (const edge of edges) {
    // Map target -> source for backward traversal (support multiple incoming connections)
    if (!targetToSourceMap.has(edge.target)) {
      targetToSourceMap.set(edge.target, []);
    }
    targetToSourceMap.get(edge.target).push(edge.source);

    // Map source -> targets for forward traversal if needed
    if (!sourceToTargetsMap.has(edge.source)) {
      sourceToTargetsMap.set(edge.source, []);
    }
    sourceToTargetsMap.get(edge.source).push(edge.target);
  }

  const history = [startNode];
  const visited = new Set<string>();

  // Helper function to recursively find source nodes
  const findSourceNodes = (nodeId: string) => {
    // Prevent infinite loops in case of circular dependencies
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const sourceIds = targetToSourceMap.get(nodeId) || [];
    for (const sourceId of sourceIds) {
      const sourceNode = nodeMap.get(sourceId);

      if (sourceNode?.type === 'skillResponse') {
        // Only add if not already in history
        if (!history.some((node) => node.id === sourceNode.id)) {
          history.push(sourceNode);
        }
        // Continue traversing up the chain
        findSourceNodes(sourceId);
      }
    }
  };

  // Start the recursive search from the start node
  findSourceNodes(startNode.id);

  // Return nodes in reverse order (oldest to newest)
  return history.reverse();
};
