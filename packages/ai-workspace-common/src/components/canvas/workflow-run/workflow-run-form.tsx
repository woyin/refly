import type { WorkflowVariable } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { Play } from 'refly-icons';
import { useInitializeWorkflow } from '@refly-packages/ai-workspace-common/hooks/use-initialize-workflow';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

interface WorkflowRunFormProps {
  workflowVariables: WorkflowVariable[];
}
export const WorkflowRunForm = ({ workflowVariables }: WorkflowRunFormProps) => {
  const { t } = useTranslation();
  const { canvasId } = useCanvasContext();
  const { initializeWorkflow, loading } = useInitializeWorkflow();
  const handleRun = () => {
    if (!canvasId || loading) {
      return;
    }
    initializeWorkflow(canvasId);
  };
  return (
    <div className="w-full h-full flex flex-col gap-2">
      <div className="p-4 flex-1 overflow-y-auto">
        {workflowVariables.map((variable) => (
          <div key={variable.name}>{variable.name}</div>
        ))}
      </div>

      <div className="p-3 border-solid border-[1px] border-x-0 border-b-0 border-refly-Card-Border rounded-b-lg">
        <Button
          className="w-full"
          type="primary"
          icon={<Play size={16} />}
          onClick={handleRun}
          loading={loading}
        >
          {t('canvas.workflow.run.run') || 'Run'}
        </Button>
      </div>
    </div>
  );
};
