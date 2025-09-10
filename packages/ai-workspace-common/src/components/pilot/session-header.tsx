import { Button, Divider, Popover, Tooltip, message } from 'antd';
import { History, Refresh } from 'refly-icons';
import { memo, useCallback, useState } from 'react';
import { PilotSession, PilotStep } from '@refly/openapi-schema';
import { PilotList } from '@refly-packages/ai-workspace-common/components/pilot/pilot-list';
import { useTranslation } from 'react-i18next';
import { usePilotStoreShallow, useActionResultStoreShallow } from '@refly/stores';
import { ScreenDefault, ScreenFull } from 'refly-icons';
import { SessionStatusTag } from '@refly-packages/ai-workspace-common/components/pilot/session-status-tag';
import { NewTaskButton } from '@refly-packages/ai-workspace-common/components/pilot/session-container';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { useRecoverPilotSession } from '@refly-packages/ai-workspace-common/queries';
import { useQueryClient } from '@tanstack/react-query';
import { useActionPolling } from '@refly-packages/ai-workspace-common/hooks/canvas/use-action-polling';
const SessionHeader = memo(
  ({
    canvasId,
    session,
    steps,
    onClick,
    onSessionClick,
  }: {
    canvasId: string;
    session?: PilotSession;
    steps: PilotStep[];
    onClick: () => void;
    onSessionClick: (sessionId: string) => void;
  }) => {
    const { isPilotOpen, setActiveSessionId } = usePilotStoreShallow((state) => ({
      isPilotOpen: state.isPilotOpen,
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
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const handleSessionClick = useCallback(
      (sessionId: string) => {
        onSessionClick(sessionId);
        setIsHistoryOpen(false);
      },
      [onSessionClick],
    );
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    // Recovery mutation
    const recoverMutation = useRecoverPilotSession();

    const handleRecoverSession = useCallback(async () => {
      if (!session?.sessionId) return;

      try {
        await recoverMutation.mutateAsync({
          path: { sessionId: session.sessionId },
        });

        // Set the recovered session as active to enable polling and status sync
        setActiveSessionId(canvasId, session.sessionId);

        // Force refresh session details to get the latest status immediately
        await queryClient.invalidateQueries({
          queryKey: ['GetPilotSessionDetail', { query: { sessionId: session.sessionId } }],
        });

        // Completely clear all cache and state for failed steps to reset to initial state
        const failedSteps = steps?.filter((step) => step.status === 'failed') || [];
        for (const step of failedSteps) {
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
              `[Recovery] Cleared all cache and state for step ${step.stepId} (${step.entityId})`,
            );
          }
        }

        console.log(
          `[Recovery] Successfully processed ${failedSteps.length} failed steps for recovery`,
        );

        message.success(
          t('pilot.recovery.success', {
            defaultValue: 'Session recovery started successfully',
          }),
        );
      } catch (error) {
        message.error(
          t('pilot.recovery.error', {
            defaultValue: 'Failed to recover session',
          }),
        );
        console.error('Failed to recover session:', error);
      }
    }, [
      session?.sessionId,
      recoverMutation,
      setActiveSessionId,
      canvasId,
      queryClient,
      removeActionResult,
      removeStreamResult,
      removeTraceId,
      removePollingState,
      resetFailedState,
      stopPolling,
      steps,
      t,
    ]);
    return (
      <div className="flex items-center justify-between w-full p-4">
        {/* Header Left */}
        <div className="flex items-center gap-1">
          <Logo logoProps={{ show: false }} />
          <span className="text-refly-text-0 text-[14px] font-semibold ml-0.5">Agent</span>
          {session ? <SessionStatusTag status={session?.status} steps={steps} /> : null}
        </div>
        {/* Header Right */}
        <div className="flex items-center gap-2">
          {!isPilotOpen && session?.status === 'finish' && (
            <NewTaskButton className="p-0 mr-1" canvasId={canvasId} />
          )}
          {session?.status === 'failed' && (
            <Tooltip
              title={t('pilot.recovery.title', {
                defaultValue: 'Recover Session',
              })}
            >
              <Button
                type="text"
                size="small"
                loading={recoverMutation.isPending}
                className="flex items-center justify-center text-refly-text-0 hover:text-refly-primary-default"
                icon={<Refresh size={16} />}
                onClick={handleRecoverSession}
              />
            </Tooltip>
          )}
          <Popover
            open={isHistoryOpen}
            onOpenChange={setIsHistoryOpen}
            placement="bottomRight"
            trigger="click"
            getPopupContainer={() => document.body}
            arrow={false}
            content={
              <PilotList
                show={isHistoryOpen}
                limit={10}
                targetId={canvasId}
                targetType="canvas"
                onSessionClick={(session) => handleSessionClick(session.sessionId)}
              />
            }
          >
            <Tooltip
              title={t('pilot.sessionHistory', {
                defaultValue: 'Session History',
              })}
            >
              <Button
                type="text"
                size="small"
                className={`flex items-center justify-center ${isHistoryOpen ? 'text-refly-primary-default' : 'text-refly-text-0'}`}
                icon={<History size={16} />}
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              />
            </Tooltip>
          </Popover>
          <Divider type="vertical" className="bg-refly-Card-Border !m-0" />
          <Button
            type="text"
            size="small"
            className="flex items-center justify-center text-refly-text-0"
            onClick={onClick}
            icon={isPilotOpen ? <ScreenDefault size={16} /> : <ScreenFull size={16} />}
          />
        </div>
      </div>
    );
  },
);

export default SessionHeader;
