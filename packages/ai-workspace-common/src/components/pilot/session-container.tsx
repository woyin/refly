import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PilotStep } from '@refly/openapi-schema';
import { useGetPilotSessionDetail } from '@refly-packages/ai-workspace-common/queries/queries';
import { Button, Skeleton, Tooltip } from 'antd';
import { cn } from '@refly/utils/cn';
import { ClockCircleOutlined, CloseCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { PilotStepItem } from './pilot-step-item';
import { SessionStatusTag } from './session-status-tag';

const POLLING_INTERVAL = 3000; // 3 seconds

export interface SessionContainerProps {
  sessionId: string;
  className?: string;
  onClose?: () => void;
  onStepClick?: (step: PilotStep) => void;
}

export const SessionContainer = memo(
  ({ sessionId, className, onClose, onStepClick }: SessionContainerProps) => {
    const { t } = useTranslation();
    const [isPolling, setIsPolling] = useState(false);
    const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

    // Fetch the pilot session details
    const {
      data: sessionData,
      refetch,
      isLoading,
      error,
    } = useGetPilotSessionDetail(
      {
        query: { sessionId },
      },
      null,
      { enabled: !!sessionId },
    );

    const session = useMemo(() => sessionData?.data, [sessionData]);

    // Check if the session is in an active state that requires polling
    const shouldPoll = useMemo(() => {
      if (!session) return false;
      return session.status === 'executing' || session.status === 'waiting';
    }, [session]);

    // Set up polling based on session status
    useEffect(() => {
      let intervalId: NodeJS.Timeout;

      if (shouldPoll && !isPolling) {
        setIsPolling(true);
        intervalId = setInterval(() => {
          refetch();
        }, POLLING_INTERVAL);
      }

      // Clean up interval on component unmount or when polling should stop
      return () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
        if (!shouldPoll && isPolling) {
          setIsPolling(false);
        }
      };
    }, [shouldPoll, isPolling, refetch]);

    const handleClose = useCallback(() => {
      if (onClose) {
        onClose();
      }
    }, [onClose]);

    const handleRefresh = useCallback(() => {
      refetch();
    }, [refetch]);

    const handleStepClick = useCallback(
      (step: PilotStep) => {
        setSelectedStepId(step.stepId);
        if (onStepClick) {
          onStepClick(step);
        }
      },
      [onStepClick],
    );

    // Sort steps by epoch and creation time
    const sortedSteps = useMemo(() => {
      if (!session?.steps?.length) return [];

      return [...session.steps].sort((a, b) => {
        // First sort by epoch
        if ((a.epoch ?? 0) !== (b.epoch ?? 0)) {
          return (a.epoch ?? 0) - (b.epoch ?? 0);
        }

        // Then by creation time for steps within the same epoch
        if (a.createdAt && b.createdAt) {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }

        return 0;
      });
    }, [session?.steps]);

    // Handle loading state
    if (isLoading && !session) {
      return (
        <div className={cn('p-4 bg-white dark:bg-gray-800 rounded-lg shadow', className)}>
          <Skeleton active paragraph={{ rows: 4 }} />
        </div>
      );
    }

    // Handle error state
    if (error || !session) {
      return (
        <div
          className={cn('p-4 bg-white dark:bg-gray-800 rounded-lg shadow text-center', className)}
        >
          <CloseCircleOutlined className="text-red-500 text-2xl mb-2" />
          <p className="text-gray-600 dark:text-gray-300">
            {t('pilot.error.loadFailed', { defaultValue: 'Failed to load session details' })}
          </p>
          <Button type="primary" onClick={handleRefresh} className="mt-2">
            {t('common.retry', { defaultValue: 'Retry' })}
          </Button>
        </div>
      );
    }

    return (
      <div className={cn('p-4 bg-white dark:bg-gray-800 rounded-lg shadow', className)}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <h2 className="text-lg font-medium">{session.title}</h2>
            <SessionStatusTag status={session.status} className="ml-2" />
          </div>
          <div className="flex items-center space-x-2">
            <Tooltip title={t('common.refresh', { defaultValue: 'Refresh' })}>
              <Button
                icon={<SyncOutlined spin={isPolling} />}
                type="text"
                onClick={handleRefresh}
                aria-label={t('common.refresh', { defaultValue: 'Refresh' })}
              />
            </Tooltip>
            {onClose && (
              <Tooltip title={t('common.close', { defaultValue: 'Close' })}>
                <Button
                  icon={<CloseCircleOutlined />}
                  type="text"
                  onClick={handleClose}
                  aria-label={t('common.close', { defaultValue: 'Close' })}
                />
              </Tooltip>
            )}
          </div>
        </div>

        {/* Steps Timeline */}
        <div className="mt-4">
          <h3 className="text-md font-medium mb-2">
            {t('pilot.steps', { defaultValue: 'Steps' })}
          </h3>

          {sortedSteps.length > 0 ? (
            <div className="space-y-2">
              {sortedSteps.map((step) => (
                <PilotStepItem
                  key={step.stepId}
                  step={step}
                  onClick={onStepClick ? handleStepClick : undefined}
                  isDetailed={step.stepId === selectedStepId}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              <ClockCircleOutlined className="text-xl mb-2" />
              <p>{t('pilot.noSteps', { defaultValue: 'No steps available yet' })}</p>
            </div>
          )}
        </div>
      </div>
    );
  },
);

SessionContainer.displayName = 'SessionContainer';
