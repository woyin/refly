import { memo, useMemo } from 'react';
import { List, Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import { Doc, Code, Image, Video, Audio } from 'refly-icons';
import { CanvasNode } from '@refly/canvas-common';
import { CanvasNodeType } from '@refly/openapi-schema';
import { cn } from '@refly/utils/cn';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';

// Define the node types we want to display
export const RESULT_NODE_TYPES: CanvasNodeType[] = [
  'document',
  'codeArtifact',
  'image',
  'video',
  'audio',
];

export const ResultList = memo(() => {
  const { t } = useTranslation();
  const { nodes } = useRealtimeCanvasData();
  const { setParentType, setActiveNode } = useCanvasResourcesPanelStoreShallow((state) => ({
    setParentType: state.setParentType,
    setActiveNode: state.setActiveNode,
  }));

  // Filter nodes by the specified types
  const resultNodes = useMemo(() => {
    if (!nodes?.length) {
      return [];
    }

    return nodes.filter((node) => RESULT_NODE_TYPES.includes(node.type as CanvasNodeType));
  }, [nodes]);

  // Get node icon based on type
  const getNodeIcon = (nodeType: string) => {
    switch (nodeType) {
      case 'document':
        return <Doc size={16} />;
      case 'codeArtifact':
        return <Code size={16} />;
      case 'image':
        return <Image size={16} />;
      case 'video':
        return <Video size={16} />;
      case 'audio':
        return <Audio size={16} />;
      default:
        return <Doc size={16} />;
    }
  };

  const handleNodeSelect = (node: CanvasNode) => {
    setParentType('resultsRecord');
    setActiveNode(node);
  };

  if (!resultNodes?.length) {
    return (
      <div className="h-full p-4 bg-white dark:bg-gray-800 rounded-lg text-center">
        <Empty
          description={t('canvas.noResults', { defaultValue: 'No results found' })}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg pt-4 shadow overflow-y-auto h-full">
      <List
        dataSource={resultNodes}
        renderItem={(node: CanvasNode) => (
          <List.Item
            className={cn(
              '!px-2 !py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700',
            )}
            onClick={() => handleNodeSelect(node)}
          >
            <List.Item.Meta
              avatar={
                <div className="flex items-center justify-center w-8 h-8 text-lg">
                  {getNodeIcon(node.type)}
                </div>
              }
              title={
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-sm font-medium text-gray-900 dark:text-gray-100">
                    {node.data?.title || t('canvas.untitled', { defaultValue: 'Untitled' })}
                  </span>
                </div>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );
});

ResultList.displayName = 'ResultList';
