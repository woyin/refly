import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { useTranslation } from 'react-i18next';
import { EndMessage } from '@refly-packages/ai-workspace-common/components/workspace/scroll-loading';

import { WorkflowNodeExecution } from '@refly/openapi-schema';
import { cn } from '@refly/utils/cn';
import { Empty } from 'antd';

export const WorkflowAppRunLogs = ({
  nodeExecutions,
}: { nodeExecutions: WorkflowNodeExecution[] }) => {
  const { t, i18n } = useTranslation();
  const language = i18n.languages?.[0];

  const getStatusConfig = (nodeExecution: WorkflowNodeExecution) => {
    switch (nodeExecution.status) {
      case 'finish':
        return 'bg-refly-primary-light text-refly-primary-default';
      case 'failed':
        return 'bg-refly-Colorful-red-light text-refly-func-danger-default';
      case 'executing':
        return 'bg-refly-primary-light text-refly-primary-default';
      case 'waiting':
        return 'bg-refly-bg-control-z0 text-refly-text-2';
      default:
        return 'bg-refly-bg-control-z0 text-refly-text-2';
    }
  };

  return (
    <div className="w-full h-full flex flex-col gap-2">
      {nodeExecutions.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center">
          <Empty description={t('workflowApp.emptyLogs')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      ) : (
        <>
          {nodeExecutions.map((nodeExecution) => (
            <div
              key={nodeExecution.nodeExecutionId}
              className="px-3 py-2 border-solid border-refly-Card-Border border-[1px] rounded-lg flex items-center justify-between bg-refly-bg-content-z2 hover:bg-refly-tertiary-hover"
            >
              <div>{nodeExecution.title}</div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <div
                  className={cn(
                    'px-1 text-[10px] leading-[16px] font-semibold rounded-[4px]',
                    getStatusConfig(nodeExecution),
                  )}
                >
                  {t(`canvas.workflow.run.nodeStatus.${nodeExecution.status}`, {
                    defaultValue: nodeExecution.status,
                  })}
                </div>

                <div className="text-[10px] leading-[16px] text-refly-text-2">
                  {time(nodeExecution.updatedAt, language as LOCALE)
                    ?.utc()
                    ?.fromNow()}
                </div>
              </div>
            </div>
          ))}

          <EndMessage />
        </>
      )}
    </div>
  );
};
