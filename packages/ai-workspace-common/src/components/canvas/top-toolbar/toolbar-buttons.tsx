import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useCallback } from 'react';
import { Divider, Tooltip, Button } from 'antd';
import { Resource } from 'refly-icons';

export const ToolbarButtons = memo(() => {
  const { t } = useTranslation();

  const { sidePanelVisible, setSidePanelVisible, showWorkflowRun, setShowWorkflowRun } =
    useCanvasResourcesPanelStoreShallow((state) => ({
      sidePanelVisible: state.sidePanelVisible,
      setSidePanelVisible: state.setSidePanelVisible,
      showWorkflowRun: state.showWorkflowRun,
      setShowWorkflowRun: state.setShowWorkflowRun,
    }));

  const handleResourcesPanelOpen = useCallback(() => {
    setSidePanelVisible(true);
    setShowWorkflowRun(false);
  }, [setSidePanelVisible, setShowWorkflowRun]);

  return (
    <div className="absolute top-0 left-0 right-0 z-20 px-2 py-4 flex items-center justify-center">
      {(!sidePanelVisible || showWorkflowRun) && (
        <>
          <Divider type="vertical" className="h-5 bg-refly-Card-Border" />

          <Tooltip title={t('canvas.toolbar.openResourcesPanel')} arrow={false}>
            <Button type="text" icon={<Resource size={18} />} onClick={handleResourcesPanelOpen} />
          </Tooltip>
        </>
      )}
    </div>
  );
});

ToolbarButtons.displayName = 'ToolbarButtons';
