import { Breadcrumb, Button, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { SideRight } from 'refly-icons';
import { useCanvasResourcesPanelStoreShallow, type CanvasResourcesParentType } from '@refly/stores';

interface CanvasResourcesHeaderProps {
  parentType?: CanvasResourcesParentType;
  setParentType?: (parentType: CanvasResourcesParentType) => void;
  resourceTitle?: string;
}

export const CanvasResourcesHeader = ({
  parentType,
  resourceTitle,
  setParentType,
}: CanvasResourcesHeaderProps) => {
  const { t } = useTranslation();
  const { setResourcesPanelWidth, setShowLeftOverview } = useCanvasResourcesPanelStoreShallow(
    (state) => ({
      setResourcesPanelWidth: state.setResourcesPanelWidth,
      setShowLeftOverview: state.setShowLeftOverview,
    }),
  );

  const handleClose = () => {
    setResourcesPanelWidth(0);
    setShowLeftOverview(false);
  };

  const handleShowLeftOverview = () => {
    setShowLeftOverview(true);
  };

  const handleParentClick = () => {
    setParentType?.(null);
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
            {resourceTitle && <Breadcrumb.Item>{resourceTitle}</Breadcrumb.Item>}
          </Breadcrumb>
        ) : (
          <div className="text-refly-text-0 text-base font-semibold leading-[26px]">
            {t('canvas.resourceLibrary.title')}
          </div>
        )}
      </div>
    </div>
  );
};
