import { memo, useMemo } from 'react';
import { PilotSessionStatus, PilotStep } from '@refly/openapi-schema';
import { ClockCircleOutlined, CloseCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { Finished } from 'refly-icons';

export interface SessionStatusTagProps {
  status: PilotSessionStatus;
  steps: PilotStep[];
  className?: string;
}

export const SessionStatusTag = memo(({ status, steps, className }: SessionStatusTagProps) => {
  // const { t } = useTranslation();
  console.log(steps);

  // const color = useMemo(() => {
  //   switch (status) {
  //     case 'init':
  //       return 'blue';
  //     case 'executing':
  //     case 'waiting':
  //       return 'processing';
  //     case 'finish':
  //       return 'success';
  //     case 'failed':
  //       return 'error';
  //     default:
  //       return 'default';
  //   }
  // }, [status]);

  const icon = useMemo(() => {
    switch (status) {
      case 'executing':
        return <SyncOutlined spin className="w-4 h-4" />;
      case 'waiting':
        return <ClockCircleOutlined className="w-4 h-4" />;
      case 'finish':
        return <Finished className="w-4 h-4" color="var(--refly-primary-default)" />;
      case 'failed':
        return <CloseCircleOutlined className="w-4 h-4" />;
      default:
        return null;
    }
  }, [status]);
  const executingStepsLength = useMemo(() => {
    return steps.filter((step) => step.status === 'executing').length;
  }, [steps]);
  const text = useMemo(() => {
    switch (status) {
      case 'executing':
        return (
          <div className="flex items-center gap-1">
            <span className="text-xs p-1">正在规划任务...</span>
          </div>
        );
      case 'waiting':
        return (
          <div className="flex items-center gap-1">
            <span className="text-xs p-1">
              任务执行 {executingStepsLength} / {steps.length} ...
            </span>
          </div>
        );
      case 'finish':
        return (
          <div className="flex items-center gap-1">
            <span className="text-xs p-1">已完成{steps.length}个任务 ...</span>
          </div>
        );
      case 'failed':
        return '任务失败';
    }
  }, [status]);
  return (
    <div className={cn(className, 'flex items-center gap-0 px-3')}>
      {icon}
      {text}
      {/* <span className="text-[10px] m-0 p-0">
        {t(`pilot.status.${status}`, { defaultValue: status })}
      </span> */}
    </div>
  );
});

SessionStatusTag.displayName = 'SessionStatusTag';
