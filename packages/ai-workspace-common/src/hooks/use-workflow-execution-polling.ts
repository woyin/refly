import { useCallback, useEffect, useRef, useState } from 'react';
import { useGetWorkflowDetail } from '@refly-packages/ai-workspace-common/queries';
import { WorkflowExecutionStatus } from '@refly/openapi-schema';
import { useCanvasStoreShallow } from '@refly/stores';

interface UseWorkflowExecutionPollingOptions {
  executionId: string | null;
  canvasId: string;
  enabled?: boolean;
  interval?: number;
  onStatusChange?: (status: WorkflowExecutionStatus) => void;
  onComplete?: (status: WorkflowExecutionStatus, data?: any) => void;
  onError?: (error: any) => void;
}

interface UseWorkflowExecutionPollingReturn {
  status: WorkflowExecutionStatus | null;
  data: any;
  isLoading: boolean;
  error: any;
  isPolling: boolean;
  startPolling: () => void;
  stopPolling: () => void;
}

export const useWorkflowExecutionPolling = ({
  executionId,
  canvasId,
  enabled = true,
  interval = 3000,
  onStatusChange,
  onComplete,
  onError,
}: UseWorkflowExecutionPollingOptions): UseWorkflowExecutionPollingReturn => {
  const [isPolling, setIsPolling] = useState(false);
  const [status, setStatus] = useState<WorkflowExecutionStatus | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  // Read executionId from canvas store (persisted) and provide a way to clear it when done
  const { storeExecutionId, setCanvasExecutionId, setCanvasNodeExecutions } = useCanvasStoreShallow(
    (state) => ({
      storeExecutionId: state.canvasExecutionId[canvasId] ?? null,
      setCanvasExecutionId: state.setCanvasExecutionId,
      setCanvasNodeExecutions: state.setCanvasNodeExecutions,
    }),
  );

  // Prefer store executionId; fallback to provided one
  const currentExecutionId = (storeExecutionId ?? executionId) || null;

  // Use the existing useGetWorkflowDetail hook
  const { data, isLoading, error, refetch } = useGetWorkflowDetail(
    { query: { executionId: currentExecutionId } },
    undefined,
    {
      enabled: false, // We'll manually trigger refetch
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  );

  const startPolling = useCallback(() => {
    if (!currentExecutionId || isPollingRef.current) {
      return;
    }

    setIsPolling(true);
    isPollingRef.current = true;

    // Initial fetch
    refetch();

    // Set up interval for polling
    intervalRef.current = setInterval(() => {
      if (isPollingRef.current && currentExecutionId) {
        refetch();
      }
    }, interval);
  }, [currentExecutionId, interval, refetch]);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
    isPollingRef.current = false;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Extract status from the response data
  const currentStatus = data?.data?.status as WorkflowExecutionStatus | undefined;
  const nodeExecutions = data?.data?.nodeExecutions || [];

  // Update nodeExecutions in canvas store when data changes
  useEffect(() => {
    if (nodeExecutions?.length > 0 && canvasId) {
      setCanvasNodeExecutions(canvasId, nodeExecutions);
    }
  }, [nodeExecutions, canvasId, setCanvasNodeExecutions]);

  // Update status when data changes
  useEffect(() => {
    if (!currentStatus) {
      return;
    }

    if (currentStatus !== status) {
      setStatus(currentStatus);
      onStatusChange?.(currentStatus);
    }

    // If finished or failed, stop polling and clear executionId and nodeExecutions from store
    if (currentStatus === 'finish' || currentStatus === 'failed') {
      stopPolling();
      if (canvasId) {
        setCanvasExecutionId(canvasId, null);
        setCanvasNodeExecutions(canvasId, null);
      }
      onComplete?.(currentStatus, data);
    }
  }, [
    currentStatus,
    status,
    onStatusChange,
    onComplete,
    data,
    canvasId,
    setCanvasExecutionId,
    setCanvasNodeExecutions,
    stopPolling,
  ]);

  // Handle errors
  useEffect(() => {
    if (error) {
      onError?.(error);
    }
  }, [error, onError]);

  // Auto-start polling when executionId is available and enabled
  useEffect(() => {
    if (currentExecutionId && enabled && !isPollingRef.current) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [currentExecutionId, enabled, startPolling, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    status,
    data: data?.data,
    isLoading,
    error,
    isPolling,
    startPolling,
    stopPolling,
  };
};
