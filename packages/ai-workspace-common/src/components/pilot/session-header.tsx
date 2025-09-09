import { Button, Divider, Popover, Tooltip, message } from 'antd';
import { History, Refresh } from 'refly-icons';
import { memo, useCallback, useState } from 'react';
import { PilotSession, PilotStep } from '@refly/openapi-schema';
import { PilotList } from '@refly-packages/ai-workspace-common/components/pilot/pilot-list';
import { useTranslation } from 'react-i18next';
import { usePilotStoreShallow } from '@refly/stores';
import { ScreenDefault, ScreenFull } from 'refly-icons';
import { SessionStatusTag } from '@refly-packages/ai-workspace-common/components/pilot/session-status-tag';
import { NewTaskButton } from '@refly-packages/ai-workspace-common/components/pilot/session-container';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { useRecoverPilotSession } from '@refly-packages/ai-workspace-common/queries';
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
    const { isPilotOpen } = usePilotStoreShallow((state) => ({
      isPilotOpen: state.isPilotOpen,
    }));
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const handleSessionClick = useCallback(
      (sessionId: string) => {
        onSessionClick(sessionId);
        setIsHistoryOpen(false);
      },
      [onSessionClick],
    );
    const { t } = useTranslation();

    // Recovery mutation
    const recoverMutation = useRecoverPilotSession();

    const handleRecoverSession = useCallback(async () => {
      if (!session?.sessionId) return;

      try {
        await recoverMutation.mutateAsync({
          path: { sessionId: session.sessionId },
        });
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
    }, [session?.sessionId, recoverMutation, t]);
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
          {(1 || session?.status === 'failed') && (
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
