import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import { get, set, update } from 'idb-keyval';
import { message } from 'antd';
import { Node, Edge, useStoreApi, InternalNode } from '@xyflow/react';
import { adoptUserNodes, updateConnectionLookup } from '@xyflow/system';
import { CanvasState } from '@refly/openapi-schema';
import { RawCanvasData } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import {
  getCanvasDataFromState,
  mergeCanvasStates,
  CanvasConflictException,
} from '@refly/canvas-common';

interface CanvasContextType {
  canvasId: string;
  readonly: boolean;
  loading: boolean;
  shareLoading: boolean;
  shareNotFound?: boolean;
  shareData?: RawCanvasData;
  isPolling: boolean;
  lastUpdated?: number;
}

// HTTP interface to get canvas state
const getCanvasState = async (canvasId: string): Promise<CanvasState> => {
  const { data, error } = await getClient().getCanvasState({ query: { canvasId } });
  if (error) {
    throw error;
  }
  return data.data;
};

// Sync canvas state with remote
const syncWithRemote = async (canvasId: string) => {
  const state = await get<CanvasState>(`canvas-state:${canvasId}`);
  if (!state) {
    return;
  }

  const unsyncedTransactions = state?.transactions?.filter(
    (tx) => !tx.syncedAt && !tx.revoked && !tx.deleted,
  );

  if (!unsyncedTransactions?.length) {
    return;
  }

  console.log('[syncWithRemote] unsynced transactions', unsyncedTransactions);

  const { error, data } = await getClient().syncCanvasState({
    body: {
      canvasId,
      version: state.version,
      transactions: unsyncedTransactions,
    },
  });

  if (!error && data?.success) {
    await update<CanvasState>(`canvas-state:${canvasId}`, (state) => ({
      ...state,
      transactions: state?.transactions?.map((tx) => ({
        ...tx,
        syncedAt: tx.syncedAt ?? Date.now(),
      })),
    }));
  } else {
    message.error('Failed to sync canvas state');
  }
};

const CanvasContext = createContext<CanvasContextType | null>(null);

const getInternalState = ({
  nodes,
  edges,
  nodeLookup = new Map<string, InternalNode>(),
  parentLookup = new Map(),
  connectionLookup = new Map(),
  edgeLookup = new Map(),
}: {
  nodes?: Node[];
  edges?: Edge[];
  nodeLookup?: Map<string, InternalNode>;
  parentLookup?: Map<string, any>;
  connectionLookup?: Map<string, any>;
  edgeLookup?: Map<string, any>;
} = {}) => {
  updateConnectionLookup(connectionLookup, edgeLookup, edges);
  adoptUserNodes(nodes, nodeLookup, parentLookup, {
    elevateNodesOnSelect: false,
  });

  return {
    nodes,
    edges,
  };
};

