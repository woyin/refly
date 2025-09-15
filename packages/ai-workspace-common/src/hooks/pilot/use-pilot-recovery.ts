import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from 'antd';
import { useRecoverPilotSession } from '@refly-packages/ai-workspace-common/queries';
import { usePilotStoreShallow, useActionResultStoreShallow } from '@refly/stores';
import { useQueryClient } from '@tanstack/react-query';
import { useActionPolling } from '@refly-packages/ai-workspace-common/hooks/canvas/use-action-polling';
import { PilotStep } from '@refly/openapi-schema';

export interface UsePilotRecoveryOptions {
  canvasId: string;
  sessionId: string;
  onSuccess?: () => void;
  onError?: (error: any) => void;
}

export const usePilotRecovery = ({
  canvasId,
  sessionId,
  onSuccess,
  onError,
}: UsePilotRecoveryOptions) => {
  const { t } = useTranslation();
  const recoverMutation = useRecoverPilotSession();
  const queryClient = useQueryClient();

  const { setActiveSessionId } = usePilotStoreShallow((state) => ({
    setActiveSessionId: state.setActiveSessionId,
  }));

  const { removeActionResult, removeStreamResult, removeTraceId, removePollingState } =
    useActionResultStoreShallow((state) => ({
      removeActionResult: state.removeActionResult,
      removeStreamResult: state.removeStreamResult,
      removeTraceId: state.removeTraceId,
      removePollingState: state.removePollingState,
    }));

  const { resetFailedState, stopPolling } = useActionPolling();

  /**
   * Clear cache and state for specific steps to reset to initial state
   */
  const clearStepCache = useCallback(
    async (steps: PilotStep[]) => {
      for (const step of steps) {
        if (step.entityId) {
          // 1. Invalidate React Query cache for ActionResult
          await queryClient.invalidateQueries({
            queryKey: ['GetActionResult', { query: { resultId: step.entityId } }],
          });

          // 2. Remove ActionResult from Zustand store (also clears localStorage via persist)
          removeActionResult(step.entityId);

          // 3. Reset failed state to allow polling restart
          resetFailedState(step.entityId);

          // 4. Clear polling state to reset to initial state
          stopPolling(step.entityId);
          removePollingState(step.entityId);

          // 5. Remove from stream results if exists
          removeStreamResult(step.entityId);

          // 6. Clear trace ID mapping
          removeTraceId(step.entityId);

          console.log(
            `[Pilot Recovery] Cleared all cache and state for step ${step.stepId} (${step.entityId})`,
          );
        }
      }
    },
    [
      queryClient,
      removeActionResult,
      removeStreamResult,
      removeTraceId,
      removePollingState,
      resetFailedState,
      stopPolling,
    ],
  );

  /**
   * Recover pilot session with comprehensive state management
   */
  const recoverSession = useCallback(
    async (stepIds?: string[]) => {
      try {
        // Call the recovery API
        await recoverMutation.mutateAsync({
          body: {
            sessionId,
            stepIds,
          },
        });

        // Set the recovered session as active to enable polling and status sync
        setActiveSessionId(canvasId, sessionId);

        // Force refresh session details to get the latest status immediately
        await queryClient.invalidateQueries({
          queryKey: ['GetPilotSessionDetail', { query: { sessionId } }],
        });

        // Also invalidate the pilot session list to update the status in the list
        await queryClient.invalidateQueries({
          queryKey: ['ListPilotSessions'],
        });

        console.log(
          `[Pilot Recovery] Successfully recovered session ${sessionId}${stepIds ? ` with steps: ${stepIds.join(', ')}` : ''}`,
        );

        onSuccess?.();
      } catch (error) {
        console.error('Failed to recover session:', error);
        onError?.(error);
        throw error;
      }
    },
    [recoverMutation, sessionId, setActiveSessionId, canvasId, queryClient, onSuccess, onError],
  );

  /**
   * Recover specific steps with cache clearing
   */
  const recoverSteps = useCallback(
    async (steps: PilotStep[]) => {
      const stepIds = steps.map((step) => step.stepId).filter(Boolean) as string[];

      if (stepIds.length === 0) {
        message.error(t('pilot.stepRecovery.error.noStepId'));
        return;
      }

      try {
        // Recover the steps
        await recoverSession(stepIds);

        // Clear cache for the specific steps
        await clearStepCache(steps);

        message.success(t('pilot.stepRecovery.success'));
      } catch {
        message.error(t('pilot.stepRecovery.error.general'));
      }
    },
    [recoverSession, clearStepCache, t],
  );

  /**
   * Recover all failed steps in a session
   */
  const recoverAllFailedSteps = useCallback(
    async (failedSteps: PilotStep[]) => {
      try {
        // Recover all failed steps (no stepIds means recover all failed steps)
        await recoverSession();

        // Clear cache for all failed steps
        await clearStepCache(failedSteps);

        message.success(t('pilot.recovery.success'));
      } catch {
        message.error(t('pilot.recovery.error'));
      }
    },
    [recoverSession, clearStepCache, t],
  );

  return {
    recoverSession,
    recoverSteps,
    recoverAllFailedSteps,
    clearStepCache,
    isRecovering: recoverMutation.isPending,
  };
};
