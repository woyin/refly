import { memo, useCallback, useMemo, useState } from 'react';
import { Button, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { File } from 'refly-icons';
import { CanvasNode } from '@refly/canvas-common';
import type { IndexStatus } from '@refly/openapi-schema';
import { cn } from '@refly/utils/cn';
import { NODE_COLORS } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/colors';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';

const { Text } = Typography;

export interface MyUploadItemProps {
  node: CanvasNode;
  isActive: boolean;
  onSelect: (node: CanvasNode, beforeParsed: boolean) => void;
}

/**
 * Render a single uploaded resource item.
 */
export const MyUploadItem = memo(({ node, isActive, onSelect }: MyUploadItemProps) => {
  const { t } = useTranslation();
  const [isReindexing, setIsReindexing] = useState(false);
  const indexStatus = (node?.data?.metadata?.indexStatus ?? '') as IndexStatus | '';

  const isParseFailed = indexStatus === 'parse_failed';
  const isIndexFailed = indexStatus === 'index_failed';
  const isFailed = isParseFailed || isIndexFailed;
  const beforeParsed = ['init', 'wait_parse', 'parse_failed'].includes(indexStatus);
  const isRunning = ['wait_parse', 'wait_index'].includes(indexStatus) || isReindexing;
  const isFinished = ['finish'].includes(indexStatus);

  const iconContainerStyle = useMemo(() => ({ backgroundColor: NODE_COLORS.resource }), []);
  const setNodeDataByEntity = useSetNodeDataByEntity();

  const handleReindexResource = useCallback(async () => {
    const resourceId = node.data?.entityId;

    if (!resourceId || isReindexing) return;

    setIsReindexing(true);
    const { data, error } = await getClient().reindexResource({
      body: {
        resourceIds: [resourceId],
      },
    });
    setIsReindexing(false);

    if (error || !data?.success) {
      return;
    }

    const indexStatus =
      node.data?.metadata?.indexStatus === 'index_failed' ? 'wait_index' : 'wait_parse';

    setNodeDataByEntity(
      {
        type: 'resource',
        entityId: resourceId,
      },
      {
        metadata: {
          indexStatus,
        },
      },
    );
  }, [isReindexing, setNodeDataByEntity, node.data?.entityId]);

  return (
    <div
      className={cn(
        'group p-2 cursor-pointer hover:bg-refly-tertiary-hover flex items-center justify-between gap-2 text-refly-text-0 rounded-lg',
        isActive && 'bg-refly-tertiary-hover',
        isFailed && 'bg-refly-Colorful-red-light',
      )}
      onClick={() => onSelect(node, beforeParsed)}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div
          className={cn('rounded-lg flex items-center justify-center flex-shrink-0', 'w-5 h-5')}
          style={iconContainerStyle}
        >
          <File size={14} color="white" />
        </div>
        <Text
          ellipsis={{ tooltip: { placement: 'left' } }}
          className={cn('block flex-1 min-w-0 truncate', {
            'font-semibold': isActive,
            'text-refly-text-2': isFailed || isRunning,
          })}
        >
          {node?.data?.title ?? t('common.untitled')}
        </Text>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {isRunning && <Spin size="small" />}
          {indexStatus && !isFinished && (
            <span className="text-xs text-refly-text-1">{t(`resource.${indexStatus}`)}</span>
          )}
        </div>
        {(isFailed || isReindexing) && (
          <Button
            type="text"
            size="small"
            className="!text-refly-primary-default font-semibold text-xs px-1"
            onClick={(e) => {
              e.stopPropagation();
              handleReindexResource();
            }}
          >
            {t('common.retry')}
          </Button>
        )}
      </div>
    </div>
  );
});

MyUploadItem.displayName = 'MyUploadItem';
