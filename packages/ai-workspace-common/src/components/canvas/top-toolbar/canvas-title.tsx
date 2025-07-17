import { useCallback, memo } from 'react';
import { Tooltip, Skeleton, Typography, Avatar, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { LOCALE } from '@refly/common-types';
import { IconCanvas, IconEdit } from '@refly-packages/ai-workspace-common/components/common/icon';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { ShareUser } from '@refly/openapi-schema';
import { AiOutlineUser } from 'react-icons/ai';
import { useCanvasOperationStoreShallow } from '@refly/stores';

export const CanvasTitle = memo(
  ({
    canvasId,
    canvasLoading,
    canvasTitle,
    language,
  }: {
    canvasId: string;
    canvasLoading: boolean;
    canvasTitle: string;
    language: LOCALE;
  }) => {
    const { t } = useTranslation();
    const { openRenameModal } = useCanvasOperationStoreShallow((state) => ({
      openRenameModal: state.openRenameModal,
    }));

    const handleEditClick = useCallback(() => {
      openRenameModal(canvasId, canvasTitle);
    }, [openRenameModal, canvasId, canvasTitle]);

    const isSyncing = canvasLoading;

    return (
      <>
        <div
          className="ml-1 group flex items-center gap-2 text-sm font-bold cursor-pointer"
          onClick={handleEditClick}
          data-cy="canvas-title-edit"
        >
          <Tooltip
            title={
              isSyncing
                ? t('canvas.toolbar.syncingChanges')
                : t('canvas.toolbar.synced', {
                    time: time(new Date(), language)?.utc()?.fromNow(),
                  })
            }
          >
            <div
              className={`
              relative w-2.5 h-2.5 rounded-full
              transition-colors duration-700 ease-in-out
              ${isSyncing ? 'bg-yellow-500 animate-pulse' : 'bg-green-400'}
            `}
            />
          </Tooltip>
          {canvasLoading ? (
            <Skeleton className="w-32" active paragraph={false} />
          ) : (
            <Typography.Text
              className="!max-w-72 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
              ellipsis={{ tooltip: true }}
            >
              {canvasTitle || t('common.untitled')}
            </Typography.Text>
          )}
          <IconEdit className="text-gray-500 flex items-center justify-center" />
        </div>
      </>
    );
  },
);

export const ReadonlyCanvasTitle = memo(
  ({
    canvasTitle,
    isLoading,
    owner,
  }: {
    canvasTitle?: string;
    isLoading: boolean;
    owner?: ShareUser;
  }) => {
    const { t } = useTranslation();

    return (
      <div
        className="ml-1 group flex items-center gap-2 text-sm font-bold text-gray-500"
        data-cy="canvas-title-readonly"
      >
        <IconCanvas />
        {isLoading ? (
          <Skeleton className="w-32" active paragraph={false} />
        ) : (
          <>
            <Typography.Text className="!max-w-72 text-gray-500" ellipsis={{ tooltip: true }}>
              {canvasTitle || t('common.untitled')}
            </Typography.Text>

            {owner && (
              <>
                <Divider type="vertical" className="h-4" />
                <Avatar
                  src={owner.avatar}
                  size={18}
                  shape="circle"
                  icon={!owner.avatar ? <AiOutlineUser /> : undefined}
                />
                <Typography.Text className="text-gray-500 font-light text-sm">
                  {`@${owner.name}`}
                </Typography.Text>
              </>
            )}
          </>
        )}
      </div>
    );
  },
);
