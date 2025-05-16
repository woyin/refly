import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EntityType, PilotSession } from '@refly/openapi-schema';
import { Button, Empty, List, Skeleton } from 'antd';
import { SessionStatusTag } from './session-status-tag';
import { cn } from '@refly/utils/cn';
import { useListPilotSessions } from '@refly-packages/ai-workspace-common/queries/queries';

export interface PilotListProps {
  className?: string;
  limit?: number;
  targetId?: string;
  targetType?: EntityType;
  onSessionClick?: (session: PilotSession) => void;
}

export const PilotList = memo(
  ({ className, limit = 10, targetId, targetType, onSessionClick }: PilotListProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    // Fetch pilot sessions
    const {
      data: sessionsData,
      isLoading,
      refetch,
    } = useListPilotSessions({
      query: {
        targetId,
        targetType,
        page: 1,
        pageSize: limit,
      },
      throwOnError: true,
    });

    const sessions = useMemo(() => sessionsData?.data ?? [], [sessionsData]);

    const handleSessionClick = useCallback(
      (session: PilotSession) => {
        if (onSessionClick) {
          onSessionClick(session);
        } else {
          navigate(`/pilot/${session.sessionId}`);
        }
      },
      [navigate, onSessionClick],
    );

    const formatDate = useCallback((dateString?: string) => {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        return date.toLocaleString();
      } catch (e) {
        console.error(e);
        return dateString;
      }
    }, []);

    if (isLoading && sessions.length === 0) {
      return (
        <div className={cn('p-4 bg-white dark:bg-gray-800 rounded-lg shadow', className)}>
          <Skeleton active paragraph={{ rows: 4 }} />
        </div>
      );
    }

    if (sessions.length === 0) {
      return (
        <div
          className={cn('p-4 bg-white dark:bg-gray-800 rounded-lg shadow text-center', className)}
        >
          <Empty
            description={t('pilot.noSessions', { defaultValue: 'No pilot sessions found' })}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      );
    }

    return (
      <div className={cn('bg-white dark:bg-gray-800 rounded-lg shadow', className)}>
        <List
          header={
            <div className="flex justify-between items-center px-4 py-2">
              <h2 className="text-lg font-medium m-0">
                {t('pilot.recentSessions', { defaultValue: 'Recent Sessions' })}
              </h2>
              <Button type="link" onClick={() => refetch()}>
                {t('common.refresh', { defaultValue: 'Refresh' })}
              </Button>
            </div>
          }
          dataSource={sessions}
          renderItem={(session) => (
            <List.Item
              className="!px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              onClick={() => handleSessionClick(session)}
            >
              <List.Item.Meta
                title={
                  <div className="flex items-center">
                    <span className="font-medium">{session.title}</span>
                    <SessionStatusTag status={session.status} className="ml-2" />
                  </div>
                }
                description={
                  <div className="flex flex-col mt-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {t('pilot.created', { defaultValue: 'Created' })}:{' '}
                      {formatDate(session.createdAt)}
                    </span>
                    {session.steps?.length && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('pilot.stepsCount', { defaultValue: 'Steps' })}: {session.steps.length}
                      </span>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </div>
    );
  },
);

PilotList.displayName = 'PilotList';