export const CanvasProvider = ({
  canvasId,
  readonly = false,
  children,
}: {
  canvasId: string;
  readonly?: boolean;
  children: React.ReactNode;
}) => {
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>();
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstPollRef = useRef(true);
  // const POLLING_INTERVAL = 500000; // 5 seconds

  const { setState, getState } = useStoreApi();

  // Use the hook to fetch canvas data when in readonly mode
  const {
    data: canvasData,
    error: canvasError,
    loading: shareLoading,
  } = useFetchShareData<RawCanvasData>(readonly ? canvasId : undefined);

  // Check if it's a 404 error
  const shareNotFound = useMemo(() => {
    if (!canvasError) return false;
    return (
      canvasError.message.includes('404') ||
      canvasError.message.includes('Failed to fetch share data: 404')
    );
  }, [canvasError]);

  // Set canvas data from API response when in readonly mode
  useEffect(() => {
    if (readonly && canvasData) {
      const { nodeLookup, parentLookup, connectionLookup, edgeLookup } = getState();
      const { nodes, edges } = canvasData;
      const internalState = getInternalState({
        nodes: nodes && Array.isArray(nodes) ? (nodes as unknown as Node[]) : [],
        edges: edges && Array.isArray(edges) ? (edges as unknown as Edge[]) : [],
        nodeLookup,
        parentLookup,
        connectionLookup,
        edgeLookup,
      });
      setState(internalState);
    }
  }, [readonly, canvasData, canvasId]);

  // Set up sync job that runs every 2 seconds
  const isSyncingRemoteRef = useRef(false);
  useEffect(() => {
    if (!canvasId || readonly) return;

    const intervalId = setInterval(async () => {
      // Prevent multiple instances from running simultaneously
      if (isSyncingRemoteRef.current) return;

      isSyncingRemoteRef.current = true;
      try {
        await syncWithRemote(canvasId);
      } catch (error) {
        console.error('Canvas sync failed:', error);
      } finally {
        isSyncingRemoteRef.current = false;
      }
    }, 3000); // Run every 3 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [canvasId]);

  // Function to update canvas data from state
  const updateCanvasDataFromState = useCallback(
    (state: CanvasState) => {
      const { nodeLookup, parentLookup, connectionLookup, edgeLookup } = getState();
      const { nodes, edges } = getCanvasDataFromState(state);

      const internalState = getInternalState({
        nodes: nodes && Array.isArray(nodes) ? (nodes as unknown as Node[]) : [],
        edges: edges && Array.isArray(edges) ? (edges as unknown as Edge[]) : [],
        nodeLookup,
        parentLookup,
        connectionLookup,
        edgeLookup,
      });
      setState(internalState);
      setLastUpdated(Date.now());
    },
    [getState, setState],
  );

  // Polling function to fetch canvas state
  const initialFetchCanvasState = useCallback(async () => {
    if (readonly) return;

    try {
      const localState = await get(`canvas-state:${canvasId}`);
      console.log('localState', localState);

      // Only set loading when local state is not found
      if (!localState) {
        setLoading(true);
      }

      const remoteState = await getCanvasState(canvasId);
      console.log('remoteState', remoteState);

      let finalState: CanvasState;
      if (!localState) {
        finalState = remoteState;
      } else {
        try {
          finalState = mergeCanvasStates(localState, remoteState);
        } catch (error) {
          if (error instanceof CanvasConflictException) {
            // TODO: Handle conflict by showing a modal to the user
            console.error('Canvas conflict detected:', error);
            finalState = remoteState;
          } else {
            console.error('Failed to merge canvas states:', error);
            finalState = remoteState;
          }
          console.error('Failed to merge canvas states:', error);
          finalState = remoteState;
        }
      }

      updateCanvasDataFromState(finalState);

      await set(`canvas-state:${canvasId}`, finalState);

      // Mark first poll as complete
      if (isFirstPollRef.current) {
        isFirstPollRef.current = false;
      }
    } catch (error) {
      console.error('Failed to poll canvas state:', error);
    } finally {
      // Only clear loading if it was the first poll
      if (loading) {
        setLoading(false);
      }
    }
  }, [canvasId, readonly, updateCanvasDataFromState, loading]);

  // Start/stop polling
  useEffect(() => {
    if (readonly) return;

    setIsPolling(true);

    // Initial fetch
    initialFetchCanvasState();

    // intervalRef.current = setInterval(pollCanvasState, POLLING_INTERVAL);

    return () => {
      setIsPolling(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [canvasId, readonly, initialFetchCanvasState]);

  // Cleanup on unmount
  useEffect(() => {
    if (readonly) return;

    return () => {
      // Clear canvas data
      setState({ nodes: [], edges: [] });
      setLoading(false);
      isFirstPollRef.current = true;
    };
  }, [canvasId, readonly]);

  const canvasContext = useMemo<CanvasContextType>(
    () => ({
      loading,
      canvasId,
      readonly,
      shareLoading,
      shareNotFound,
      shareData: canvasData,
      isPolling,
      lastUpdated,
    }),
    [canvasId, readonly, shareNotFound, canvasData, shareLoading, isPolling, lastUpdated],
  );

  return <CanvasContext.Provider value={canvasContext}>{children}</CanvasContext.Provider>;
};

export const useCanvasContext = () => {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error('useCanvasContext must be used within a CanvasProvider');
  }
  return context;
};
