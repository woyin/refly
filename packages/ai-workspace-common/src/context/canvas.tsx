import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import { get, set } from 'idb-keyval';
import { Node, Edge, useStoreApi, InternalNode } from '@xyflow/react';
import { adoptUserNodes, updateConnectionLookup } from '@xyflow/system';
import { RawCanvasData } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';

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
const getCanvasState = async (canvasId: string): Promise<RawCanvasData> => {
  const { data, error } = await getClient().getCanvasState({ query: { canvasId } });
  if (error) {
    throw error;
  }
  return data.data;
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
  const POLLING_INTERVAL = 500000; // 5 seconds

  const { setState, getState } = useStoreApi();
  const { setCanvasTitle } = useCanvasStoreShallow((state) => ({
    setCanvasTitle: state.setCanvasTitle,
  }));

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

  // Function to update canvas data from HTTP response
  const updateCanvasDataFromHttp = useCallback(
    (data: RawCanvasData) => {
      const { nodeLookup, parentLookup, connectionLookup, edgeLookup } = getState();
      const { nodes, edges } = data;
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
  const pollCanvasState = useCallback(async () => {
    if (readonly) return;

    try {
      // Only set loading on first poll
      if (isFirstPollRef.current) {
        setLoading(true);
      }

      const data = await getCanvasState(canvasId);
      updateCanvasDataFromHttp(data);
      setCanvasTitle(canvasId, data?.title);

      if (!(await get(`canvas-state-remote:${canvasId}`))) {
        await set(`canvas-state-remote:${canvasId}`, data);
      }
      if (!(await get(`canvas-state:${canvasId}`))) {
        await set(`canvas-state:${canvasId}`, data);
      }

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
  }, [canvasId, readonly, updateCanvasDataFromHttp, loading]);

  // Start/stop polling
  useEffect(() => {
    if (readonly) return;

    setIsPolling(true);

    // Initial fetch
    pollCanvasState();

    intervalRef.current = setInterval(pollCanvasState, POLLING_INTERVAL);

    return () => {
      setIsPolling(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [canvasId, readonly, pollCanvasState]);

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
