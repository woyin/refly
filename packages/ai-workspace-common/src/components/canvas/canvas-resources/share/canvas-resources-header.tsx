import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Breadcrumb, Button, Tooltip, Typography } from 'antd';
import { Add, ScreenFull, ScreenDefault, SideRight } from 'refly-icons';
import { useCanvasResourcesPanelStoreShallow, useImportResourceStoreShallow } from '@refly/stores';
import { TopButtons } from './top-buttons';

const { Text } = Typography;

export const CanvasResourcesHeader = memo(() => {
  const { t } = useTranslation();
  const {
    parentType,
    activeNode,
    sidePanelVisible,
    wideScreenVisible,
    setParentType,
    setSidePanelVisible,
    setWideScreenVisible,
    setActiveNode,
    setActiveTab,
    setShowLeftOverview,
  } = useCanvasResourcesPanelStoreShallow((state) => ({
    setShowLeftOverview: state.setShowLeftOverview,
    parentType: state.parentType,
    activeNode: state.activeNode,
    sidePanelVisible: state.sidePanelVisible,
    wideScreenVisible: state.wideScreenVisible,
    setParentType: state.setParentType,
    setSidePanelVisible: state.setSidePanelVisible,
    setWideScreenVisible: state.setWideScreenVisible,
    setActiveNode: state.setActiveNode,
    setActiveTab: state.setActiveTab,
  }));
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
    <div className="h-[65px] flex items-center justify-between p-3 border-solid border-refly-Card-Border border-[1px] border-x-0 border-t-0">
      <div className="flex items-center gap-2">
        {sidePanelVisible && (
          <Tooltip title={t('canvas.toolbar.closeResourcesPanel')} arrow={false}>
            <Button type="text" icon={<SideRight size={16} />} onClick={handleClose} />
          </Tooltip>
        )}
        {parentType ? (
          <Breadcrumb>
            <Breadcrumb.Item
              onClick={handleParentClick}
              className={wideScreenVisible ? 'pointer-events-none' : ''}
            >
              <a onMouseEnter={handleShowLeftOverview}>
                {t(`canvas.resourceLibrary.${parentType}`)}
              </a>
            </Breadcrumb.Item>
            <Breadcrumb.Item>
              <Text ellipsis={{ tooltip: true }} style={{ width: 200 }}>
                {activeNode?.data?.title || t('common.untitled')}
              </Text>
            </Breadcrumb.Item>
          </Breadcrumb>
        ) : (
          <div className="text-refly-text-0 text-base font-semibold leading-[26px]">
            {t('canvas.resourceLibrary.title')}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
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
