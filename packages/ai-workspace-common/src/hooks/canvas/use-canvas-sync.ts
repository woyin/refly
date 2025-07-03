import { useMemo } from 'react';
import { get, update } from 'idb-keyval';
import { useDebouncedCallback } from 'use-debounce';
import { useReactFlow } from '@xyflow/react';
import {
  purgeContextItems,
  calculateCanvasStateDiff,
  getCanvasDataFromState,
} from '@refly/canvas-common';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { CanvasState, CanvasNode, CanvasEdge } from '@refly/openapi-schema';
import { IContextItem } from '@refly/common-types';

export const useCanvasSync = () => {
  const { canvasId } = useCanvasContext();
  const { getNodes, getEdges } = useReactFlow();

  const undoManager = useMemo(() => {
    // TODO: Implement undo manager
    return {
      undo: () => {},
      redo: () => {},
    };
  }, []);

  const syncCanvasData = useDebouncedCallback(async () => {
    const nodes = getNodes() as CanvasNode[];
    const edges = getEdges() as CanvasEdge[];

    // Purge context items from nodes
    const purgedNodes: CanvasNode[] = nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        metadata: {
          ...node.data?.metadata,
          contextItems: purgeContextItems(node.data?.metadata?.contextItems as IContextItem[]),
        },
      },
    }));

    const currentState = await get(`canvas-state:${canvasId}`);
    const currentStateData = getCanvasDataFromState(currentState);

    const diff = calculateCanvasStateDiff(currentStateData, {
      nodes: purgedNodes,
      edges,
    });

    if (diff) {
      console.log('[syncCanvasData] diff', diff);
      await update<CanvasState>(`canvas-state:${canvasId}`, (state) => ({
        ...state,
        transactions: [...(state?.transactions ?? []), diff],
      }));
    }
  }, 200);

  return {
    syncCanvasData,
    undoManager,
  };
};
