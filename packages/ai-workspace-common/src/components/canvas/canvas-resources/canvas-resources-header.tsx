import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Breadcrumb, Button, Tooltip, Typography } from 'antd';
import { Add, ScreenFull, ScreenDefault, SideRight } from 'refly-icons';
import { useCanvasResourcesPanelStoreShallow, useImportResourceStoreShallow } from '@refly/stores';

const { Text } = Typography;

export const CanvasResourcesHeader = memo(() => {
  const { t } = useTranslation();
  const {
    parentType,
    panelMode,
    activeNode,
    setParentType,
    setActiveNode,
    setActiveTab,
    setPanelMode,
    setShowLeftOverview,
  } = useCanvasResourcesPanelStoreShallow((state) => ({
    setShowLeftOverview: state.setShowLeftOverview,
    parentType: state.parentType,
    panelMode: state.panelMode,
    activeNode: state.activeNode,
    setParentType: state.setParentType,
    setActiveNode: state.setActiveNode,
    setActiveTab: state.setActiveTab,
    setPanelMode: state.setPanelMode,
  }));
  const { setImportResourceModalVisible } = useImportResourceStoreShallow((state) => ({
    setImportResourceModalVisible: state.setImportResourceModalVisible,
  }));

  const handleClose = useCallback(() => {
    setPanelMode('hidden');
    setShowLeftOverview(false);
  }, [setPanelMode, setShowLeftOverview]);

  const handleShowLeftOverview = useCallback(() => {
    if (panelMode === 'normal') {
      setShowLeftOverview(true);
    }
  }, [panelMode, setShowLeftOverview]);

  const handleParentClick = useCallback(() => {
    if (panelMode === 'normal') {
      setParentType(null);
      setActiveNode(null);
      setActiveTab(parentType);
      setShowLeftOverview(false);
    }
  }, [setParentType, setActiveNode, setActiveTab, setShowLeftOverview, panelMode]);

  const handleAddResource = useCallback(() => {
    setImportResourceModalVisible(true);
  }, [setImportResourceModalVisible]);

  const handleWideScreen = useCallback(() => {
    console.log('handleWideScreen');
    setShowLeftOverview(false);
    setPanelMode('wide');
  }, [setPanelMode]);

  const handleExitWideScreen = useCallback(() => {
    console.log('handleExitWideScreen');
    setPanelMode('normal');
  }, [setPanelMode]);

  return (
    <div className="h-[65px] flex items-center justify-between p-3 border-solid border-refly-Card-Border border-[1px] border-x-0 border-t-0">
      <div className="flex items-center gap-2">
        {panelMode === 'normal' && (
          <Tooltip title={t('canvas.toolbar.closeResourcesPanel')} arrow={false}>
            <Button type="text" icon={<SideRight size={18} />} onClick={handleClose} />
          </Tooltip>
        )}
        {parentType ? (
          <Breadcrumb>
            <Breadcrumb.Item onClick={handleParentClick}>
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
      <div>
        <Tooltip title={t('canvas.toolbar.addResource')} arrow={false}>
          <Button type="text" icon={<Add size={18} />} onClick={handleAddResource} />
        </Tooltip>
        {activeNode &&
          (panelMode === 'normal' ? (
            <Tooltip title={t('canvas.resourceLibrary.wideScreen')} arrow={false}>
              <Button type="text" icon={<ScreenFull size={18} />} onClick={handleWideScreen} />
            </Tooltip>
          ) : (
            <Tooltip title={t('canvas.resourceLibrary.exitWideScreen')} arrow={false}>
              <Button
                type="text"
                icon={<ScreenDefault size={18} />}
                onClick={handleExitWideScreen}
              />
            </Tooltip>
          ))}
      </div>
    </div>
  );
});

CanvasResourcesHeader.displayName = 'CanvasResourcesHeader';
