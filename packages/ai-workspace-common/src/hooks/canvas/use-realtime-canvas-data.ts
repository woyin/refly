import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@xyflow/react';
import { CanvasNode } from '@refly/canvas-common';
import { CanvasEdge } from '@refly/openapi-schema';

export const useRealtimeCanvasData = () => {
  const { nodes, edges } = useStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
    })),
  );

  return {
    nodes: nodes as CanvasNode[],
    edges: edges as CanvasEdge[],
  };
};
