import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tooltip, Typography } from 'antd';
import { Add, ScreenFull, ScreenDefault, SideRight } from 'refly-icons';
import {
  useActiveNode,
  useCanvasResourcesPanelStoreShallow,
  useImportResourceStoreShallow,
} from '@refly/stores';
import { TopButtons } from './top-buttons';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import cn from 'classnames';

const { Text } = Typography;

export const CanvasResourcesHeader = memo(() => {
  const { t } = useTranslation();
  const { canvasId } = useCanvasContext();
  const {
    parentType,
    setParentType,
    sidePanelVisible,
    wideScreenVisible,
    setSidePanelVisible,
    setWideScreenVisible,
    setActiveTab,
    setShowLeftOverview,
  } = useCanvasResourcesPanelStoreShallow((state) => ({
    setShowLeftOverview: state.setShowLeftOverview,
    parentType: state.parentType,
    sidePanelVisible: state.sidePanelVisible,
    wideScreenVisible: state.wideScreenVisible,
    setParentType: state.setParentType,
    setSidePanelVisible: state.setSidePanelVisible,
    setWideScreenVisible: state.setWideScreenVisible,
    setActiveTab: state.setActiveTab,
  }));
  const { activeNode, setActiveNode } = useActiveNode(canvasId);
  const { setImportResourceModalVisible } = useImportResourceStoreShallow((state) => ({
    setImportResourceModalVisible: state.setImportResourceModalVisible,
  }));

  const handleClose = useCallback(() => {
    setSidePanelVisible(false);
    setShowLeftOverview(false);
    setWideScreenVisible(false);
  }, [setSidePanelVisible, setShowLeftOverview, setWideScreenVisible]);

  const handleShowLeftOverview = useCallback(() => {
    if (sidePanelVisible && !wideScreenVisible) {
      setShowLeftOverview(true);
    }
  }, [sidePanelVisible, wideScreenVisible, setShowLeftOverview]);

  const handleParentClick = useCallback(() => {
    if (sidePanelVisible) {
      setActiveTab(parentType);
      setParentType(null);
      setActiveNode(null);
      setShowLeftOverview(false);
    }
  }, [
    setParentType,
    setActiveNode,
    setActiveTab,
    setShowLeftOverview,
    parentType,
    sidePanelVisible,
  ]);

  const handleAddResource = useCallback(() => {
    setImportResourceModalVisible(true);
  }, [setImportResourceModalVisible]);

  const handleWideScreen = useCallback(() => {
    setShowLeftOverview(false);
    setWideScreenVisible(true);
  }, [setShowLeftOverview, setWideScreenVisible]);

  const handleExitWideScreen = useCallback(() => {
    setWideScreenVisible(false);
  }, [setWideScreenVisible]);

  return (
    <div className="w-full h-[65px] flex items-center justify-between p-3 border-solid border-refly-Card-Border border-[1px] border-x-0 border-t-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {sidePanelVisible && (
          <Tooltip title={t('canvas.toolbar.closeResourcesPanel')} arrow={false}>
            <Button type="text" icon={<SideRight size={16} />} onClick={handleClose} />
          </Tooltip>
        )}

        {parentType ? (
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <Button
              type="text"
              size="small"
              onClick={handleParentClick}
              className={cn(wideScreenVisible ? 'pointer-events-none' : '', 'px-0.5')}
            >
              <a
                className="whitespace-nowrap text-refly-text-1 hover:refly-tertiary-hover hover:text-refly-text-1"
                onMouseEnter={handleShowLeftOverview}
              >
                {t(`canvas.resourceLibrary.${parentType}`)}
              </a>
            </Button>
            <div className="text-refly-text-2">/</div>
            <Text ellipsis={{ tooltip: true }} className="min-w-0 flex-1 !max-w-[400px]">
              {activeNode?.data?.title || t('common.untitled')}
            </Text>
          </div>
        ) : (
          <div className="text-refly-text-0 text-base font-semibold leading-[26px] min-w-0 flex-1">
            {t('canvas.resourceLibrary.title')}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {!parentType && (
          <Tooltip title={t('canvas.toolbar.addResource')} arrow={false}>
            <Button size="small" type="text" icon={<Add size={18} />} onClick={handleAddResource} />
          </Tooltip>
        )}

        <TopButtons />

        {parentType && (
          <Tooltip title={t('canvas.toolbar.addResource')} arrow={false}>
            <Button size="small" type="text" icon={<Add size={16} />} onClick={handleAddResource} />
          </Tooltip>
        )}

        {activeNode && (
          <Tooltip
            title={t(
              `canvas.resourceLibrary.${wideScreenVisible ? 'exitWideScreen' : 'wideScreen'}`,
            )}
            arrow={false}
          >
            <Button
              className="!h-5 !w-5 p-0"
              size="small"
              type="text"
              icon={wideScreenVisible ? <ScreenDefault size={16} /> : <ScreenFull size={16} />}
              onClick={wideScreenVisible ? handleExitWideScreen : handleWideScreen}
            />
          </Tooltip>
        )}
      </div>
    </div>
  );
});

CanvasResourcesHeader.displayName = 'CanvasResourcesHeader';
