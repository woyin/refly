import { memo } from 'react';
import { Breadcrumb, Button, Tooltip, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { SideRight } from 'refly-icons';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';

const { Text } = Typography;

export const CanvasResourcesHeader = memo(() => {
  const { t } = useTranslation();
  const {
    parentType,
    activeNode,
    setParentType,
    setActiveNode,
    setActiveTab,
    setPanelVisible,
    setShowLeftOverview,
  } = useCanvasResourcesPanelStoreShallow((state) => ({
    setShowLeftOverview: state.setShowLeftOverview,
    parentType: state.parentType,
    activeNode: state.activeNode,
    setParentType: state.setParentType,
    setActiveNode: state.setActiveNode,
    setActiveTab: state.setActiveTab,
    setPanelVisible: state.setPanelVisible,
  }));

  const handleClose = () => {
    setPanelVisible(false);
    setShowLeftOverview(false);
  };

  const handleShowLeftOverview = () => {
    setShowLeftOverview(true);
  };

  const handleParentClick = () => {
    setParentType(null);
    setActiveNode(null);
    setActiveTab(parentType);
    setShowLeftOverview(false);
  };

  return (
    <div className="h-[65px] flex items-center justify-between p-3 border-solid border-refly-Card-Border border-[1px] border-x-0 border-t-0">
      <div className="flex items-center gap-2">
        <Tooltip title={t('canvas.toolbar.closeResourcesPanel')} arrow={false}>
          <Button type="text" icon={<SideRight size={18} />} onClick={handleClose} />
        </Tooltip>
        {parentType ? (
          <Breadcrumb>
            <Breadcrumb.Item onClick={handleParentClick}>
              <a onMouseEnter={handleShowLeftOverview}>
                {t(`canvas.resourceLibrary.${parentType}`)}
              </a>
            </Breadcrumb.Item>
            <Breadcrumb.Item>
              <Text ellipsis={{ tooltip: true }} style={{ width: 300 }}>
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
    </div>
  );
});

CanvasResourcesHeader.displayName = 'CanvasResourcesHeader';
