import { Tooltip, Button, Skeleton } from 'antd';
import { SideRight } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
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

  const { workflow } = useCanvasContext();
  const { workflowVariables, workflowVariablesLoading, refetchWorkflowVariables } = workflow;

  const handleClose = () => {
    setShowWorkflowRun(false);
    setSidePanelVisible(false);
    // if (activeNode) {
    //   setActiveNode(null);
    // }
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
