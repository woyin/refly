import { memo, useMemo } from 'react';
import { List, Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import { File } from 'refly-icons';
import { CanvasNode } from '@refly/canvas-common';
import { cn } from '@refly/utils/cn';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';

export const MyUploadList = memo(() => {
  const { t } = useTranslation();
  const { nodes } = useRealtimeCanvasData();
  const { setParentType, setActiveNode } = useCanvasResourcesPanelStoreShallow((state) => ({
    setParentType: state.setParentType,
    setActiveNode: state.setActiveNode,
  }));

  // Filter nodes by resource type
  const resourceNodes = useMemo(() => {
    if (!nodes?.length) {
      return [];
    }

    return nodes.filter((node) => node.type === 'resource');
  }, [nodes]);

  const handleNodeSelect = (node: CanvasNode) => {
    setParentType('myUpload');
    console.log('node', node?.data?.title);
    setActiveNode(node);
  };

  if (!resourceNodes?.length) {
    return (
      <div className="h-full p-4 bg-white dark:bg-gray-800 rounded-lg text-center">
        <Empty
          description={t('canvas.noUploads', { defaultValue: 'No uploads found' })}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg pt-4 shadow overflow-y-auto h-full">
      <List
        dataSource={resourceNodes}
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
                  <File size={16} />
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

MyUploadList.displayName = 'MyUploadList';
