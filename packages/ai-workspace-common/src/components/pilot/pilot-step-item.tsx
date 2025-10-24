import { memo, useMemo, useState } from 'react';
import { PilotStep, PilotStepStatus } from '@refly/openapi-schema';
import { QuestionCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { motion } from 'motion/react';
import { Cancelled, Finished, Pending, Running1 } from 'refly-icons';
import { Button, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { usePilotRecovery } from '@refly-packages/ai-workspace-common/hooks/pilot/use-pilot-recovery';
import { useGetPilotSessionDetail } from '@refly-packages/ai-workspace-common/queries/queries';

// Status icon mapping for pilot steps
export const StepStatusIcon = memo(({ status }: { status?: PilotStepStatus }) => {
  if (!status) return <QuestionCircleOutlined className="text-gray-400" />;

  switch (status) {
    case 'init':
      return (
        <div className="w-5 h-5 flex items-center justify-center">
          <Pending className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        </div>
      );
    case 'executing':
      return (
        <div className="w-6 h-6 flex items-center justify-center">
          <Running1 className="w-4 h-4 animate-spin" />
        </div>
      );
    case 'finish':
      return (
        <div className="w-5 h-5 flex items-center justify-center">
          <Finished className="w-4 h-4" color="var(--refly-primary-default)" />
        </div>
      );
    case 'failed':
      return (
        <div className="w-5 h-5 flex items-center justify-center">
          <Cancelled className="w-4 h-4" color="var(--refly-func-danger-default)" />
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
  sessionId: string;
  canvasId: string;
  onClick?: (step: PilotStep) => void;
}

export const PilotStepItem = memo(({ step, sessionId, canvasId, onClick }: PilotStepItemProps) => {
  const { t } = useTranslation();
  const [isRecovering, setIsRecovering] = useState(false);

  // Get the latest session data to ensure we have the most up-to-date step information
  const { data: sessionData } = useGetPilotSessionDetail(
    {
      query: { sessionId },
    },
    undefined,
    {
      enabled: !!sessionId,
      refetchInterval: 2000, // Poll every 2 seconds to get latest step status
    },
  );

  // Get the current step from the latest session data
  const currentStep = useMemo(() => {
    if (!sessionData?.data?.steps) return step;

    // Find the step with matching stepId in the latest session data
    const latestStep = sessionData.data.steps.find((s) => s.stepId === step.stepId);
    return latestStep || step;
  }, [sessionData, step]);

  // Use the new recovery hook
  const { recoverSteps } = usePilotRecovery({
    canvasId,
    sessionId,
  });

  const handleClick = useMemo(() => {
    if (!onClick) return undefined;
    return () => onClick(currentStep);
  }, [onClick, currentStep]);

  const handleRecoverStep = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering onClick

    if (!currentStep.stepId) {
      message.error(t('pilot.stepRecovery.error.noStepId'));
      return;
    }

    setIsRecovering(true);
    try {
      await recoverSteps([currentStep]);
    } catch {
      // Error handling is done in the hook
    } finally {
      setIsRecovering(false);
    }
  };

  const isFailed = currentStep.status === 'failed';
  const showRecoverButton = isFailed && currentStep.stepId;

  return (
    <motion.div
      className="flex items-center gap-2 h-10 w-full px-3 py-2 mt-2 cursor-pointer rounded-xl transition-colors text-refly-text-2 hover:text-refly-text-1 hover:bg-refly-tertiary-hover bg-refly-tertiary-default"
      onClick={handleClick}
      whileHover={{
        scale: 1.02,
      }}
      whileTap={{
        scale: 0.98,
        transition: { duration: 0.1 },
      }}
      layout
    >
      <div className="flex-shrink-0">
        <StepStatusIcon status={currentStep.status} />
      </div>

      <div className="flex-grow min-w-0 truncate text-sm">{currentStep?.name ?? ''}</div>

      {showRecoverButton && (
        <div className="flex-shrink-0">
          <Button
            size="small"
            type="text"
            loading={isRecovering}
            onClick={handleRecoverStep}
            className="h-6 px-2 text-xs"
          >
            <ReloadOutlined className="w-3 h-3" />
            {t('pilot.stepRecovery.button')}
          </Button>
        </div>
      )}
    </motion.div>
  );
});

PilotStepItem.displayName = 'PilotStepItem';
