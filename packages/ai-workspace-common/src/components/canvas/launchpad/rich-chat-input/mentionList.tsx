import { useTranslation } from 'react-i18next';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { CanvasNodeType, ResourceMeta, ResourceType } from '@refly/openapi-schema';
import { ArrowRight, X } from 'refly-icons';
import { Segmented } from 'antd';
import { useGetWorkflowVariables } from '@refly-packages/ai-workspace-common/queries';
import { getStartNodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/variable/getVariableIcon';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { cn } from '@refly/utils/cn';

export interface MentionItem {
  name: string;
  description: string;
  source: 'startNode' | 'resourceLibrary' | 'stepRecord' | 'resultRecord' | 'myUpload';
  variableType: string;
  entityId: string;
  nodeId: string;
  metadata?: {
    imageUrl?: string | undefined;
    resourceType?: ResourceType;
    resourceMeta?: ResourceMeta;
  };
}

export const MentionList = ({
  items,
  command,
  placement = 'bottom',
}: {
  items: MentionItem[];
  command: any;
  placement?: 'top' | 'bottom';
}) => {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>('startNode');
  const [resourceLibraryType, setResourceLibraryType] = useState<
    'uploads' | 'stepRecord' | 'resultRecord'
  >('resultRecord');
  const { nodes } = useCanvasData();
  const { canvasId } = useCanvasContext();
  console.log('placement', placement);

  // Dynamic alignment based on placement
  const mentionVirtalAlign = placement === 'top' ? 'items-end' : 'items-start';
  const secondLevelBorderRadius = placement === 'top' ? 'rounded-t-xl' : 'rounded-b-xl';

  const firstLevels = useMemo(
    () => [
      {
        key: 'startNode',
        name: t('canvas.richChatInput.startNode'),
        source: 'startNode' as const,
        onMouseEnter: () => setHoveredCategory('startNode'),
      },
      {
        key: 'resourceLibrary',
        name: t('canvas.richChatInput.resourceLibrary'),
        source: 'resourceLibrary' as const,
        onMouseEnter: () => {
          setHoveredCategory('resourceLibrary');
          // Reset to uploads when hovering resource library
          setResourceLibraryType('uploads');
        },
      },
    ],
    [t],
  );

  // Fetch workflow variables on demand when hovering startNode
  const {
    data: workflowVariablesData,
    refetch: refetchWorkflowVariables,
    isLoading: isLoadingVariables,
  } = useGetWorkflowVariables({ query: { canvasId } }, undefined, {
    enabled: !!canvasId, // Always enable when canvasId is available
  });

  // Trigger variable fetch when hovering startNode
  useEffect(() => {
    if (hoveredCategory === 'startNode' && canvasId) {
      refetchWorkflowVariables();
    }
  }, [hoveredCategory, canvasId, refetchWorkflowVariables]);

  // Group items by source and create canvas-based items
  const groupedItems = useMemo(() => {
    // Use fetched workflow variables for startNode items instead of prop items
    const workflowVariables = workflowVariablesData?.data || [];
    const startNodeItems = workflowVariables.map((variable) => ({
      name: variable.name,
      description: variable.description || '',
      source: 'startNode' as const,
      variableType: variable.variableType || 'string',
      entityId: variable.variableId || '',
      nodeId: variable.variableId || '',
    }));

    const resourceLibraryItems = items.filter((item) => item.source === 'resourceLibrary');
    const myUploadItems = items.filter((item) => item.source === 'myUpload');

    // Get skillResponse nodes for step records
    const stepRecordItems =
      nodes
        ?.filter((node) => node.type === 'skillResponse')
        ?.map((node) => ({
          name: node.data?.title ?? t('canvas.richChatInput.untitledStep'),
          description: t('canvas.richChatInput.stepRecord'),
          source: 'stepRecord' as const,
          variableType: node.type, // Use actual node type
          entityId: node.data?.entityId,
          nodeId: node.id,
        })) ?? [];

    // Get result record nodes - same logic as ResultList component
    const resultRecordItems =
      nodes
        ?.filter(
          (node) =>
            ['document', 'codeArtifact', 'website', 'video', 'audio'].includes(node.type) ||
            (node.type === 'image' && !!node.data?.metadata?.resultId),
        )
        ?.map((node) => ({
          name: node.data?.title ?? t('canvas.richChatInput.untitledResult'),
          description: t('canvas.richChatInput.resultRecord'),
          source: 'resultRecord' as const,
          variableType: node.type, // Use actual node type
          entityId: node.data?.entityId,
          nodeId: node.id,
          metadata: {
            imageUrl: node.data?.metadata?.imageUrl,
            resourceType: node.data?.metadata?.resourceType as ResourceType | undefined,
            resourceMeta: node.data?.metadata?.resourceMeta as ResourceMeta | undefined,
          },
        })) ?? [];

    return {
      startNode: startNodeItems,
      resourceLibrary: resourceLibraryItems,
      stepRecord: stepRecordItems,
      resultRecord: resultRecordItems,
      uploads: myUploadItems,
    };
  }, [workflowVariablesData, items, nodes, t]);

  // Configuration for different resource library types
  const resourceTypeConfigs = useMemo(
    () => ({
      uploads: {
        nodeIconProps: (item: MentionItem) => ({
          type: item.variableType as CanvasNodeType,
          small: true,
          url: item.variableType === 'image' ? item.metadata?.imageUrl : undefined,
          resourceType: item.metadata?.resourceType,
          resourceMeta: item.metadata?.resourceMeta,
        }),
        emptyStateKey: 'noUploadFiles',
      },
      stepRecord: {
        nodeIconProps: () => ({
          type: 'skillResponse' as CanvasNodeType,
          small: true,
        }),
        emptyStateKey: 'noStepRecords',
      },
      resultRecord: {
        nodeIconProps: (item: MentionItem) => ({
          type: item.variableType as CanvasNodeType,
          small: true,
          url: item.variableType === 'image' ? item.metadata?.imageUrl : undefined,
          resourceType: item.metadata?.resourceType,
          resourceMeta: item.metadata?.resourceMeta,
        }),
        emptyStateKey: 'noResultRecords',
      },
    }),
    [],
  );

  // Generic function to render a single resource item
  const renderResourceItem = (item: MentionItem, config: any) => (
    <div
      key={item.name}
      className="p-1.5 flex items-center gap-2 cursor-pointer hover:bg-refly-fill-hover transition-colors rounded-md"
      onClick={() => selectItem(item)}
    >
      <NodeIcon {...config.nodeIconProps(item)} />
      <div className="flex-1 text-sm text-refly-text-0 leading-5 truncate">{item.name}</div>
    </div>
  );

  // Generic function to render empty state
  const renderEmptyState = (emptyStateKey: string) => (
    <div className="px-4 py-8 text-center text-refly-text-2 text-sm">
      {t(`canvas.richChatInput.${emptyStateKey}`)}
    </div>
  );

  const selectItem = (item: MentionItem) => {
    command(item);
  };

  const upHandler = () => {
    const totalItems = items.length;
    setSelectedIndex((selectedIndex + totalItems - 1) % totalItems);
  };

  const downHandler = () => {
    const totalItems = items.length;
    setSelectedIndex((selectedIndex + 1) % totalItems);
  };

  const enterHandler = () => {
    const item = items[selectedIndex];
    if (item) {
      selectItem(item);
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }

      return false;
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedIndex, items]);

  if (items.length === 0) {
    return null;
  }
  return (
    <div className={cn('relative flex w-106 items-end', mentionVirtalAlign)}>
      {/* First level menu - Categories */}
      <div className="flex flex-col gap-1 w-40 p-2 rounded-l-xl bg-refly-bg-body-z0 border-r-0 border-[1px] border-solid border-refly-Card-Border">
        {firstLevels.map((item) => (
          <div
            key={item.name}
            className={cn(
              'p-1.5 cursor-pointer transition-colors hover:bg-refly-fill-hover rounded-md flex items-center gap-2',
              hoveredCategory === item.key && 'bg-refly-fill-hover',
            )}
            onMouseEnter={item.onMouseEnter}
          >
            <div className="flex-1 text-sm text-refly-text-0 truncate">{item.name}</div>
            <ArrowRight size={12} color="var(--refly-text-1)" />
          </div>
        ))}
      </div>

      {/* Second level menu - Variables */}
      <div
        className={cn(
          'w-60 p-2 max-h-60 min-h-28 box-border overflow-y-auto bg-refly-bg-body-z0 rounded-r-xl border-[1px] border-solid border-refly-Card-Border',
          secondLevelBorderRadius,
        )}
      >
        {hoveredCategory === 'startNode' && (
          <div className="w-full h-full">
            {isLoadingVariables ? (
              <div className="px-4 py-8 text-center text-refly-text-2 text-sm">
                {t('canvas.richChatInput.loadingVariables')}
              </div>
            ) : groupedItems.startNode?.length > 0 ? (
              <div className="flex flex-col gap-1">
                {groupedItems.startNode.map((item) => (
                  <div
                    key={item.name}
                    className="p-1.5 cursor-pointer hover:bg-refly-fill-hover transition-colors rounded-md flex items-center gap-2 justify-between"
                    onClick={() => selectItem(item)}
                  >
                    <X size={12} className="flex-shrink-0" color="var(--refly-primary-default)" />
                    <div className="flex-1 min-w-0 text-refly-text-0 truncate text-sm leading-5">
                      {item.name}
                    </div>
                    <div className="flex">{getStartNodeIcon(item.variableType)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-refly-text-2 text-sm">
                {t('canvas.richChatInput.noStartNodeVariables')}
              </div>
            )}
          </div>
        )}

        {hoveredCategory === 'resourceLibrary' && (
          <div className="h-full w-full flex flex-col gap-3">
            <Segmented
              shape="round"
              size="small"
              value={resourceLibraryType}
              className="w-full [&_.ant-segmented-item]:flex-1 [&_.ant-segmented-item]:text-center"
              onChange={(value) =>
                setResourceLibraryType(value as 'uploads' | 'stepRecord' | 'resultRecord')
              }
              options={[
                {
                  label: t('canvas.richChatInput.stepRecord'),
                  value: 'stepRecord',
                },
                {
                  label: t('canvas.richChatInput.resultRecord'),
                  value: 'resultRecord',
                },
                {
                  label: t('canvas.richChatInput.myUploads'),
                  value: 'uploads',
                },
              ]}
            />
            <div className="flex-1 space-y-1 overflow-y-auto">
              {(() => {
                const config = resourceTypeConfigs[resourceLibraryType];
                const items = groupedItems[resourceLibraryType];

                if (items?.length > 0) {
                  return items.map((item) => renderResourceItem(item, config));
                } else {
                  return renderEmptyState(config.emptyStateKey);
                }
              })()}
            </div>
          </div>
        )}

        {/* Show default view when no category is hovered */}
        {!hoveredCategory && (
          <div className="p-8 text-center text-refly-text-2 text-sm">
            {t('canvas.richChatInput.hoverToViewVariables')}
          </div>
        )}
      </div>
    </div>
  );
};
