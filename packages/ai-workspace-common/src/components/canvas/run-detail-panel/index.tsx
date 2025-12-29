import { memo, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { ArrowLeft, Copy, CheckCircle, ChevronRight } from 'lucide-react';
import { IoCloseCircle } from 'react-icons/io5';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';
import {
  useScheduleFailureAction,
  ScheduleFailureReason,
} from '@refly-packages/ai-workspace-common/hooks/use-schedule-failure-action';
import './index.scss';

// Re-export for backward compatibility
export { ScheduleFailureReason };

export interface RunDetailInfo {
  status: string;
  triggeredAt: string;
  completedAt?: string;
  creditUsed: number;
  failureReason?: string;
  canvasId: string;
  workflowTitle?: string;
}

interface RunDetailPanelProps {
  info: RunDetailInfo;
  onDuplicate?: () => void;
  duplicateLoading?: boolean;
}

// Status display component
const StatusDisplay = memo(
  ({
    status,
    failureReason,
    canvasId,
  }: { status: string; failureReason?: string; canvasId: string }) => {
    const { t } = useTranslation();
    const { getActionConfig, getReasonText, handleAction } = useScheduleFailureAction(canvasId);

    const isSuccess = status === 'success';
    const isFailed = status === 'failed';

    const actionConfig = useMemo(
      () => getActionConfig(failureReason),
      [failureReason, getActionConfig],
    );

    const failureReasonText = useMemo(
      () => getReasonText(failureReason),
      [failureReason, getReasonText],
    );

    const handleActionClick = useCallback(() => {
      if (actionConfig) {
        handleAction(actionConfig.actionType);
      }
    }, [actionConfig, handleAction]);

    return (
      <div className="bg-[#FBFBFB] rounded-lg px-3 py-2 flex flex-col justify-center">
        {isSuccess ? (
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-refly-primary-default" />
            <span className="text-sm font-medium text-refly-primary-default">
              {t('runDetail.statusDisplay.succeeded')}
            </span>
          </div>
        ) : isFailed ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IoCloseCircle size={18} className="text-[#F93920]" />
                <span className="text-sm font-medium text-[#F93920]">
                  {t('runDetail.statusDisplay.failed')}
                </span>
              </div>
              {failureReasonText && (
                <span className="text-xs text-refly-text-3 truncate max-w-[120px]">
                  {failureReasonText}
                </span>
              )}
            </div>
            {actionConfig && (
              <Button
                size="small"
                onClick={handleActionClick}
                className={`w-fit flex items-center gap-1 ${
                  actionConfig.isDark
                    ? '!bg-black !text-white !border-black hover:!bg-gray-800'
                    : ''
                }`}
              >
                {actionConfig.label}
                <ChevronRight size={14} />
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-[18px] h-[18px] rounded-full border-2 border-refly-text-3 border-t-transparent animate-spin" />
            <span className="text-sm font-medium text-refly-text-2">
              {t('runDetail.statusDisplay.running')}
            </span>
          </div>
        )}
      </div>
    );
  },
);

StatusDisplay.displayName = 'StatusDisplay';

export const RunDetailPanel = memo(
  ({ info, onDuplicate, duplicateLoading }: RunDetailPanelProps) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const language = i18n.languages?.[0];

    const handleBack = () => {
      // Check if there's history to go back to, otherwise navigate to run-history
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/run-history');
      }
    };

    return (
      <div className="run-detail-panel absolute -top-[1px] left-[-1px] bottom-[-1px] w-72 bg-refly-bg-content-z2 border-solid border-[1px] border-refly-Card-Border shadow-refly-m z-[30] rounded-xl overflow-hidden pointer-events-auto">
        <div className="h-full flex flex-col">
          {/* Back Button */}
          <div className="p-3 border-b border-solid border-refly-Card-Border">
            <Button
              type="text"
              size="small"
              icon={<ArrowLeft size={14} />}
              onClick={handleBack}
              className="flex items-center gap-1 text-refly-text-2 hover:text-refly-text-1 !px-2"
            >
              {t('runDetail.backToHistory')}
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {/* Status Display */}
              <StatusDisplay
                status={info.status}
                failureReason={info.failureReason}
                canvasId={info.canvasId}
              />

              {/* Triggered Time */}
              <div>
                <div className="text-xs text-refly-text-3 mb-1">{t('runDetail.triggeredAt')}</div>
                <div className="text-sm text-refly-text-1">
                  {time(info.triggeredAt, language as LOCALE).format('YYYY-MM-DD HH:mm:ss')}
                </div>
              </div>

              {/* Completed Time */}
              {info.completedAt && (
                <div>
                  <div className="text-xs text-refly-text-3 mb-1">{t('runDetail.completedAt')}</div>
                  <div className="text-sm text-refly-text-1">
                    {time(info.completedAt, language as LOCALE).format('YYYY-MM-DD HH:mm:ss')}
                  </div>
                </div>
              )}

              {/* Credit Used */}
              <div>
                <div className="text-xs text-refly-text-3 mb-1">{t('runDetail.creditUsed')}</div>
                <div className="text-sm text-refly-text-1">{info.creditUsed ?? 0} Credit</div>
              </div>

              {/* Action Button */}
              <Button
                block
                type="primary"
                icon={<Copy size={14} />}
                onClick={onDuplicate}
                loading={duplicateLoading}
                disabled={duplicateLoading}
              >
                {t('runDetail.actions.duplicate')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

RunDetailPanel.displayName = 'RunDetailPanel';
