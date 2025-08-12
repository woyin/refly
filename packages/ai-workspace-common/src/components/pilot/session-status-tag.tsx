import { memo, useMemo } from 'react';
import { PilotSessionStatus, PilotStep } from '@refly/openapi-schema';
import { Tag } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';

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
        return <SyncOutlined spin className="w-3 h-3" />;
      case 'waiting':
        return <ClockCircleOutlined className="w-3 h-3" />;
      case 'finish':
        return <CheckCircleOutlined className="w-3 h-3" />;
      case 'failed':
        return <CloseCircleOutlined className="w-3 h-3" />;
      default:
        return null;
    }
  }, [status]);

  return (
    <Tag className={cn(className, 'flex items-center gap-0')}>
      {icon}
      {/* <span className="text-[10px] m-0 p-0">
        {t(`pilot.status.${status}`, { defaultValue: status })}
      </span> */}
    </Tag>
  );
});

SessionStatusTag.displayName = 'SessionStatusTag';
