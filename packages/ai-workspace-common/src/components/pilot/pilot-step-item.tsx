import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PilotStep, PilotStepStatus } from '@refly/openapi-schema';
import { Tag, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';

// Status icon mapping for pilot steps
export const StepStatusIcon = memo(({ status }: { status?: PilotStepStatus }) => {
  if (!status) return <QuestionCircleOutlined className="text-gray-400" />;

  switch (status) {
    case 'init':
      return <ClockCircleOutlined className="text-blue-500" />;
    case 'executing':
      return <LoadingOutlined className="text-blue-500" spin />;
    case 'finish':
      return <CheckCircleOutlined className="text-green-500" />;
    case 'failed':
      return <CloseCircleOutlined className="text-red-500" />;
    default:
      return <QuestionCircleOutlined className="text-gray-400" />;
  }
});

StepStatusIcon.displayName = 'StepStatusIcon';

export interface PilotStepItemProps {
  step: PilotStep;
  onClick?: (step: PilotStep) => void;
  isDetailed?: boolean;
}

export const PilotStepItem = memo(({ step, onClick, isDetailed = false }: PilotStepItemProps) => {
  const { t } = useTranslation();

  const handleClick = useMemo(() => {
    if (!onClick) return undefined;
    return () => onClick(step);
  }, [onClick, step]);

  const createdAt = useMemo(() => {
    if (!step.createdAt) return null;
    try {
      return new Date(step.createdAt).toLocaleTimeString();
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [step.createdAt]);

  return (
    <div
      className={`border border-gray-200 dark:border-gray-700 rounded-md p-3 mb-3 bg-white dark:bg-gray-800 ${
        onClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors' : ''
      }`}
      onClick={handleClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <StepStatusIcon status={step.status} />
          <span className="ml-2 font-medium text-sm">{step.name}</span>
        </div>
        <div className="flex items-center space-x-2">
          {step.epoch !== undefined && (
            <Tag color="blue">{t('pilot.epoch', { count: step.epoch + 1 })}</Tag>
          )}
          {createdAt && (
            <Tooltip title={step.createdAt}>
              <span className="text-xs text-gray-500 dark:text-gray-400">{createdAt}</span>
            </Tooltip>
          )}
        </div>
      </div>

      {step.actionResult && (
        <div className="mt-2 pl-6 text-sm text-gray-600 dark:text-gray-300 border-l-2 border-gray-200 dark:border-gray-600">
          <div className={isDetailed ? '' : 'line-clamp-3'}>{step.actionResult.resultId}</div>
        </div>
      )}
    </div>
  );
});

PilotStepItem.displayName = 'PilotStepItem';
