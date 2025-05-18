import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PilotStep, PilotStepStatus } from '@refly/openapi-schema';
import {
  ClockCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { FaCheck } from 'react-icons/fa6';

// Status icon mapping for pilot steps
export const StepStatusIcon = memo(({ status }: { status?: PilotStepStatus }) => {
  if (!status) return <QuestionCircleOutlined className="text-gray-400" />;

  switch (status) {
    case 'init':
      return (
        <div className="w-5 h-5 flex items-center justify-center">
          <ClockCircleOutlined className="text-gray-400 dark:text-gray-500" />
        </div>
      );
    case 'executing':
      return (
        <div className="w-6 h-6 flex items-center justify-center">
          <SyncOutlined spin className="text-yellow-500" />
        </div>
      );
    case 'finish':
      return (
        <div className="w-5 h-5 flex items-center justify-center">
          <FaCheck className="w-4 h-4 text-green-500" />
        </div>
      );
    case 'failed':
      return (
        <div className="w-5 h-5 flex items-center justify-center">
          <CloseCircleOutlined className="text-red-500" />
        </div>
      );
    default:
      return (
        <div className="w-5 h-5 flex items-center justify-center">
          <QuestionCircleOutlined className="text-gray-400" />
        </div>
      );
  }
});

StepStatusIcon.displayName = 'StepStatusIcon';

export interface PilotStepItemProps {
  step: PilotStep;
  onClick?: (step: PilotStep) => void;
  isDetailed?: boolean;
  isActive?: boolean;
}

export const PilotStepItem = memo(({ step, onClick, isActive = false }: PilotStepItemProps) => {
  const { i18n } = useTranslation();
  const language = i18n.languages?.[0];

  const handleClick = useMemo(() => {
    if (!onClick) return undefined;
    return () => onClick(step);
  }, [onClick, step]);

  // Set appropriate status-based styles
  const getStatusStyles = () => {
    const baseClasses = 'flex items-center px-2 py-1 flex-grow min-w-0';

    if (step.status === 'finish') {
      return `${baseClasses} text-gray-600 dark:text-gray-300`;
    }

    if (step.status === 'executing') {
      return `${baseClasses} text-blue-600 dark:text-blue-400 font-medium`;
    }

    return `${baseClasses} text-gray-500 dark:text-gray-400`;
  };

  return (
    <div
      className={`flex items-center py-1 cursor-pointer transition-colors w-full max-w-full ${isActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
      onClick={handleClick}
    >
      <div className="mr-2 flex-shrink-0">
        <StepStatusIcon status={step.status} />
      </div>

      <div className={getStatusStyles()}>
        <span className="truncate text-sm max-w-full block">{step?.name ?? ''}</span>
      </div>

      {step.status === 'executing' && (
        <div className="text-xs mr-2 flex-shrink-0 text-gray-500 dark:text-gray-400">
          {time(step?.createdAt, language as LOCALE)
            ?.utc()
            ?.fromNow()}
        </div>
      )}
    </div>
  );
});

PilotStepItem.displayName = 'PilotStepItem';
