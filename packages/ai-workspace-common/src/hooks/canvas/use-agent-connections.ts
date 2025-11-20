import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { genUniqueId } from '@refly/utils/id';
import { useEdgeStyles } from '@refly-packages/ai-workspace-common/components/canvas/constants';
import { CanvasNode, ResponseNodeMeta } from '@refly/canvas-common';

export const useAgentConnections = () => {
  const edgeStyles = useEdgeStyles();
  const { getNodes, getEdges, addEdges, deleteElements } = useReactFlow();

  const getUpstreamAgentNodes = useCallback(
    (sourceNodeId: string) => {
      const edges = getEdges();
      const nodes = getNodes();
      return edges
        .filter((edge) => edge.target === sourceNodeId)
        .map((edge) => nodes.find((node) => node.id === edge.source))
        .filter((node) => node?.type === 'skillResponse') as CanvasNode<ResponseNodeMeta>[];
    },
    [getEdges, getNodes],
  );

  const connectToUpstreamAgent = useCallback(
    (sourceNodeId: string, targetEntityId: string) => {
      const nodes = getNodes();
      const targetNode = nodes.find((node) => node.data?.entityId === targetEntityId);
      if (!targetNode) {
        return;
      }
      const targetNodeId = targetNode?.id ?? '';
      if (!targetNodeId) {
        return;
      }
      const newEdge = {
        source: sourceNodeId,
        target: targetNodeId,
        id: `edge-${genUniqueId()}`,
        animated: false,
        style: edgeStyles.default,
      };
      addEdges([newEdge]);
    },
    [getNodes, addEdges, edgeStyles],
  );

  const disconnectFromUpstreamAgent = useCallback(
    (sourceNodeId: string, targetEntityId: string) => {
      const nodes = getNodes();
      const edges = getEdges();
      const targetNode = nodes.find((node) => node.data?.entityId === targetEntityId);
      if (!targetNode) {
        return;
      }
      const targetNodeId = targetNode?.id ?? '';
      if (!targetNodeId) {
        return;
      }
      const edge = edges.find(
        (edge) => edge.source === sourceNodeId && edge.target === targetNodeId,
      );
      if (!edge) {
        return;
      }
      deleteElements({ edges: [edge] });
    },
    [getNodes, getEdges, deleteElements],
  );

  return {
    getUpstreamAgentNodes,
    connectToUpstreamAgent,
    disconnectFromUpstreamAgent,
  };
};
