import { useTranslation } from 'react-i18next';
import { IContextItem } from '@refly/common-types';
import { useMemo, memo, useState, useCallback, useEffect, useRef } from 'react';
import { ChatComposer } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-composer';
import { CustomAction } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions';
import {
  ModelInfo,
  SkillRuntimeConfig,
} from '@refly-packages/ai-workspace-common/requests/types.gen';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { convertContextItemsToEdges } from '@refly/canvas-common';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useReactFlow } from '@xyflow/react';

import { useAskProject } from '@refly-packages/ai-workspace-common/hooks/canvas/use-ask-project';
import { useUpdateNodeQuery } from '@refly-packages/ai-workspace-common/hooks/use-update-node-query';
import { useActionResultStoreShallow, useActiveNode } from '@refly/stores';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { Undo } from 'refly-icons';
import { GenericToolset } from '@refly/openapi-schema';
import { useSetNodeDataByEntity } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useGetWorkflowVariables } from '@refly-packages/ai-workspace-common/queries';
import type { MentionVariable } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/types';
import { processQueryWithVariables } from '@refly-packages/ai-workspace-common/utils/workflow-variable-processor';

interface EditChatInputProps {
  enabled: boolean;
  resultId: string;
  version?: number;
  contextItems: IContextItem[];
  query: string;
  modelInfo: ModelInfo;
  actionMeta?: {
    icon?: any;
    name?: string;
  };
  setEditMode: (mode: boolean) => void;
  readonly?: boolean;
  runtimeConfig?: SkillRuntimeConfig;
  onQueryChange?: (newQuery: string) => void;
  selectedToolsets?: GenericToolset[];
  setSelectedToolsets?: (toolsets: GenericToolset[]) => void;
}

