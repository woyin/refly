import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { Popover, Button, message, Divider, Tooltip } from 'antd';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';

import { Share, Checked } from 'refly-icons';

import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { CreateTemplateModal } from '@refly-packages/ai-workspace-common/components/canvas-template/create-template-modal';
import { useListShares } from '@refly-packages/ai-workspace-common/queries';
import { getShareLink } from '@refly-packages/ai-workspace-common/utils/share';
import { useExportCanvasAsImage } from '@refly-packages/ai-workspace-common/hooks/use-export-canvas-as-image';
import { logEvent } from '@refly/telemetry-web';

type ShareAccess = 'off' | 'anyone';

interface ShareSettingsProps {
  canvasId: string;
  canvasTitle: string;
}

// Access option item component
interface AccessOptionItemProps {
  value: ShareAccess;
  currentAccess: ShareAccess;
  title: string;
  description: string;
  isFirst?: boolean;
  isLast?: boolean;
  onClick: (value: ShareAccess) => void;
}

const AccessOptionItem = React.memo(
  ({
    value,
    currentAccess,
    title,
    description,
    isFirst = false,
    isLast = false,
    onClick,
  }: AccessOptionItemProps) => {
    const isSelected = currentAccess === value;

    const getBorderRadius = () => {
      if (isFirst && isLast) return 'rounded-[12px]';
      if (isFirst) return 'rounded-t-[12px]';
      if (isLast) return 'rounded-b-[12px]';
      return '';
    };

    return (
      <div
        className={`px-4 py-3 cursor-pointer transition-all hover:bg-refly-tertiary-hover ${getBorderRadius()} ${
          isSelected ? 'bg-refly-tertiary-default' : ''
        }`}
        onClick={() => onClick(value)}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-refly-text-0 leading-5">{title}</div>
            <div className="text-xs text-refly-text-2 leading-4">{description}</div>
          </div>
          {isSelected && <Checked size={20} color="var(--refly-primary-default)" />}
        </div>
      </div>
    );
  },
);

AccessOptionItem.displayName = 'AccessOptionItem';

