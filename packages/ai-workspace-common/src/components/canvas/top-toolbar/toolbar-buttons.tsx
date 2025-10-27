import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useCallback } from 'react';
import { Divider, Button } from 'antd';
import { Resource } from 'refly-icons';
import { ToolsDependency } from '../tools-dependency';

interface ToolbarButtonsProps {
  canvasId: string;
}

export const ToolbarButtons = memo(({ canvasId }: ToolbarButtonsProps) => {
  const { t } = useTranslation();

  const { sidePanelVisible, setSidePanelVisible, showWorkflowRun, setShowWorkflowRun } =
    useCanvasResourcesPanelStoreShallow((state) => ({
      sidePanelVisible: state.sidePanelVisible,
      setSidePanelVisible: state.setSidePanelVisible,
      showWorkflowRun: state.showWorkflowRun,
      setShowWorkflowRun: state.setShowWorkflowRun,
    }));

  const isResourceLibraryVisible = useMemo(() => {
    return sidePanelVisible && !showWorkflowRun;
  }, [sidePanelVisible, showWorkflowRun]);

  const handleResourcesPanelOpen = useCallback(() => {
    if (isResourceLibraryVisible) {
      setSidePanelVisible(false);
      setShowWorkflowRun(false);
    } else {
      setSidePanelVisible(true);
      setShowWorkflowRun(false);
    }
  }, [isResourceLibraryVisible, setSidePanelVisible, setShowWorkflowRun]);

  return (
    <div className="absolute top-0 left-0 right-0 z-20 p-2 flex items-center justify-center">
      <div className="flex items-center gap-2 p-2 bg-refly-bg-content-z2 rounded-2xl border-solid border-[1px] border-refly-Card-Border">
        <ToolsDependency canvasId={canvasId} />

        <Divider type="vertical" className="m-0 h-5 bg-refly-Card-Border" />

        <Button
          type="text"
          icon={<Resource size={18} />}
          onClick={handleResourcesPanelOpen}
          className={`p-2 font-semibold ${isResourceLibraryVisible ? 'bg-refly-fill-hover' : ''}`}
        >
          {t('canvas.toolbar.tooltip.resourceLibrary')}
          {isResourceLibraryVisible}
        </Button>
      </div>
    </div>
  );
});

ToolbarButtons.displayName = 'ToolbarButtons';
