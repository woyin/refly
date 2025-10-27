import { memo, useCallback, useState } from 'react';
import {
  useChatStoreShallow,
  useFrontPageStoreShallow,
  usePilotStoreShallow,
  useLaunchpadStoreShallow,
} from '@refly/stores';
import { message } from 'antd';
import { logEvent } from '@refly/telemetry-web';

import { useTranslation } from 'react-i18next';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { genActionResultID, processQueryWithMentions } from '@refly/utils';
import {
  CreatePilotSessionRequest,
  GenericToolset,
  ModelCapabilities,
} from '@refly/openapi-schema';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { ChatComposer } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-composer';
import type { IContextItem } from '@refly/common-types';
import { CanvasNodeFilter, convertContextItemsToNodeFilters } from '@refly/canvas-common';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';

/**
 * NoSession
 * UI shown when there is no active pilot session.
 * Layout and styling are referenced from `canvas/front-page/index.tsx`.
 */
export const NoSession = memo(
  ({
    canvasId,
    contextItems,
    setContextItems,
  }: {
    canvasId: string;
    contextItems: IContextItem[];
    setContextItems: (items: IContextItem[]) => void;
  }) => {
    const { t } = useTranslation();

    const [isExecuting, setIsExecuting] = useState<boolean>(false);

    const { selectedToolsets: selectedToolsetsFromStore } = useLaunchpadStoreShallow((state) => ({
      selectedToolsets: state.selectedToolsets,
    }));

    const [selectedToolsets, setSelectedToolsets] = useState<GenericToolset[]>(
      selectedToolsetsFromStore ?? [],
    );

    const { query, setQuery, clearCanvasQuery } = useFrontPageStoreShallow((state) => ({
      query: state.getQuery?.(canvasId) || '',
      setQuery: state.setQuery,
      clearCanvasQuery: state.clearCanvasQuery,
    }));
    const { chatMode, skillSelectedModel, setSkillSelectedModel } = useChatStoreShallow(
      (state) => ({
        chatMode: state.chatMode,
        skillSelectedModel: state.skillSelectedModel,
        setSkillSelectedModel: state.setSkillSelectedModel,
      }),
    );
    const { setActiveSessionId, setIsPilotOpen } = usePilotStoreShallow((state) => ({
      setActiveSessionId: state.setActiveSessionId,
      setIsPilotOpen: state.setIsPilotOpen,
    }));
    const { addNode } = useAddNode();
    const { invokeAction } = useInvokeAction({ source: 'nosession-ask' });

    // Create wrapper function for setting query with canvasId
    const setCanvasQuery = useCallback(
      (newQuery: string) => {
        setQuery?.(newQuery, canvasId);
      },
      [setQuery, canvasId],
    );

    const { data: workflowVariables } = useVariablesManagement(canvasId);

    const handleCreatePilotSession = useCallback(
      async (param: CreatePilotSessionRequest) => {
        setIsExecuting(true);
        const { data, error } = await getClient().createPilotSession({
          body: param,
        });
        if (error) {
          message.error(
            t('pilot.createPilotSessionFailed', {
              defaultValue: 'Failed to create pilot session',
            }),
          );
          setIsExecuting(false);
          return;
        }

        const sessionId = data?.data?.sessionId;
        if (sessionId) {
          setActiveSessionId(canvasId, sessionId);
          setIsPilotOpen(true);
        } else {
          message.error(
            t('pilot.createPilotSessionFailed', {
              defaultValue: 'Failed to create pilot session',
            }),
          );
        }
        setIsExecuting(false);
      },
      [t, setActiveSessionId, setIsPilotOpen, canvasId],
    );

    const handleSendMessage = useCallback(() => {
      if (!query?.trim()) return;

      logEvent('agent::send_message', Date.now(), {
        chatMode,
      });

      setIsExecuting(true);

      if (chatMode === 'ask' && canvasId) {
        const connectTo: CanvasNodeFilter[] = convertContextItemsToNodeFilters(contextItems);
        const isMediaGeneration = skillSelectedModel?.category === 'mediaGeneration';
        if (isMediaGeneration) {
          // Handle media generation using existing media generation flow
          // Parse capabilities from modelInfo
          const capabilities = skillSelectedModel?.capabilities as ModelCapabilities;
          const mediaType = capabilities?.image
            ? 'image'
            : capabilities?.video
              ? 'video'
              : capabilities?.audio
                ? 'audio'
                : 'image'; // Default fallback

          // Emit media generation event
          nodeOperationsEmitter.emit('generateMedia', {
            providerItemId: skillSelectedModel?.providerItemId ?? '',
            targetType: 'canvas',
            targetId: canvasId ?? '',
            mediaType,
            query,
            modelInfo: skillSelectedModel,
            nodeId: '',
            contextItems,
          });
          setTimeout(() => {
            clearCanvasQuery?.(canvasId);
            setIsExecuting(false);
          }, 300);

          return;
        }

        // Process query with workflow variables
        const variables = workflowVariables;
        const { processedQuery } = processQueryWithMentions(query, {
          replaceVars: true,
          variables,
        });

        const resultId = genActionResultID();
        invokeAction(
          {
            query: processedQuery,
            resultId,
            selectedToolsets,
            selectedSkill: undefined,
            modelInfo: skillSelectedModel,
            tplConfig: {},
            runtimeConfig: {},
            contextItems,
          },
          {
            entityId: canvasId,
            entityType: 'canvas',
          },
        );
        addNode(
          {
            type: 'skillResponse',
            data: {
              title: processedQuery,
              entityId: resultId,
              metadata: {
                status: 'executing',
                contextItems,
                selectedToolsets,
                selectedSkill: undefined,
                modelInfo: skillSelectedModel,
                runtimeConfig: {},
                tplConfig: {},
                structuredData: {
                  query,
                },
              },
            },
          },
          connectTo,
          true,
          true,
        );
        clearCanvasQuery?.(canvasId);
        setIsExecuting(false);
      } else if (chatMode === 'agent' && canvasId) {
        // Create pilot session for agent mode
        handleCreatePilotSession({
          targetId: canvasId,
          targetType: 'canvas',
          title: query,
          input: { query },
          maxEpoch: 3,
          providerItemId: skillSelectedModel?.providerItemId,
        });
      } else {
        setIsExecuting(false);
      }
    }, [
      query,
      chatMode,
      canvasId,
      addNode,
      invokeAction,
      skillSelectedModel,
      handleCreatePilotSession,
      selectedToolsets,
      contextItems,
      setIsExecuting,
      workflowVariables,
    ]);

    return (
      <div className="relative w-full h-full px-4 pb-4 z-10 rounded-2xl">
        <div className="w-full px-4 py-3 rounded-xl overflow-hidden border-[1px] border-solid border-refly-primary-default ">
          <ChatComposer
            query={query}
            setQuery={setCanvasQuery}
            handleSendMessage={handleSendMessage}
            handleAbort={() => {}}
            contextItems={contextItems}
            setContextItems={setContextItems}
            modelInfo={skillSelectedModel}
            setModelInfo={setSkillSelectedModel}
            enableRichInput={true}
            selectedToolsets={selectedToolsets}
            onSelectedToolsetsChange={setSelectedToolsets}
            isExecuting={isExecuting}
            enableChatModeSelector
            mentionPosition="top-start"
          />
        </div>
      </div>
    );
  },
);

NoSession.displayName = 'NoSession';
