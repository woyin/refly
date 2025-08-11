import { memo, useCallback, useMemo } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { CanvasNode } from '@refly/canvas-common';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';
import { MyUploadItem } from './my-upload-item';

export const MyUploadList = memo(() => {
  const { t } = useTranslation();
  const { nodes } = useRealtimeCanvasData();
  const { setParentType, setActiveNode, activeNode } = useCanvasResourcesPanelStoreShallow(
    (state) => ({
      setParentType: state.setParentType,
      setActiveNode: state.setActiveNode,
      activeNode: state.activeNode,
    }),
  );
  // Filter nodes by resource type
  const resourceNodes = useMemo(() => {
    if (!nodes?.length) {
      return [];
    }

    return nodes.filter((node) => node.type === 'resource');
  }, [nodes]);

  const handleNodeSelect = useCallback(
    (node: CanvasNode, beforeParsed: boolean) => {
      if (beforeParsed) {
        message.error(
          t('resource.wait_parse_tip', {
            defaultValue: 'The file has not been parsed yet, can not be viewed',
          }),
        );
        return;
      }
      setParentType('myUpload');
      setActiveNode(node);
    },
    [setParentType, setActiveNode],
  );

  if (!resourceNodes?.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-refly-text-2 text-sm leading-5">
        {t('canvas.resourceLibrary.noMyUploads', {
          defaultValue: 'No files uploaded yet',
        })}
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="h-full flex flex-col gap-2">
        {resourceNodes?.map((node: CanvasNode) => (
          <MyUploadItem
            key={node.id}
            node={node}
            isActive={activeNode?.id === node.id}
            onSelect={handleNodeSelect}
          />
        ))}
      </div>
    </div>
  );
});

MyUploadList.displayName = 'MyUploadList';
