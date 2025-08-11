import { memo, useMemo, useCallback } from 'react';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { CanvasNode } from '@refly/canvas-common';
import { CanvasNodeType } from '@refly/openapi-schema';
import { cn } from '@refly/utils/cn';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { ResourceItemAction } from '@refly-packages/ai-workspace-common/components/canvas/canvas-resources/resource-item-action';

// Define the node types we want to display
export const RESULT_NODE_TYPES: CanvasNodeType[] = [
  'document',
  'codeArtifact',
  'image',
  'video',
  'audio',
];

const { Text } = Typography;

export const ResultList = memo(() => {
  const { t } = useTranslation();
  const { nodes } = useRealtimeCanvasData();
  const { setParentType, setActiveNode, activeNode } = useCanvasResourcesPanelStoreShallow(
    (state) => ({
      setParentType: state.setParentType,
      setActiveNode: state.setActiveNode,
      activeNode: state.activeNode,
    }),
  );

  // Filter nodes by the specified types
  const resultNodes = useMemo(() => {
    if (!nodes?.length) {
      return [];
    }

    return nodes.filter((node) => RESULT_NODE_TYPES.includes(node.type as CanvasNodeType));
  }, [nodes]);

  const handleNodeSelect = useCallback(
    (node: CanvasNode) => {
      setParentType('resultsRecord');
      setActiveNode(node);
    },
    [setParentType, setActiveNode],
  );

  if (!resultNodes?.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-refly-text-2 text-sm leading-5">
        {t('canvas.resourceLibrary.noResultsRecord', {
          defaultValue: 'No results recorded yet',
        })}
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="h-full flex flex-col gap-2">
        {resultNodes?.map((node: CanvasNode) => (
          <div
            key={node.id}
            className={cn(
              'group p-2 cursor-pointer hover:bg-refly-tertiary-hover flex items-center justify-between gap-2 text-refly-text-0 rounded-lg',
              activeNode?.id === node.id && 'bg-refly-tertiary-hover',
            )}
            onClick={() => handleNodeSelect(node)}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <NodeIcon type={node.type as CanvasNodeType} small />
              <Text
                ellipsis={{ tooltip: { placement: 'left' } }}
                className={cn('block flex-1 min-w-0 truncate', {
                  'font-semibold': activeNode?.id === node.id,
                })}
              >
                {node.data?.title || t('common.untitled')}
              </Text>
            </div>
            <ResourceItemAction node={node} />
          </div>
        ))}
      </div>
    </div>
  );
});

ResultList.displayName = 'ResultList';
