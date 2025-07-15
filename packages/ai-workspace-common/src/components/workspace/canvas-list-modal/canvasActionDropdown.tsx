import { useEffect, useState, memo } from 'react';
import { Button, Dropdown, DropdownProps, MenuProps } from 'antd';
import {
  IconMoreHorizontal,
  IconDelete,
  IconEdit,
  IconPlayOutline,
  IconCopy,
  IconRemove,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { useTranslation } from 'react-i18next';
import { useCanvasOperationStoreShallow } from '@refly/stores';

interface CanvasActionDropdown {
  canvasId: string;
  canvasName: string;
  btnSize?: 'small' | 'large';
  updateShowStatus?: (canvasId: string | null) => void;
  afterDelete?: () => void;
  afterRename?: (newTitle: string, canvasId: string) => void;
  handleUseCanvas?: () => void;
  handleRemoveFromProject?: () => void;
}

export const CanvasActionDropdown = memo((props: CanvasActionDropdown) => {
  const {
    canvasId,
    canvasName,
    btnSize = 'small',
    updateShowStatus,
    handleUseCanvas,
    handleRemoveFromProject,
  } = props;
  const [popupVisible, setPopupVisible] = useState(false);
  const { t } = useTranslation();

  const { openRenameModal, openDeleteModal, openDuplicateModal } = useCanvasOperationStoreShallow(
    (state) => ({
      openRenameModal: state.openRenameModal,
      openDeleteModal: state.openDeleteModal,
      openDuplicateModal: state.openDuplicateModal,
    }),
  );

  const items: MenuProps['items'] = [
    handleUseCanvas && {
      label: (
        <div
          className="flex items-center"
          onClick={(e) => {
            e.stopPropagation();
            setPopupVisible(false);
            handleUseCanvas();
          }}
        >
          <IconPlayOutline size={16} className="mr-2" />
          {t('workspace.canvasListModal.continue')}
        </div>
      ),
      key: 'useCanvas',
    },
    {
      label: (
        <div
          className="flex items-center"
          onClick={(e) => {
            e.stopPropagation();
            openRenameModal(canvasId, canvasName);
            setPopupVisible(false);
          }}
        >
          <IconEdit size={16} className="mr-2" />
          {t('canvas.toolbar.rename')}
        </div>
      ),
      key: 'rename',
    },
    {
      label: (
        <div
          className="flex items-center"
          onClick={(e) => {
            e.stopPropagation();
            openDuplicateModal(canvasId, canvasName);
            setPopupVisible(false);
          }}
        >
          <IconCopy size={14} className="mr-2" />
          {t('canvas.toolbar.duplicate')}
        </div>
      ),
      key: 'duplicate',
    },
    handleRemoveFromProject && {
      label: (
        <div
          className="flex items-center"
          onClick={(e) => {
            e.stopPropagation();
            setPopupVisible(false);
            handleRemoveFromProject();
          }}
        >
          <IconRemove size={16} className="mr-2" />
          {t('canvas.toolbar.removeFromProject')}
        </div>
      ),
      key: 'removeFromProject',
    },
    {
      label: (
        <div
          className="flex items-center text-red-600"
          onClick={(e) => {
            e.stopPropagation();
            openDeleteModal(canvasId, canvasName);
            setPopupVisible(false);
          }}
        >
          <IconDelete size={16} className="mr-2" />
          {t('canvas.toolbar.deleteCanvas')}
        </div>
      ),
      key: 'delete',
    },
  ];

  const handleOpenChange: DropdownProps['onOpenChange'] = (open: boolean, info: any) => {
    if (info.source === 'trigger') {
      setPopupVisible(open);
    }
  };

  useEffect(() => {
    if (popupVisible) {
      updateShowStatus?.(canvasId);
    } else {
      updateShowStatus?.(null);
    }
  }, [popupVisible]);

  return (
    <Dropdown
      trigger={['click']}
      open={popupVisible}
      onOpenChange={handleOpenChange}
      menu={{
        items,
      }}
    >
      <Button
        size={btnSize}
        onClick={(e) => e.stopPropagation()}
        type="text"
        icon={<IconMoreHorizontal />}
      />
    </Dropdown>
  );
});

CanvasActionDropdown.displayName = 'CanvasActionDropdown';
