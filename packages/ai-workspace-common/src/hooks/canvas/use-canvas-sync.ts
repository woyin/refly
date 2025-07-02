import { useMemo } from 'react';
import { message } from 'antd';
import { get, set, update } from 'idb-keyval';
import { useDebouncedCallback, useThrottledCallback } from 'use-debounce';
import { Edge } from '@xyflow/react';
import { omit } from '@refly/utils';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { purgeContextItems, CanvasNode, calculateCanvasStateDiff } from '@refly/canvas-common';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

export const useCanvasSync = () => {
  const { canvasId } = useCanvasContext();
  const undoManager = useMemo(() => {
    // TODO: Implement undo manager
    return undefined;
  }, []);

  const syncWithRemote = useDebouncedCallback(async (canvasId: string) => {
    const remoteState = await get(`canvas-state-remote:${canvasId}`);
    const currentState = await get(`canvas-state:${canvasId}`);

    const { nodeDiffs, edgeDiffs } = calculateCanvasStateDiff(remoteState, currentState);
    console.log('syncWithRemote nodeDiffs', nodeDiffs);
    console.log('syncWithRemote edgeDiffs', edgeDiffs);

    if (!nodeDiffs?.length && !edgeDiffs?.length) {
      console.log('no diffs');
      return;
    }

    const { error, data } = await getClient().applyCanvasState({
      body: {
        canvasId,
        nodeDiffs,
        edgeDiffs,
      },
    });

    if (!error && data?.success) {
      await set(`canvas-state-remote:${canvasId}`, currentState);
    } else {
      message.error('Failed to sync canvas state');
    }
  }, 1000);

  const syncFunctions = useMemo(() => {
    const syncCanvasNodes = async (nodes: CanvasNode<any>[]) => {
      const nodesToSync = nodes || [];

      // Purge context items from nodes
      const purgedNodes = nodesToSync.map((node) => ({
        ...node,
        data: {
          ...node.data,
          metadata: {
            ...node.data?.metadata,
            contextItems: purgeContextItems(node.data?.metadata?.contextItems),
          },
        },
      }));

      await update(`canvas-state:${canvasId}`, (state) => ({
        ...state,
        nodes: purgedNodes,
      }));
      await syncWithRemote(canvasId);
    };

    const syncCanvasEdges = async (edges: Edge[]) => {
      if (!edges?.length) return;

      await update(`canvas-state:${canvasId}`, (state) => ({
        ...state,
        edges: edges.map((edge) => omit(edge, ['style'])),
      }));
      await syncWithRemote(canvasId);
    };

    return {
      syncCanvasNodes,
      syncCanvasEdges,
    };
  }, [canvasId]);

  const throttledSyncCanvasNodes = useThrottledCallback(syncFunctions.syncCanvasNodes, 500, {
    leading: true,
    trailing: true,
  });

  const throttledSyncCanvasEdges = useThrottledCallback(syncFunctions.syncCanvasEdges, 500, {
    leading: true,
    trailing: true,
  });

  return {
    ...syncFunctions,
    throttledSyncCanvasNodes,
    throttledSyncCanvasEdges,
    undoManager,
  };
};
