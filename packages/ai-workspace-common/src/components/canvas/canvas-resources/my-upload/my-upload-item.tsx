import { memo, useCallback, useState } from 'react';
import { Button, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { cn } from '@refly/utils/cn';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas/use-set-node-data-by-entity';
import { ResourceItemAction } from '../share/resource-item-action';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { Resource } from '@refly/openapi-schema';

const { Text } = Typography;

export interface MyUploadItemProps {
  resource: Resource;
  isActive: boolean;
  onSelect: (resource: Resource, beforeParsed: boolean) => void;
}

/**
 * Render a single uploaded resource item.
 */
export const MyUploadItem = memo(({ resource, isActive, onSelect }: MyUploadItemProps) => {
  const { t } = useTranslation();
  const { readonly } = useCanvasContext();
  const [isReindexing, setIsReindexing] = useState(false);
  const indexStatus = resource.indexStatus;
  const resourceType = resource.resourceType;
  const resourceMeta = resource.data;

  const isParseFailed = indexStatus === 'parse_failed';
  const isIndexFailed = indexStatus === 'index_failed';
  const isFailed = isParseFailed || isIndexFailed;
  const beforeParsed = ['init', 'wait_parse', 'parse_failed'].includes(indexStatus);
  const isRunning = ['wait_parse', 'wait_index'].includes(indexStatus) || isReindexing;
  const isFinished = ['finish'].includes(indexStatus);

  const setNodeDataByEntity = useSetNodeDataByEntity();

  const handleReindexResource = useCallback(async () => {
    const resourceId = resource.resourceId;

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

    const newIndexStatus = indexStatus === 'index_failed' ? 'wait_index' : 'wait_parse';

    setNodeDataByEntity(
      {
        type: 'resource',
        entityId: resourceId,
      },
      {
        metadata: {
          indexStatus: newIndexStatus,
        },
      },
    );
  }, [isReindexing, setNodeDataByEntity, resource.resourceId, indexStatus]);

  return (
    <div
      className={cn(
        'h-9 group p-2 cursor-pointer hover:bg-refly-tertiary-hover flex items-center justify-between gap-2 text-refly-text-0 rounded-lg',
        isActive && 'bg-refly-tertiary-hover',
        isFailed && 'bg-refly-Colorful-red-light',
      )}
      onClick={() => onSelect(resource, beforeParsed)}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <NodeIcon
          type="resource"
          resourceType={resourceType}
          resourceMeta={resourceMeta}
          filled={false}
          url={resourceMeta?.url}
          small
        />

        <Text
          ellipsis={{ tooltip: { placement: 'left' } }}
          className={cn('block flex-1 min-w-0 truncate', {
            'font-semibold': isActive,
            'text-refly-text-2': isFailed || isRunning,
          })}
        >
          {resource?.title ?? t('common.untitled')}
        </Text>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {isRunning && <Spin size="small" />}
          {indexStatus && !isFinished && (
            <span className="text-xs text-refly-text-1">{t(`resource.${indexStatus}`)}</span>
          )}
        </div>
        {(isFailed || isReindexing) && !readonly && (
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
        <ResourceItemAction
          node={{
            id: resource.resourceId,
            type: 'resource',
            position: { x: 0, y: 0 },
            data: {
              title: resource.title,
              entityId: resource.resourceId,
              metadata: {
                ...resource.data,
                storageKey: resource.rawFileKey,
                indexStatus: resource.indexStatus,
                resourceType: resource.resourceType,
              },
            },
          }}
        />
      </div>
    </div>
  );
});

MyUploadItem.displayName = 'MyUploadItem';
