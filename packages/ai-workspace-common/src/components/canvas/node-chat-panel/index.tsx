import { memo, useCallback, useEffect, useRef } from 'react';
import { Button } from 'antd';

import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { RichChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/rich-chat-input';
import {
  ModelInfo,
  SkillRuntimeConfig,
  WorkflowVariable,
  GenericToolset,
} from '@refly/openapi-schema';
import type { MentionVariable } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/types';
import { ChatActions } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions';
import { IContextItem, ContextTarget } from '@refly/common-types';
import { useContextPanelStoreShallow } from '@refly/stores';
import { useTranslation } from 'react-i18next';
import { IoClose } from 'react-icons/io5';
import { useUserStoreShallow } from '@refly/stores';
import { useSubscriptionStoreShallow } from '@refly/stores';
import { useLaunchpadStoreShallow } from '@refly/stores';
import { subscriptionEnabled } from '@refly/ui-kit';
import { cn } from '@refly/utils/cn';
import classNames from 'classnames';
import { ProjectKnowledgeToggle } from '@refly-packages/ai-workspace-common/components/project/project-knowledge-toggle';
import { useUploadImage } from '@refly-packages/ai-workspace-common/hooks/use-upload-image';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

import './index.scss';
import { logEvent } from '@refly/telemetry-web';
import { ContextManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager';

// Memoized Premium Banner Component
export const PremiumBanner = memo(() => {
  const { t } = useTranslation();
  const { showPremiumBanner, setShowPremiumBanner } = useLaunchpadStoreShallow((state) => ({
    showPremiumBanner: state.showPremiumBanner,
    setShowPremiumBanner: state.setShowPremiumBanner,
  }));
  const setSubscribeModalVisible = useSubscriptionStoreShallow(
    (state) => state.setSubscribeModalVisible,
  );

  const handleUpgrade = useCallback(() => {
    logEvent('subscription::upgrade_click', 'home_banner');
    setSubscribeModalVisible(true);
  }, [setSubscribeModalVisible]);

  const handleClose = useCallback(() => {
    logEvent('subscription::home_banner_close');
    setShowPremiumBanner(false);
  }, [setShowPremiumBanner]);

  if (!showPremiumBanner) return null;

  return (
    <div className="flex items-center justify-between px-2 py-0.5 bg-gray-100 border-b dark:bg-gray-800">
      <div className="flex items-center justify-between gap-2 w-full">
        <span className="text-xs text-gray-600 dark:text-gray-300 flex-1 whitespace-nowrap">
          {t('copilot.premiumBanner.message')}
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            type="text"
            size="small"
            className="text-xs text-green-600 px-1"
            onClick={handleUpgrade}
          >
            {t('copilot.premiumBanner.upgrade')}
          </Button>
          <Button
            type="text"
            size="small"
            icon={<IoClose size={14} className="flex items-center justify-center" />}
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-500 flex items-center justify-center w-5 h-5 min-w-0 p-0"
          />
        </div>
      </div>
    </div>
  );
});

PremiumBanner.displayName = 'PremiumBanner';

export interface ChatPanelProps {
  readonly?: boolean;
  query: string;
  setQuery: (query: string) => void;
  contextItems: IContextItem[];
  setContextItems: (items: IContextItem[]) => void;
  modelInfo: ModelInfo | null;
  setModelInfo: (modelInfo: ModelInfo | null) => void;
  runtimeConfig: SkillRuntimeConfig;
  setRuntimeConfig: (config: SkillRuntimeConfig) => void;
  handleSendMessage: () => void;
  handleAbortAction: () => void;
  onInputHeightChange?: () => void;
  className?: string;
  mode?: 'node' | 'list';
  resultId?: string;
  projectId?: string;
  handleProjectChange?: (newProjectId: string) => void;
  workflowVariables?: WorkflowVariable[];
  extendedWorkflowVariables?: MentionVariable[]; // Extended variables for canvas nodes
  enableRichInput?: boolean;
  selectedToolsets?: GenericToolset[];
  onSelectedToolsetsChange?: (toolsets: GenericToolset[]) => void;
  loading?: boolean; // Add loading state for media generation
}

export const ChatPanel = memo(
  ({
    readonly = false,
    query,
    setQuery,
    contextItems = [],
    setContextItems,
    modelInfo,
    setModelInfo,
    runtimeConfig = {},
    setRuntimeConfig,
    handleSendMessage,
    handleAbortAction,
    onInputHeightChange,
    className = '',
    mode = 'node',
    resultId,
    loading = false,
    projectId,
    handleProjectChange,
    workflowVariables = [],
    extendedWorkflowVariables = [],
    enableRichInput = false,
    selectedToolsets,
    onSelectedToolsetsChange,
  }: ChatPanelProps) => {
    const chatInputRef = useRef<HTMLDivElement>(null);
    const userProfile = useUserStoreShallow((state) => state.userProfile);
    const isList = mode === 'list';
    const { handleUploadImage, handleUploadMultipleImages } = useUploadImage();
    const { canvasId, readonly: canvasReadonly } = useCanvasContext();
    const contextItemsRef = useRef(contextItems);
    const { t } = useTranslation();

    // Get setActiveResultId from context panel store
    const { setActiveResultId } = useContextPanelStoreShallow((state) => ({
      setActiveResultId: state.setActiveResultId,
    }));

    useEffect(() => {
      contextItemsRef.current = contextItems;
    }, [contextItems]);

    const handleImageUpload = useCallback(
      async (file: File) => {
        // Set as active when user interacts with this component
        if (resultId) {
          setActiveResultId(resultId);
        }

        const nodeData = await handleUploadImage(file, canvasId);
        if (nodeData) {
          setTimeout(() => {
            setContextItems([
              ...(contextItemsRef.current || []),
              {
                type: 'image',
                ...nodeData,
              },
            ]);
          }, 10);
        }
      },
      [contextItems, handleUploadImage, setContextItems, resultId, setActiveResultId],
    );

    const handleMultipleImagesUpload = useCallback(
      async (files: File[]) => {
        // Set as active when user interacts with this component
        if (resultId) {
          setActiveResultId(resultId);
        }

        if (handleUploadMultipleImages) {
          const nodesData = await handleUploadMultipleImages(files, canvasId);
          if (nodesData?.length) {
            setTimeout(() => {
              const newContextItems = nodesData.map((nodeData) => ({
                type: 'image' as const,
                ...nodeData,
              }));

              setContextItems([...contextItems, ...newContextItems]);
            }, 10);
          }
        } else {
          // Fallback to uploading one at a time if multiple uploader not provided
          const uploadPromises = files.map((file) => handleUploadImage(file, canvasId));
          const results = await Promise.all(uploadPromises);
          const validResults = results.filter(Boolean);

          if (validResults.length) {
            setTimeout(() => {
              const newContextItems = validResults.map((nodeData) => ({
                type: 'image' as const,
                ...nodeData,
              }));

              setContextItems([...contextItems, ...newContextItems]);
            }, 10);
          }
        }
      },
      [
        contextItems,
        handleUploadImage,
        handleUploadMultipleImages,
        setContextItems,
        resultId,
        setActiveResultId,
        canvasId,
      ],
    );

    // Handle input focus to set active resultId
    const handleInputFocus = useCallback(() => {
      if (resultId) {
        setActiveResultId(resultId);
      } else {
        setActiveResultId(ContextTarget.Global);
      }
    }, [resultId, setActiveResultId]);

    // Add useEffect for auto focus
    useEffect(() => {
      if (!readonly) {
        setTimeout(() => {
          if (chatInputRef.current) {
            const textArea = chatInputRef.current.querySelector('textarea');
            if (textArea) {
              textArea.focus();
              // Set active on initial focus
              handleInputFocus();
            }
          }
        }, 100);
      }
    }, [readonly, handleInputFocus]);

    // Handle send message with active resultId
    const handleMessageSend = useCallback(() => {
      // Set as active when sending a message
      if (resultId) {
        setActiveResultId(resultId);
      }
      handleSendMessage();
    }, [handleSendMessage, resultId, setActiveResultId]);

    const renderContent = () => (
      <>
        <ContextManager
          className={classNames({
            'py-2': isList,
          })}
          contextItems={contextItems}
          setContextItems={setContextItems}
        />

        {enableRichInput &&
        (workflowVariables?.length > 0 || extendedWorkflowVariables?.length > 0) ? (
          <RichChatInput
            readonly={canvasReadonly}
            ref={chatInputRef}
            query={query}
            setQuery={(value) => {
              setQuery(value);
              if (onInputHeightChange) {
                setTimeout(onInputHeightChange, 0);
              }
            }}
            variables={[...workflowVariables, ...extendedWorkflowVariables] as WorkflowVariable[]}
            inputClassName="px-1 py-0"
            maxRows={6}
            handleSendMessage={handleMessageSend}
            onUploadImage={handleImageUpload}
            onUploadMultipleImages={handleMultipleImagesUpload}
            onFocus={handleInputFocus}
            contextItems={contextItems}
            setContextItems={setContextItems}
          />
        ) : (
          <ChatInput
            readonly={canvasReadonly}
            ref={chatInputRef}
            query={query}
            setQuery={(value) => {
              setQuery(value);
              if (onInputHeightChange) {
                setTimeout(onInputHeightChange, 0);
              }
            }}
            inputClassName="px-1 py-0"
            maxRows={6}
            handleSendMessage={handleMessageSend}
            onUploadImage={handleImageUpload}
            onUploadMultipleImages={handleMultipleImagesUpload}
            onFocus={handleInputFocus}
            placeholder={t('canvas.launchpad.commonChatInputPlaceholder')}
          />
        )}

        <ChatActions
          className={classNames({
            'py-2': isList,
          })}
          query={query}
          model={modelInfo}
          setModel={setModelInfo}
          handleSendMessage={handleMessageSend}
          handleAbort={handleAbortAction}
          onUploadImage={handleImageUpload}
          contextItems={contextItems}
          runtimeConfig={runtimeConfig}
          setRuntimeConfig={setRuntimeConfig}
          selectedToolsets={selectedToolsets}
          setSelectedToolsets={onSelectedToolsetsChange}
          isExecuting={loading}
        />
      </>
    );

    if (isList) {
      return (
        <div className="relative w-full p-2" data-cy="launchpad-chat-panel">
          <div
            className={cn(
              'ai-copilot-chat-container chat-input-container rounded-[7px] overflow-hidden',
              'border border-gray-100 border-solid dark:border-gray-700',
            )}
          >
            {subscriptionEnabled && !userProfile?.subscription && <PremiumBanner />}
            <div className={cn('px-3')}>{renderContent()}</div>
          </div>
          <ProjectKnowledgeToggle
            className="!pb-0"
            currentProjectId={projectId}
            onProjectChange={handleProjectChange}
          />
        </div>
      );
    }

    return (
      <div className={`flex flex-col gap-3 h-full box-border ${className} max-w-[1024px]`}>
        {renderContent()}
      </div>
    );
  },
);

ChatPanel.displayName = 'ChatPanel';
