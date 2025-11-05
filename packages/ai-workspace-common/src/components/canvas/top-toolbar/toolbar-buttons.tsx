import { memo } from 'react';
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

  const { sidePanelVisible, setSidePanelVisible } = useCanvasResourcesPanelStoreShallow(
    (state) => ({
      sidePanelVisible: state.sidePanelVisible,
      setSidePanelVisible: state.setSidePanelVisible,
    }),
  );

  const handleResourcesPanelOpen = useCallback(() => {
    setSidePanelVisible(!sidePanelVisible);
  }, [sidePanelVisible, setSidePanelVisible]);

  return (
    <div className="absolute bottom-6 left-0 right-0 z-20 p-2 flex items-center justify-center">
      <div className="flex items-center gap-1 p-2 bg-refly-bg-content-z2 rounded-xl border-solid border-[1px] border-refly-Card-Border shadow-refly-m">
        <Divider type="vertical" className="m-0 h-5 bg-refly-Card-Border" />

        <ToolsDependency canvasId={canvasId} />

        <Button
          type="text"
          icon={<Resource size={18} />}
          onClick={handleResourcesPanelOpen}
          className={`p-2 font-semibold ${sidePanelVisible ? 'bg-refly-fill-hover' : ''}`}
        >
          {t('canvas.toolbar.tooltip.resourceLibrary')}
        </Button>
      </div>
    </div>
  );
});

ToolbarButtons.displayName = 'ToolbarButtons';
