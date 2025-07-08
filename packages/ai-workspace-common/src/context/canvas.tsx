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
import { Node, Edge, useStoreApi, InternalNode, useReactFlow } from '@xyflow/react';
import { adoptUserNodes, updateConnectionLookup } from '@xyflow/system';
import { CanvasEdge, CanvasNode, CanvasState, CanvasTransaction } from '@refly/openapi-schema';
import { RawCanvasData } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import {
  getCanvasDataFromState,
  mergeCanvasStates,
  CanvasConflictException,
  purgeContextItems,
  calculateCanvasStateDiff,
  getLastTransaction,
} from '@refly/canvas-common';
import {
  useCanvasStore,
  useCanvasStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/canvas';
import { useDebouncedCallback } from 'use-debounce';
import { IContextItem } from '@refly/common-types';
import { useGetCanvasDetail } from '@refly-packages/ai-workspace-common/queries';

// Remote sync interval
const SYNC_REMOTE_INTERVAL = 2000;

// Poll remote interval
const POLL_TX_INTERVAL = 3000;

// Max number of transactions in a state
// If the number of transactions is greater than this threshold, a new version will be created
const MAX_STATE_TX_COUNT = 100;

// Max version age (1 hour) in milliseconds
// If the last transaction is older than this threshold, a new version will be created
const MAX_VERSION_AGE = 1000 * 60 * 60;

interface CanvasContextType {
  canvasId: string;
  readonly: boolean;
  loading: boolean;
  shareLoading: boolean;
  shareNotFound?: boolean;
  shareData?: RawCanvasData;
  lastUpdated?: number;

  syncCanvasData: () => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

// HTTP interface to get canvas state
const getCanvasState = async (canvasId: string): Promise<CanvasState> => {
  const { data } = await getClient().getCanvasState({ query: { canvasId } });
  return data?.data;
};

// Poll canvas transactions from server
const pollCanvasTransactions = async (
  canvasId: string,
  version: string,
): Promise<CanvasTransaction[]> => {
  const { data, error } = await getClient().getCanvasTransactions({
    query: {
      canvasId,
      version,
      since: Date.now() - 5000, // 5 seconds ago
    },
  });
  if (error) {
    throw error;
  }
  return data.data;
};

const createCanvasVersion = async (canvasId: string, state: CanvasState) => {
  const { data } = await getClient().createCanvasVersion({
    body: { canvasId, state },
  });
  return data?.data;
};

// Sync canvas state with remote
const syncWithRemote = async (canvasId: string) => {
  const state = await get<CanvasState>(`canvas-state:${canvasId}`);
  if (!state) {
    return;
  }

  // If the number of transactions is greater than the threshold, create a new version
  if (state.transactions?.length > MAX_STATE_TX_COUNT) {
    const newState = await createCanvasVersion(canvasId, state);
    await set(`canvas-state:${canvasId}`, newState);
    return;
  }

  const unsyncedTransactions = state?.transactions?.filter((tx) => !tx.syncedAt);

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
    console.log('[syncWithRemote] synced successfully');
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
  const [lastUpdated, setLastUpdated] = useState<number>();
  const [loading, setLoading] = useState(false);

  const isSyncingRemoteRef = useRef(false); // Lock for syncWithRemote
  const isSyncingLocalRef = useRef(false); // Lock for syncCanvasData

  const { setState, getState } = useStoreApi();
  const { setCanvasTitle, setCanvasInitialized } = useCanvasStoreShallow((state) => ({
    setCanvasTitle: state.setCanvasTitle,
    setCanvasInitialized: state.setCanvasInitialized,
  }));

  const { data: canvasDetail } = useGetCanvasDetail({ query: { canvasId } }, null, {
    enabled: !readonly && !!canvasId,
  });

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
    if (readonly) {
      if (!canvasData) return;
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
    } else {
      if (!canvasDetail?.data?.title) return;
      setCanvasTitle(canvasId, canvasDetail.data.title);
    }
  }, [readonly, canvasData, canvasDetail, canvasId]);

  // Set up sync job that runs every 2 seconds
  useEffect(() => {
    if (!canvasId || readonly) return;

    const intervalId = setInterval(async () => {
      // Prevent multiple instances from running simultaneously
      if (isSyncingRemoteRef.current) return;

      const { canvasInitialized } = useCanvasStore.getState();
      if (!canvasInitialized[canvasId]) {
        return;
      }

      isSyncingRemoteRef.current = true;
      try {
        await syncWithRemote(canvasId);
      } catch (error) {
        console.error('Canvas sync failed:', error);
      } finally {
        isSyncingRemoteRef.current = false;
      }
    }, SYNC_REMOTE_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [canvasId]);

  const { getNodes, getEdges } = useReactFlow();

  // Sync canvas data to local state
  const syncCanvasData = useDebouncedCallback(async () => {
    // Prevent multiple concurrent sync operations
    if (isSyncingLocalRef.current) {
      return;
    }

    const { canvasInitialized } = useCanvasStore.getState();
    if (!canvasInitialized[canvasId]) {
      console.log('[syncCanvasData] canvas not initialized', canvasId);
      return;
    }

    isSyncingLocalRef.current = true;

    try {
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
        console.log('currentStateData', currentStateData);
        console.log('dynamic data', {
          nodes: purgedNodes,
          edges,
        });
        console.log('diff', diff);

        await update<CanvasState>(`canvas-state:${canvasId}`, (state) => ({
          ...state,
          transactions: [...(state?.transactions?.filter((tx) => !tx.revoked) ?? []), diff],
        }));
      }
    } finally {
      isSyncingLocalRef.current = false;
    }
  }, 500);

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
      const localState = await get<CanvasState>(`canvas-state:${canvasId}`);
      console.log('localState', localState);

      // Only set loading when local state is not found
      if (!localState) {
        setLoading(true);
      }

      const remoteState = await getCanvasState(canvasId);
      if (!remoteState) {
        return;
      }
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

      const lastTransaction = getLastTransaction(finalState);
      if (
        finalState.transactions?.length > MAX_STATE_TX_COUNT ||
        lastTransaction?.createdAt < Date.now() - MAX_VERSION_AGE
      ) {
        await createCanvasVersion(canvasId, finalState);
      }

      updateCanvasDataFromState(finalState);

      await set(`canvas-state:${canvasId}`, finalState);

      setCanvasInitialized(canvasId, true);
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

    // Initial fetch
    initialFetchCanvasState();
  }, [canvasId, readonly, initialFetchCanvasState]);

  const undo = useCallback(async () => {
    const currentState = await get(`canvas-state:${canvasId}`);
    const transactions = currentState?.transactions;
    if (Array.isArray(transactions) && transactions.length > 0) {
      // Find the last transaction where revoked is false
      for (let i = transactions.length - 1; i >= 0; i--) {
        if (!transactions[i]?.revoked) {
          transactions[i].revoked = true;
          transactions[i].syncedAt = undefined;
          await set(`canvas-state:${canvasId}`, currentState);
          updateCanvasDataFromState(currentState);
          break;
        }
      }
    }
  }, [canvasId, updateCanvasDataFromState]);

  const redo = useCallback(async () => {
    const currentState = await get(`canvas-state:${canvasId}`);
    const transactions = currentState?.transactions;
    if (Array.isArray(transactions) && transactions.length > 0) {
      // Find the first transaction where revoked is true
      for (let i = 0; i < transactions.length; i++) {
        if (transactions[i]?.revoked) {
          transactions[i].revoked = false;
          transactions[i].syncedAt = undefined;
          await set(`canvas-state:${canvasId}`, currentState);
          updateCanvasDataFromState(currentState);
          break;
        }
      }
    }
  }, [canvasId, updateCanvasDataFromState]);

  // Poll server transactions and merge to local state
  useEffect(() => {
    if (readonly || !canvasId) return;

    let polling = true;
    let intervalId: NodeJS.Timeout | null = null;

    const poll = async () => {
      if (!polling) return;
      try {
        // Get local CanvasState
        const localState = await get<CanvasState>(`canvas-state:${canvasId}`);
        if (!localState) {
          // If local state is not found, skip this poll
          return;
        }

        const { canvasInitialized } = useCanvasStore.getState();
        if (!canvasInitialized[canvasId]) {
          console.log('[pollCanvasTransactions] canvas not initialized', canvasId);
          return;
        }

        const version = localState?.version ?? '';
        const localTxIds = new Set(localState?.transactions?.map((tx) => tx.txId) ?? []);

        // Pull new transactions from server
        const remoteTxs = await pollCanvasTransactions(canvasId, version);
        // Filter out transactions that already exist locally
        const newTxs = remoteTxs?.filter((tx) => !localTxIds.has(tx.txId)) ?? [];
        if (newTxs.length > 0) {
          // Merge transactions to local state
          const updatedState = {
            ...localState,
            transactions: [...(localState.transactions ?? []), ...newTxs],
          };
          updatedState.transactions.sort((a, b) => a.createdAt - b.createdAt);
          await set(`canvas-state:${canvasId}`, updatedState);
          updateCanvasDataFromState(updatedState);
        }
      } catch (err) {
        console.error('[pollCanvasTransactions] failed:', err);
      }
    };

    intervalId = setInterval(poll, POLL_TX_INTERVAL);

    return () => {
      polling = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [canvasId, readonly, updateCanvasDataFromState]);

  // Cleanup on unmount
  useEffect(() => {
    if (readonly) return;

    return () => {
      // Clear canvas data
      setState({ nodes: [], edges: [] });
      setLoading(false);
      setCanvasInitialized(canvasId, false);
    };
  }, [canvasId, readonly]);

  return (
    <CanvasContext.Provider
      value={{
        loading,
        canvasId,
        readonly,
        shareLoading,
        shareNotFound,
        shareData: canvasData,
        lastUpdated,
        syncCanvasData,
        undo,
        redo,
      }}
    >
      {children}
    </CanvasContext.Provider>
  );
};

export const useCanvasContext = () => {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error('useCanvasContext must be used within a CanvasProvider');
  }
  return context;
};
