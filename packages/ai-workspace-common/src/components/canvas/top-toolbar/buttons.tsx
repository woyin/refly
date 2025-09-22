import { useCallback, memo, useMemo } from 'react';
import { Button, Tooltip, Dropdown, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { IconSlideshow } from '@refly-packages/ai-workspace-common/components/common/icon';
import { Download, Touchpad, Mouse, ArrowDown, Resource, More } from 'refly-icons';
import { useExportCanvasAsImage } from '@refly-packages/ai-workspace-common/hooks/use-export-canvas-as-image';
import { useCanvasStoreShallow, useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { Help } from '@refly-packages/ai-workspace-common/components/canvas/layout-control/help';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { logEvent } from '@refly/telemetry-web';

export type Mode = 'mouse' | 'touchpad';

// Add interface for TooltipButton props
interface TooltipButtonProps {
  tooltip: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

// Add interfaces for component props
interface ModeSelectorProps {
  mode: 'mouse' | 'touchpad';
  open: boolean;
  setOpen: (open: boolean) => void;
  items: any[]; // Type this according to your items structure
  onModeChange: (mode: 'mouse' | 'touchpad') => void;
  t: TFunction;
}

interface MoreMenuProps {
  readonly: boolean;
  mode: 'mouse' | 'touchpad';
  modeItems: any[];
  onModeChange: (mode: 'mouse' | 'touchpad') => void;
  onSlideshowClick: () => void;
  onExportImageClick: () => void;
  onExportCanvasClick: () => void;
  t: TFunction;
}

// Update component definition
export const TooltipButton = memo(
  ({ tooltip, children, onClick, ...buttonProps }: TooltipButtonProps) => (
    <Tooltip title={tooltip} arrow={false}>
      <Button type="text" {...buttonProps} onClick={onClick}>
        {children}
      </Button>
    </Tooltip>
  ),
);

const ModeSelector = memo(({ mode, open, setOpen, items, onModeChange, t }: ModeSelectorProps) => (
  <Dropdown
    menu={{
      items,
      onClick: ({ key }) => onModeChange(key as 'mouse' | 'touchpad'),
      selectedKeys: [mode],
      className: 'dark:bg-gray-800 dark:[&_.ant-dropdown-menu-item-selected]:bg-gray-700',
    }}
    trigger={['click']}
    open={open}
    onOpenChange={setOpen}
  >
    <Tooltip title={t('canvas.toolbar.tooltip.mode')} arrow={false}>
      <Button
        type="text"
        className="!p-0 h-[30px] w-[48px] flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 group"
      >
        {mode === 'mouse' ? <Mouse size={18} /> : <Touchpad size={18} />}
        <ArrowDown className={`ml-[-6px] ${open ? 'rotate-180' : ''}`} size={16} />
      </Button>
    </Tooltip>
  </Dropdown>
));
ModeSelector.displayName = 'ModeSelector';

const MoreMenu = memo(
  ({
    mode,
    modeItems,
    onModeChange,
    onSlideshowClick,
    onExportImageClick,
    onExportCanvasClick,
    t,
    readonly,
  }: MoreMenuProps) => {
    const moreMenuItems = useMemo(
      () => [
        ...(readonly
          ? []
          : [
              {
                key: 'slideshow',
                label: (
                  <div className="flex items-center gap-2" onClick={onSlideshowClick}>
                    <IconSlideshow size={18} />
                    {t('canvas.toolbar.slideshow')}
                  </div>
                ),
              },
            ]),
        {
          key: 'exportImage',
          label: (
            <div className="flex items-center gap-2" onClick={onExportImageClick}>
              <Download size={18} />
              {t('canvas.toolbar.exportImage')}
            </div>
          ),
        },
        ...(readonly
          ? []
          : [
              {
                key: 'exportCanvas',
                label: (
                  <div className="flex items-center gap-2" onClick={onExportCanvasClick}>
                    <Download size={18} />
                    {t('canvas.toolbar.exportCanvas')}
                  </div>
                ),
              },
            ]),
        {
          type: 'divider' as const,
        },
        {
          key: 'mode',
          label: (
            <div className="flex items-center gap-2">
              {mode === 'mouse' ? <Mouse size={18} /> : <Touchpad size={18} />}
              {t('canvas.toolbar.tooltip.mode')}
            </div>
          ),
          children: modeItems.map((item) => ({
            key: item.key,
            label: item.label,
            onClick: () => onModeChange(item.key as 'mouse' | 'touchpad'),
          })),
        },
      ],
      [
        mode,
        modeItems,
        onSlideshowClick,
        onExportImageClick,
        onExportCanvasClick,
        onModeChange,
        t,
        readonly,
      ],
    );

    return (
      <Dropdown
        menu={{
          items: moreMenuItems,
          className:
            'more-tools-dropdown dark:bg-gray-800 dark:[&_.ant-dropdown-menu-item-selected]:bg-gray-700',
        }}
        trigger={['click']}
      >
        <Tooltip title={t('common.more')} arrow={false}>
          <Button
            type="text"
            icon={<More size={18} />}
            className="!p-0 h-[30px] w-[30px] flex items-center justify-center"
          />
        </Tooltip>
      </Dropdown>
    );
  },
);
MoreMenu.displayName = 'MoreMenu';

export const ToolbarButtons = memo(
  ({
    canvasTitle,
    mode,
    changeMode,
  }: {
    canvasTitle: string;
    mode: 'mouse' | 'touchpad';
    changeMode: (mode: 'mouse' | 'touchpad') => void;
  }) => {
    const { t } = useTranslation();
    const { exportCanvasAsImage } = useExportCanvasAsImage();
    const { readonly, canvasId } = useCanvasContext();
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

    const { showSlideshow, setShowSlideshow } = useCanvasStoreShallow((state) => ({
      showSlideshow: state.showSlideshow,
      setShowSlideshow: state.setShowSlideshow,
    }));

    // Memoize static configurations for mode selector
    const modeItems = useMemo(
      () => [
        {
          key: 'mouse',
          label: (
            <div className="flex items-center gap-2">
              <Mouse size={18} />
              {t('canvas.toolbar.mouse')}
            </div>
          ),
        },
        {
          key: 'touchpad',
          label: (
            <div className="flex items-center gap-2">
              <Touchpad size={18} />
              {t('canvas.toolbar.touchpad')}
            </div>
          ),
        },
      ],
      [t],
    );

    const handleSlideshowClick = useCallback(() => {
      logEvent('canvas::canvas_demo_click', Date.now(), {
        canvas_id: canvasId,
      });
      setShowSlideshow(!showSlideshow);
    }, [canvasId, showSlideshow, setShowSlideshow]);

    const handleExportImageClick = useCallback(() => {
      logEvent('canvas::canvas_download_image', Date.now(), {
        canvas_id: canvasId,
      });
      exportCanvasAsImage(canvasTitle);
    }, [canvasId, exportCanvasAsImage, canvasTitle]);

    const handleExportCanvasClick = useCallback(async () => {
      if (!canvasId) return;

      try {
        logEvent('canvas::canvas_export_click', Date.now(), {
          canvas_id: canvasId,
        });

        const { data } = await getClient().exportCanvas({
          query: { canvasId },
        });
        if (data?.data?.downloadUrl) {
          try {
            // Fetch the content from the download URL
            const response = await fetch(data.data.downloadUrl);

            if (!response.ok) {
              throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
            }

            // Get the content as blob
            const blob = await response.blob();

            // Create a blob URL
            const blobUrl = window.URL.createObjectURL(blob);

            // Create a temporary link element to trigger download
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `${canvasTitle || 'canvas'}.json`;
            document.body.appendChild(link);
            link.click();

            // Clean up the blob URL and link element
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
          } catch (fetchError) {
            console.error('Failed to download file:', fetchError);
            // Fallback: try to open in new tab if fetch fails
            window.open(data.data.downloadUrl, '_blank');
          }
        }
      } catch (error) {
        console.error('Failed to export canvas:', error);
        // TODO: Add proper error handling/notification
      }
    }, [canvasId, canvasTitle]);

    return (
      <>
        <div className="flex items-center">
          <MoreMenu
            readonly={readonly}
            mode={mode}
            modeItems={modeItems}
            onModeChange={changeMode}
            onSlideshowClick={handleSlideshowClick}
            onExportImageClick={handleExportImageClick}
            onExportCanvasClick={handleExportCanvasClick}
            t={t}
          />

          <Help />

          {(!sidePanelVisible || showWorkflowRun) && (
            <>
              <Divider type="vertical" className="h-5 bg-refly-Card-Border" />

              <Tooltip title={t('canvas.toolbar.openResourcesPanel')} arrow={false}>
                <Button
                  type="text"
                  icon={<Resource size={18} />}
                  onClick={handleResourcesPanelOpen}
                />
              </Tooltip>
            </>
          )}
        </div>
      </>
    );
  },
);
