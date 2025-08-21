import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

export const StartNodePreview = () => {
  const { workflow } = useCanvasContext();
  const { workflowVariables, refetchWorkflowVariables, workflowVariablesLoading } = workflow;

  console.log(
    'workflowVariables',
    workflowVariables,
    workflowVariablesLoading,
    refetchWorkflowVariables,
  );

  return <div>StartNodePreview</div>;
};