const EditChatInputComponent = (props: EditChatInputProps) => {
  const {
    enabled,
    resultId,
    version,
    contextItems,
    query,
    modelInfo,
    setEditMode,
    runtimeConfig,
    onQueryChange,
    selectedToolsets,
    setSelectedToolsets,
  } = props;

  const { getEdges, getNodes, deleteElements, addEdges } = useReactFlow();
  const [editQuery, setEditQueryState] = useState<string>(query);

  useEffect(() => {
    setEditQueryState(query ?? '');
  }, [query]);

  const setEditQuery = useCallback(
    (newQuery: string) => {
      setEditQueryState(newQuery);
      onQueryChange?.(newQuery);
    },
    [onQueryChange],
  );
  const [editContextItems, setEditContextItems] = useState<IContextItem[]>(contextItems);
  const [editModelInfo, setEditModelInfo] = useState<ModelInfo>(modelInfo);
  const [editRuntimeConfig, setEditRuntimeConfig] = useState<SkillRuntimeConfig>(runtimeConfig);
  const contextItemsRef = useRef(editContextItems);
  const setNodeDataByEntity = useSetNodeDataByEntity();

  const { t } = useTranslation();

  const { getFinalProjectId } = useAskProject();
  const updateNodeQuery = useUpdateNodeQuery();

  // Get action result from store to access original input.query
  const { resultMap } = useActionResultStoreShallow((state) => ({
    resultMap: state.resultMap,
  }));
  const { addNode } = useAddNode();

  // Function to get original query from action result
  const getOriginalQuery = useCallback(async (): Promise<string> => {
    // First try to get from store
    const actionResult = resultMap[resultId];
    if (actionResult?.input?.query) {
      return actionResult.input.query;
    }

    // Fallback to API call if not in store
    try {
      const { data, error } = await getClient().getActionResult({
        query: { resultId },
      });

      if (!error && data?.success && data?.data?.input?.query) {
        return data.data.input.query;
      }
    } catch (error) {
      console.error('Failed to fetch action result:', error);
    }

    // Final fallback to current query prop
    return query;
  }, [resultMap, resultId, query]);

  const { canvasId } = useCanvasContext();
  const { invokeAction } = useInvokeAction({ source: 'edit-chat-input' });

  const { activeNode, setActiveNode } = useActiveNode(canvasId);

  const textareaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (enabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [enabled, textareaRef.current]);

  useEffect(() => {
    contextItemsRef.current = editContextItems;
  }, [editContextItems]);

  // Real-time query update to canvas and parent component
  useEffect(() => {
    // Find current node to get nodeId
    const nodes = getNodes();
    const currentNode = nodes.find((node) => node.data?.entityId === resultId);

    // Update the query in real-time to MinIO
    currentNode && updateNodeQuery(editQuery, resultId, currentNode.id, 'skillResponse');
  }, [resultId, editQuery, getNodes, updateNodeQuery]);

  useEffect(() => {
    setEditContextItems(contextItems);
  }, [contextItems]);

  useEffect(() => {
    setEditModelInfo(modelInfo);
  }, [modelInfo]);

  useEffect(() => {
    setEditRuntimeConfig(runtimeConfig);
  }, [runtimeConfig]);

  const handleSendMessage = useCallback(() => {
    const finalProjectId = getFinalProjectId();

    // Synchronize edges with latest context items
    const nodes = getNodes();
    let currentNode = nodes.find((node) => node.data?.entityId === resultId);

    // Check if this is a media generation model
    const isMediaGeneration = editModelInfo?.category === 'mediaGeneration';

    // If not found by entityId and is media generation, try to find by metadata.resultId
    if (!currentNode && isMediaGeneration) {
      currentNode = nodes.find((node) => (node.data?.metadata as any)?.resultId === resultId);
    }

    if (!currentNode) {
      return;
    }

    if (isMediaGeneration) {
      // Handle media generation using existing media generation flow
      // Parse capabilities from modelInfo
      const capabilities = editModelInfo?.capabilities as any;
      const mediaType = capabilities?.image
        ? 'image'
        : capabilities?.video
          ? 'video'
          : capabilities?.audio
            ? 'audio'
            : 'image'; // Default fallback

      // Emit media generation event
      nodeOperationsEmitter.emit('generateMedia', {
        providerItemId: editModelInfo?.providerItemId ?? '',
        targetType: 'canvas',
        targetId: canvasId ?? '',
        mediaType,
        query: editQuery,
        modelInfo: editModelInfo,
        nodeId: currentNode.id,
        contextItems: editContextItems,
      });

      setEditMode(false);
      return;
    }

    const edges = getEdges();
    const { edgesToAdd, edgesToDelete } = convertContextItemsToEdges(
      resultId,
      editContextItems,
      nodes,
      edges,
    );
    addEdges(edgesToAdd);
    deleteElements({ edges: edgesToDelete });

    // Process query with workflow variables
    const variables = (workflowVariables?.data ?? []) as MentionVariable[];
    const { query: processedQuery } = processQueryWithVariables(editQuery, variables);

    invokeAction(
      {
        resultId,
        version: (version ?? 0) + 1,
        query: processedQuery, // Use processed query for skill execution
        contextItems: editContextItems,
        modelInfo: editModelInfo,
        projectId: finalProjectId,
        selectedToolsets,
      },
      {
        entityId: canvasId,
        entityType: 'canvas',
      },
    );

    // Update node data with processed query for title and original query in structuredData
    setNodeDataByEntity(
      { entityId: resultId, type: 'skillResponse' },
      {
        title: processedQuery, // Use processed query for title
        metadata: {
          selectedToolsets,
          structuredData: {
            query: editQuery, // Store original query in structuredData
          },
          contextItems: editContextItems,
        },
      },
    );

    if (activeNode?.id === currentNode.id) {
      setActiveNode({
        ...activeNode,
        data: {
          ...activeNode.data,
          metadata: {
            ...activeNode.data?.metadata,
            selectedToolsets,
            structuredData: {
              query: editQuery,
            },
            contextItems: editContextItems,
          },
        },
      });
    }

    setEditMode(false);
  }, [
    resultId,
    editQuery,
    editModelInfo,
    editContextItems,
    version,
    canvasId,
    getNodes,
    getEdges,
    addEdges,
    deleteElements,
    invokeAction,
    setEditMode,
    getFinalProjectId,
    selectedToolsets,
    setNodeDataByEntity,
    addNode,
    editContextItems,
    activeNode,
    setActiveNode,
  ]);

  const customActions: CustomAction[] = useMemo(
    () => [
      {
        icon: <Undo className="flex items-center w-5 h-5" />,
        title: t('copilot.chatActions.discard'),
        onClick: async () => {
          setEditMode(false);

          // Get original query from action result
          const originalQuery = await getOriginalQuery();
          setEditQuery(originalQuery);

          setEditContextItems(contextItems);
          setEditModelInfo(modelInfo);
          setEditRuntimeConfig(runtimeConfig);
        },
      },
    ],
    [t, setEditMode, contextItems, modelInfo, runtimeConfig, getOriginalQuery],
  );

  // Fetch workflow variables for mentions (startNode/resourceLibrary)
  const { data: workflowVariables } = useGetWorkflowVariables({
    query: {
      canvasId,
    },
  });

  if (!enabled) {
    return null;
  }

  return (
    <div
      className="px-4 py-3 border-[1px] border-solid border-refly-primary-default rounded-[16px]"
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <ChatComposer
        ref={textareaRef}
        query={editQuery}
        setQuery={setEditQuery}
        handleSendMessage={handleSendMessage}
        contextItems={editContextItems}
        setContextItems={setEditContextItems}
        modelInfo={editModelInfo}
        setModelInfo={setEditModelInfo}
        runtimeConfig={editRuntimeConfig}
        setRuntimeConfig={setEditRuntimeConfig}
        selectedToolsets={selectedToolsets}
        onSelectedToolsetsChange={setSelectedToolsets}
        enableRichInput={true}
        customActions={customActions}
      />
    </div>
  );
};

const arePropsEqual = (prevProps: EditChatInputProps, nextProps: EditChatInputProps) => {
  return (
    prevProps.enabled === nextProps.enabled &&
    prevProps.resultId === nextProps.resultId &&
    prevProps.query === nextProps.query &&
    prevProps.modelInfo === nextProps.modelInfo &&
    prevProps.readonly === nextProps.readonly &&
    prevProps.contextItems === nextProps.contextItems &&
    prevProps.actionMeta?.name === nextProps.actionMeta?.name &&
    prevProps.onQueryChange === nextProps.onQueryChange &&
    prevProps.selectedToolsets === nextProps.selectedToolsets &&
    prevProps.setSelectedToolsets === nextProps.setSelectedToolsets
  );
};

export const EditChatInput = memo(EditChatInputComponent, arePropsEqual);