// Memoized ShareSettings component for better performance
const ShareSettings = React.memo(({ canvasId, canvasTitle }: ShareSettingsProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [createTemplateModalVisible, setCreateTemplateModalVisible] = useState(false);
  const [access, setAccess] = useState<ShareAccess>('off');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateShareLoading, setUpdateShareLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const {
    data,
    refetch: refetchShares,
    isLoading: isLoadingShares,
  } = useListShares({
    query: { entityId: canvasId, entityType: 'canvas' },
  });

  // Get the latest share record that is not a template
  const shareRecord = useMemo(
    () => data?.data?.filter((shareRecord) => !shareRecord.templateId)[0],
    [data],
  );
  const shareLink = useMemo(
    () => getShareLink('canvas', shareRecord?.shareId ?? ''),
    [shareRecord],
  );

  const { uploadCanvasCover } = useExportCanvasAsImage();

  // Memoized function to re-share latest content before copying link
  const updateShare = useCallback(async () => {
    if (access === 'off') return;

    // Asynchronously create new share with latest content
    (async () => {
      try {
        setUpdateShareLoading(true);
        const { storageKey } = await uploadCanvasCover();
        const { data, error } = await getClient().createShare({
          body: {
            entityId: canvasId,
            entityType: 'canvas',
            allowDuplication: true,
            coverStorageKey: storageKey,
          },
        });

        if (data?.success && !error) {
          message.success(t('shareContent.updateShareSuccess'));
          await refetchShares();
        }
      } catch (error) {
        console.error('Failed to create share:', error);
      } finally {
        setUpdateShareLoading(false);
      }
    })();
  }, [access, canvasId, refetchShares, shareRecord?.shareId, t, uploadCanvasCover]);

  const copyLink = useCallback(async () => {
    if (access === 'off') return;
    // Copy link to clipboard immediately for better UX
    const newShareLink = getShareLink('canvas', shareRecord?.shareId ?? '');
    await navigator.clipboard.writeText(newShareLink);
    setLinkCopied(true);
    message.success(t('shareContent.copyLinkSuccess'));
    // Reset copied state after 3 seconds
    setTimeout(() => setLinkCopied(false), 3000);
  }, [access, shareRecord?.shareId, t]);

  const handlePublishToCommunity = useCallback(() => {
    setCreateTemplateModalVisible(true);
    setOpen(false);
  }, []);

  useEffect(() => {
    setAccess(shareRecord ? 'anyone' : 'off');
  }, [shareRecord]);

  const updateCanvasPermission = useCallback(
    async (value: ShareAccess): Promise<boolean> => {
      setUpdateLoading(true);
      let success: boolean;

      try {
        // Get the most recent share data before performing operations
        const latestSharesData = await getClient().listShares({
          query: { entityId: canvasId, entityType: 'canvas' },
        });
        const shareRecords = latestSharesData?.data?.data;
        const latestShareRecord = shareRecords?.filter((shareRecord) => !shareRecord.templateId)[0];
        if (value === 'off') {
          if (latestShareRecord?.shareId) {
            const { data, error } = await getClient().deleteShare({
              body: { shareId: latestShareRecord.shareId },
            });
            success = data?.success && !error;
          } else {
            // No share to delete
            success = true;
          }
        } else {
          const { storageKey } = await uploadCanvasCover();
          const { data } = await getClient().createShare({
            body: {
              entityId: canvasId,
              entityType: 'canvas',
              allowDuplication: true,
              coverStorageKey: storageKey,
            },
          });
          success = data?.success;
          if (!data.success) {
            message.error(data?.errMsg);
          }
        }

        if (success) {
          message.success(t('shareContent.updateCanvasPermissionSuccess'));
          setAccess(value);
          await refetchShares();
        }
      } catch (err) {
        console.error('Error updating canvas permission:', err);
        success = false;
      } finally {
        setUpdateLoading(false);
      }

      return success;
    },
    [canvasId, t, refetchShares, uploadCanvasCover],
  );

  const handleAccessChange = useCallback(
    async (value: ShareAccess) => {
      const success = await updateCanvasPermission(value);

      if (success && value === 'anyone') {
        setTimeout(async () => {
          copyLink();
        }, 500);
      }
    },
    [updateCanvasPermission, copyLink],
  );

  // Memoize content to prevent unnecessary re-renders
  const content = useMemo(
    () => (
      <div className="w-[480px] p-6 bg-refly-bg-content-z2 rounded-[12px] shadow-lg border-[1px] border-solid border-refly-Card-Border">
        <div className="text-lg font-semibold text-refly-text-0 leading-6 mb-4">
          {t('common.share')}
        </div>

        {/* Access Options */}
        <div className="border-[1px] border-solid border-refly-Card-Border bg-refly-bg-content-z1 rounded-[12px]">
          <Spin spinning={updateLoading || isLoadingShares}>
            <AccessOptionItem
              value="off"
              currentAccess={access}
              title={t('shareContent.accessOptions.off')}
              description={t('shareContent.accessOptions.offDescription')}
              isFirst={true}
              onClick={() => {
                logEvent('canvas::canvas_share_private', Date.now(), {
                  canvas_id: canvasId,
                });
                handleAccessChange('off');
              }}
            />

            <Divider className="my-0 bg-refly-Card-Border" />

            <AccessOptionItem
              value="anyone"
              currentAccess={access}
              title={t('shareContent.accessOptions.anyone')}
              description={t('shareContent.accessOptions.anyoneDescription')}
              isLast={true}
              onClick={handleAccessChange}
            />
          </Spin>
        </div>

        {access === 'anyone' && (
          <div className="my-2 pl-4 pr-2 py-2 border-[1px] border-solid border-refly-Card-Border bg-refly-bg-content-z1 rounded-[12px] flex items-center gap-3">
            <div className="flex-1 text-sm text-refly-text-1 leading-4 truncate">{shareLink}</div>
            <Tooltip title={t('shareContent.updateShareTooltip')}>
              <Button
                color="default"
                variant="filled"
                className="flex-shrink-0 w-[104px] h-[32px] text-sm text-refly-text-0 leading-5 font-semibold"
                onClick={() => {
                  logEvent('canvas::canvas_share_public_sync', Date.now(), {
                    canvas_id: canvasId,
                  });
                  updateShare();
                }}
                loading={updateShareLoading}
                disabled={updateShareLoading}
              >
                {t('shareContent.updateShare')}
              </Button>
            </Tooltip>

            <Tooltip title={t('shareContent.copyLinkTooltip')}>
              <Button
                color="default"
                variant="filled"
                onClick={() => {
                  logEvent('canvas::canvas_share_copy_link', Date.now(), {
                    canvas_id: canvasId,
                  });
                  copyLink();
                }}
                disabled={linkCopied}
                className="flex-shrink-0 w-[104px] h-[32px] text-sm text-refly-text-0 leading-5 font-semibold"
              >
                {linkCopied ? t('shareContent.linkCopied') : t('shareContent.copyLink')}
              </Button>
            </Tooltip>
          </div>
        )}

        {/* Publish to Community Section */}
        <div className="mt-2 pl-4 pr-2 py-2 border-[1px] border-solid border-refly-Card-Border bg-refly-bg-content-z1 rounded-[12px] flex items-center justify-between">
          <div className="text-sm text-refly-text-0 leading-5 font-semibold flex-1 truncate">
            {t('shareContent.publishTemplate')}
          </div>
          <Button
            type="primary"
            size="small"
            className="w-[104px] h-[32px]"
            onClick={() => {
              logEvent('canvas::canvas_publish_template', Date.now(), {
                canvas_id: canvasId,
              });
              handlePublishToCommunity();
            }}
          >
            {t('shareContent.publish')}
          </Button>
        </div>
      </div>
    ),
    [
      t,
      access,
      shareLink,
      linkCopied,
      updateLoading,
      isLoadingShares,
      updateShareLoading,
      handleAccessChange,
      updateShare,
      copyLink,
      handlePublishToCommunity,
    ],
  );

  return (
    <div>
      <CreateTemplateModal
        canvasId={canvasId}
        title={canvasTitle}
        visible={createTemplateModalVisible}
        setVisible={setCreateTemplateModalVisible}
      />
      <Popover
        className="canvas-share-setting-popover"
        open={open}
        onOpenChange={setOpen}
        trigger="click"
        placement="bottomLeft"
        overlayInnerStyle={{ padding: 0, borderRadius: '12px', background: 'transparent' }}
        content={content}
        arrow={false}
      >
        <Button
          type="primary"
          icon={<Share size={16} className="flex items-center justify-center" />}
        >
          {t('common.share')}
        </Button>
      </Popover>
    </div>
  );
});

ShareSettings.displayName = 'ShareSettings';

export default ShareSettings;
