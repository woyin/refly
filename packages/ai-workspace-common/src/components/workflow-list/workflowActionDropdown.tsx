import { memo, useState, useCallback } from 'react';
import { Button, Dropdown, DropdownProps, MenuProps, message } from 'antd';
import { More } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import { useCanvasOperationStoreShallow } from '@refly/stores';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { getShareLink } from '@refly-packages/ai-workspace-common/utils/share';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import './index.scss';
import { Canvas } from '@refly/openapi-schema';
import { useDuplicateCanvas } from '@refly-packages/ai-workspace-common/hooks/use-duplicate-canvas';

interface WorkflowActionDropdown {
  workflow: Canvas;
  children?: React.ReactNode;
  onRenameSuccess?: (workflow: Canvas) => void;
  onDeleteSuccess?: (workflow: Canvas) => void;
  onShareSuccess?: () => void;
}

export const WorkflowActionDropdown = memo((props: WorkflowActionDropdown) => {
  const { workflow, children, onRenameSuccess, onDeleteSuccess, onShareSuccess } = props;
  const { t } = useTranslation();
  const [popupVisible, setPopupVisible] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  const { duplicateCanvas, loading: duplicateLoading } = useDuplicateCanvas();

  const { openRenameModal, openDeleteModal } = useCanvasOperationStoreShallow((state) => ({
    openRenameModal: state.openRenameModal,
    openDeleteModal: state.openDeleteModal,
  }));

  // Check if workflow is shared
  const isShared = workflow.shareRecord?.shareId;

  // Handle share workflow
  const handleShare = useCallback(async () => {
    try {
      setShareLoading(true);
      const { data } = await getClient().createShare({
        body: {
          entityId: workflow.canvasId,
          entityType: 'canvas',
          allowDuplication: true,
        },
      });

      if (data?.success) {
        const shareLink = getShareLink('canvas', data.data?.shareId ?? '');
        await navigator.clipboard.writeText(shareLink);
        message.success(t('workflowList.shareSuccess', { title: workflow.title }));
        onShareSuccess?.();
      } else {
        message.error(data?.errMsg || t('workflowList.shareFailed', { title: workflow.title }));
      }
    } catch (error) {
      console.error('Failed to share workflow:', error);
      message.error(t('workflowList.shareFailed', { title: workflow.title }));
    } finally {
      setShareLoading(false);
    }
    setPopupVisible(false);
  }, [workflow, t, onShareSuccess]);

  // Handle unshare workflow
  const handleUnshare = useCallback(async () => {
    try {
      setShareLoading(true);
      const shareId = workflow.shareRecord?.shareId;
      if (!shareId) {
        message.error(t('workflowList.unshareFailed', { title: workflow.title }));
        return;
      }

      const { data } = await getClient().deleteShare({
        body: { shareId },
      });

      if (data?.success) {
        message.success(t('workflowList.unshareSuccess', { title: workflow.title }));
        onShareSuccess?.();
      } else {
        message.error(data?.errMsg || t('workflowList.unshareFailed', { title: workflow.title }));
      }
    } catch (error) {
      console.error('Failed to unshare workflow:', error);
      message.error(t('workflowList.unshareFailed', { title: workflow.title }));
    } finally {
      setShareLoading(false);
    }
    setPopupVisible(false);
  }, [workflow, t, onShareSuccess]);

  const hideDropdown = useCallback(() => {
    setPopupVisible(false);
  }, [setPopupVisible]);

  const handleDuplicate = useCallback(() => {
    duplicateCanvas({
      canvasId: workflow.canvasId,
      title: workflow.title,
      isCopy: true,
      onSuccess: hideDropdown,
    });
  }, [workflow.canvasId, workflow.title, duplicateCanvas, hideDropdown]);

  const items: MenuProps['items'] = [
    {
      label: (
        <div
          className="flex items-center gap-1 w-28"
          onClick={(e) => {
            e.stopPropagation();
            openRenameModal(workflow.canvasId, workflow.title, onRenameSuccess);
            setPopupVisible(false);
          }}
        >
          {t('canvas.toolbar.rename')}
        </div>
      ),
      key: 'rename',
    },
    {
      label: (
        <div
          className="flex items-center gap-1 w-28"
          onClick={(e) => {
            e.stopPropagation();
            handleDuplicate();
          }}
        >
          {t('canvas.toolbar.duplicate')}
          <Spin spinning={duplicateLoading} size="small" className="text-refly-text-3" />
        </div>
      ),
      key: 'duplicate',
      disabled: duplicateLoading,
    },
    ...(isShared
      ? [
          {
            label: (
              <div
                className="flex items-center gap-1 w-28"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnshare();
                }}
              >
                <Spin spinning={shareLoading} size="small" className="text-refly-text-3" />
                {t('workflowList.unshare')}
              </div>
            ),
            key: 'unshare',
          },
        ]
      : [
          {
            label: (
              <div
                className="flex items-center gap-1 w-28"
                onClick={(e) => {
                  e.stopPropagation();
                  handleShare();
                }}
              >
                <Spin spinning={shareLoading} size="small" className="text-refly-text-3" />
                {t('workflowList.share')}
              </div>
            ),
            key: 'share',
          },
        ]),
    {
      label: (
        <div
          className="flex items-center text-refly-func-danger-default gap-1 w-28"
          onClick={(e) => {
            e.stopPropagation();
            openDeleteModal(workflow.canvasId, workflow.title, onDeleteSuccess);
            setPopupVisible(false);
          }}
        >
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

  return (
    <Dropdown
      overlayClassName="canvas-action-dropdown"
      trigger={['click']}
      open={popupVisible}
      onOpenChange={handleOpenChange}
      menu={{
        items,
      }}
    >
      {children ? (
        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      ) : (
        <Button
          size="small"
          onClick={(e) => e.stopPropagation()}
          type="text"
          icon={<More size={16} />}
        />
      )}
    </Dropdown>
  );
});

WorkflowActionDropdown.displayName = 'WorkflowActionDropdown';
