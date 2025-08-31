import { Tooltip, Button, Skeleton, Empty } from 'antd';
import { SideRight } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import { useActiveNode, useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import { useReactFlow } from '@xyflow/react';
import { CanvasNode } from '@refly/canvas-common';
import { WorkflowRunForm } from './workflow-run-form';
import './index.scss';

export const WorkflowRun = () => {
  const { t } = useTranslation();
  const { setShowWorkflowRun, setSidePanelVisible } = useCanvasResourcesPanelStoreShallow(
    (state) => ({
      setShowWorkflowRun: state.setShowWorkflowRun,
      setSidePanelVisible: state.setSidePanelVisible,
    }),
  );

  const { canvasId, workflow, readonly } = useCanvasContext();
  const { workflowVariables, workflowVariablesLoading, refetchWorkflowVariables } = workflow;
  const { getNodes } = useReactFlow();
  const startNode = getNodes().filter((node) => node.type === 'start')[0] as CanvasNode;

  const { activeNode, setActiveNode } = useActiveNode(canvasId);
  const handleClose = () => {
    setShowWorkflowRun(false);
    setSidePanelVisible(false);
    if (activeNode) {
      setActiveNode(null);
    }
  };

  const handleAddVariable = () => {
    setShowWorkflowRun(false);
    setActiveNode(startNode);
  };

  const renderEmpty = () => {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full">
        <Empty
          description={null}
          image={EmptyImage}
          imageStyle={{
            width: 150,
            height: 150,
            marginBottom: -20,
          }}
        >
          <div className="flex items-center justify-center">
            <div className="text-[13px] text-refly-text-1 leading-5">
              {t('canvas.workflow.variables.empty') || 'No variables defined'}
            </div>
            {!readonly && (
              <Button
                type="text"
                size="small"
                className="text-[13px] leading-5 font-semibold !text-refly-primary-default p-0.5 !h-5 box-border hover:bg-refly-tertiary-hover"
                onClick={handleAddVariable}
              >
                {t('canvas.workflow.variables.addVariable') || 'Add'}
              </Button>
            )}
          </div>
        </Empty>
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full h-[calc(100vh-16px)] bg-refly-bg-content-z2 rounded-xl border-solid border border-refly-Card-Border shadow-refly-m">
      <div className="w-full h-[65px] flex gap-2 items-center justify-between p-3 border-solid border-refly-Card-Border border-[1px] border-x-0 border-t-0">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <Tooltip title={t('canvas.toolbar.closeResourcesPanel')} arrow={false}>
            <Button type="text" icon={<SideRight size={18} />} onClick={handleClose} />
          </Tooltip>
          <div className="text-refly-text-0 text-base font-semibold leading-[26px] min-w-0 flex-1">
            {t('canvas.workflow.run.title')}
          </div>
        </div>
      </div>

      <div className="flex-1 w-full overflow-y-auto">
        {workflowVariablesLoading ? (
          <div className="p-4">
            <Skeleton paragraph={{ rows: 10 }} active title={false} />
          </div>
        ) : workflowVariables.length === 0 ? (
          renderEmpty()
        ) : (
          <WorkflowRunForm
            workflowVariables={workflowVariables}
            refetchWorkflowVariables={refetchWorkflowVariables}
          />
        )}
      </div>
    </div>
  );
};
