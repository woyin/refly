import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { logEvent } from '@refly/telemetry-web';
import { Close } from 'refly-icons';

export type FailureType = 'modelCall' | 'toolCall' | 'multimodal' | 'workflow';

interface ExecutionFailureNoticeProps {
  /** Type of failure to determine the appropriate message */
  failureType: FailureType;
  /** Custom title text, if not provided will use default translation */
  title?: string;
  /** Custom description text, if not provided will use default translation */
  description?: string;
  /** Custom retry button text, if not provided will use default translation */
  retryButtonText?: string;
  /** Custom check button text, only used for workflow failure */
  checkButtonText?: string;
  /** Custom click handler for retry button */
  onRetryClick?: () => void;
  /** Custom click handler for check button (workflow only) */
  onCheckClick?: () => void;
  /** Event tracking context for analytics */
  trackingContext?: string;
  /** Additional CSS classes for customization */
  className?: string;
}

/**
 * Execution Failure Notice Component
 *
 * A reusable component that displays different types of execution failure notices
 * based on the failure type. Follows the Figma design specifications.
 */
export const ExecutionFailureNotice: React.FC<ExecutionFailureNoticeProps> = React.memo(
  ({
    failureType,
    title,
    description,
    retryButtonText,
    checkButtonText,
    onRetryClick,
    onCheckClick,
    trackingContext = 'execution_failure',
    className = '',
  }) => {
    const { t } = useTranslation();

    const handleRetryClick = useCallback(
      (e?: React.MouseEvent) => {
        e?.stopPropagation();

        if (onRetryClick) {
          onRetryClick();
        }

        logEvent('execution::retry_click', `${trackingContext}_${failureType}`);
      },
      [onRetryClick, trackingContext, failureType],
    );

    const handleCheckClick = useCallback(
      (e?: React.MouseEvent) => {
        e?.stopPropagation();

        if (onCheckClick) {
          onCheckClick();
        }

        logEvent('execution::check_click', `${trackingContext}_${failureType}`);
      },
      [onCheckClick, trackingContext, failureType],
    );

    // Get appropriate translations based on failure type
    const getTranslationKey = (key: string) => {
      const typeMap = {
        modelCall: 'modelCallFailure',
        toolCall: 'toolCallFailure',
        multimodal: 'multimodalFailure',
        workflow: 'workflowFailure',
      };
      return `canvas.skillResponse.${typeMap[failureType]}.${key}`;
    };

    const displayTitle = title || t(getTranslationKey('title'));
    const displayDescription = description || t(getTranslationKey('description'));
    const displayRetryText = retryButtonText || t(getTranslationKey('retryButton'));
    const displayCheckText = checkButtonText || t(getTranslationKey('checkButton'));

    return (
      <div
        className={`flex flex-col gap-3 border border-solid border-black/10 dark:border-white/10 bg-[#FFEFED] dark:bg-red-950/20 px-4 py-3 rounded-xl font-['PingFang_SC','-apple-system','BlinkMacSystemFont','sans-serif'] ${className}`}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        {/* Content Section */}
        <div className="flex gap-2">
          {/* Error Icon */}
          <div className="flex items-center justify-center p-0.5 bg-[#F93920] dark:bg-red-500 rounded-full flex-shrink-0 mt-0.5">
            <Close size={12} className="text-white" />
          </div>

          {/* Text Content */}
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            {/* Title */}
            <div className="text-base font-semibold text-[#1C1F23] dark:text-gray-100 leading-[1.625]">
              {displayTitle}
            </div>

            {/* Description */}
            <div className="text-sm font-normal text-[#1C1F23] dark:text-gray-200 leading-[1.429]">
              {displayDescription}
            </div>
          </div>
        </div>

        {/* Action Buttons Section */}
        <div className="flex items-center justify-end gap-2 pl-6">
          {/* Check Button (only for workflow failure) */}
          {failureType === 'workflow' && onCheckClick && (
            <Button
              size="small"
              className="text-sm font-normal h-8 bg-transparent dark:bg-transparent text-[#1C1F23] dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 leading-[1.429]"
              onClick={handleCheckClick}
            >
              {displayCheckText}
            </Button>
          )}

          {/* Retry Button */}
          <Button
            type="primary"
            size="small"
            className="text-sm font-semibold h-8 bg-[#155EEF] dark:bg-blue-600 text-white border-[#155EEF] dark:border-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700 leading-[1.429]"
            onClick={handleRetryClick}
          >
            {displayRetryText}
          </Button>
        </div>
      </div>
    );
  },
);

ExecutionFailureNotice.displayName = 'ExecutionFailureNotice';
