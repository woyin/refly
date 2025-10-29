import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, Button, Divider, Popover } from 'antd';
import { History, SideLeft, NewConversation } from 'refly-icons';
import { useListCopilotSessions } from '@refly-packages/ai-workspace-common/queries';
import { CopilotSession } from '@refly/openapi-schema';
import cn from 'classnames';
import { useCopilotStoreShallow } from '@refly/stores';

const mockSessions = (canvasId: string) => [
  ...(Array.from({ length: 10 }, (_, index) => ({
    sessionId: `history-${index + 1}`,
    title: `历史会话${index + 1}1111111111`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    canvasId,
  })) as CopilotSession[]),
];

interface CopilotHeaderProps {
  canvasId: string;
  sessionId: string | null;
  copilotWidth: number;
  setCopilotWidth: (width: number) => void;
}

export const CopilotHeader = memo(
  ({ canvasId, sessionId, copilotWidth, setCopilotWidth }: CopilotHeaderProps) => {
    const { t } = useTranslation();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    const { currentSessionId, setCurrentSessionId } = useCopilotStoreShallow((state) => ({
      currentSessionId: state.currentSessionId[canvasId] ?? null,
      setCurrentSessionId: state.setCurrentSessionId,
    }));

    const { data } = useListCopilotSessions(
      {
        query: {
          canvasId,
        },
      },
      [],
      { enabled: !!canvasId },
    );

    console.log('currentSessionId', currentSessionId);

    useEffect(() => {
      if (data && !currentSessionId) {
        const sessions = data.data ?? [];
        if (sessions.length > 0) {
          setCurrentSessionId(canvasId, sessions[0].sessionId);
        }
      }
    }, [canvasId, data, currentSessionId, setCurrentSessionId]);

    const sessionHistory = useMemo(() => {
      return data?.data || mockSessions(canvasId);
    }, [data, canvasId]);

    const showDivider = useMemo(() => {
      return sessionHistory.length > 0 || !!sessionId;
    }, [sessionHistory, sessionId]);

    const handleClose = useCallback(() => {
      if (copilotWidth === 0) {
        return;
      }

      setCopilotWidth(0);
    }, [copilotWidth, setCopilotWidth]);

    const handleSessionClick = useCallback(
      (sessionId: string) => {
        setCurrentSessionId(canvasId, sessionId);
        setIsHistoryOpen(false);
      },
      [canvasId, setCurrentSessionId],
    );

    const content = useMemo(() => {
      return (
        <div className="max-h-[400px] overflow-y-auto">
          {sessionHistory.map((session) => (
            <div
              key={session.sessionId}
              className="flex items-center gap-1 hover:bg-refly-tertiary-hover p-1 rounded-lg cursor-pointer"
              onClick={() => handleSessionClick(session.sessionId)}
            >
              <div className="w-7 h-7 flex items-center justify-center">
                <History size={20} />
              </div>
              <div className="max-w-[400px] truncate text-refly-text-0 text-sm leading-5">
                {session.title}
              </div>
            </div>
          ))}
        </div>
      );
    }, [sessionHistory]);

    return (
      <div className="h-[46px] px-4 py-3 flex items-center gap-3 justify-between">
        <div className="text-refly-text-0 text-base font-semibold leading-[26px]">
          {t('copilot.title')}
        </div>

        <div className="flex items-center gap-3">
          {sessionHistory.length > 0 && (
            <Tooltip title={t('copilot.header.history')}>
              <Popover
                open={isHistoryOpen}
                onOpenChange={setIsHistoryOpen}
                placement="bottomLeft"
                trigger="click"
                arrow={false}
                content={content}
              >
                <Button
                  className={cn(
                    'flex items-center justify-center',
                    isHistoryOpen ? 'bg-refly-tertiary-hover' : '',
                  )}
                  size="small"
                  type="text"
                  icon={<History size={18} />}
                />
              </Popover>
            </Tooltip>
          )}

          {sessionId && (
            <Tooltip title={t('copilot.header.newConversation')}>
              <Button
                className="flex items-center justify-center"
                size="small"
                type="text"
                icon={<NewConversation size={18} />}
                onClick={() => setCurrentSessionId(canvasId, null)}
              />
            </Tooltip>
          )}

          {showDivider && <Divider type="vertical" className="m-0 h-4 bg-refly-Card-Border" />}

          <Tooltip title={t('copilot.header.close')}>
            <Button
              className="flex items-center justify-center"
              size="small"
              type="text"
              icon={<SideLeft size={18} />}
              onClick={handleClose}
            />
          </Tooltip>
        </div>
      </div>
    );
  },
);

CopilotHeader.displayName = 'CopilotHeader';
