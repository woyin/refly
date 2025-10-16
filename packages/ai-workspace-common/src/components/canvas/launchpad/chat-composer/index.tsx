import { forwardRef, memo, useMemo, useCallback, useRef, useImperativeHandle } from 'react';
import type { IContextItem } from '@refly/common-types';
import type { GenericToolset, ModelInfo, SkillRuntimeConfig } from '@refly/openapi-schema';
import { ContextManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import {
  RichChatInput,
  type RichChatInputRef,
} from '@refly-packages/ai-workspace-common/components/canvas/launchpad/rich-chat-input';
import {
  ChatActions,
  CustomAction,
} from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions';
import { useUploadImage } from '@refly-packages/ai-workspace-common/hooks/use-upload-image';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useChatStoreShallow } from '@refly/stores';
import { useTranslation } from 'react-i18next';

export interface ChatComposerProps {
  query: string;
  setQuery: (text: string) => void;
  handleSendMessage: () => void;
  handleAbort?: () => void;

  // Context items
  contextItems: IContextItem[];
  setContextItems: (
    items: IContextItem[] | ((prevItems: IContextItem[]) => IContextItem[]),
  ) => void;

  // Model and runtime config
  modelInfo: ModelInfo | null;
  setModelInfo: (model: ModelInfo | null) => void;
  runtimeConfig?: SkillRuntimeConfig;
  setRuntimeConfig?: (config: SkillRuntimeConfig) => void;

  // Optional UI behaviors
  placeholder?: string;
  inputClassName?: string;
  maxRows?: number;
  onFocus?: () => void;
  className?: string;
  contextClassName?: string;
  actionsClassName?: string;

  mentionPosition?: 'top-start' | 'bottom-start';

  // Rich input
  enableRichInput?: boolean;

  // Toolsets
  selectedToolsets?: GenericToolset[];
  onSelectedToolsetsChange?: (toolsets: GenericToolset[]) => void;

  // Execution state
  isExecuting?: boolean;

  enableChatModeSelector?: boolean;

  // Custom actions
  customActions?: CustomAction[];
}

export interface ChatComposerRef {
  focus: () => void;
}

/**
 * ChatComposer composes ContextManager, ChatInput/RichChatInput and ChatActions.
 * Parent should provide upload handlers and business callbacks.
 */
const ChatComposerComponent = forwardRef<ChatComposerRef, ChatComposerProps>((props, ref) => {
  const {
    query,
    setQuery,
    handleSendMessage,
    handleAbort,
    contextItems,
    setContextItems,
    modelInfo,
    setModelInfo,
    runtimeConfig,
    setRuntimeConfig,
    placeholder,
    inputClassName = 'px-1 py-0',
    maxRows = 6,
    onFocus,
    className = '',
    contextClassName = '',
    actionsClassName = '',
    enableRichInput = false,
    mentionPosition = 'bottom-start',
    selectedToolsets,
    onSelectedToolsetsChange,
    isExecuting = false,
    enableChatModeSelector = false,
    customActions,
  } = props;

  const { handleUploadImage, handleUploadMultipleImages } = useUploadImage();
  const { canvasId, readonly } = useCanvasContext();
  const { t } = useTranslation();

  // Ref for the input component
  const inputRef = useRef<RichChatInputRef>(null);

  // Expose focus method through ref
  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        inputRef.current?.focus();
      },
    }),
    [],
  );

  const { chatMode } = useChatStoreShallow((state) => ({
    chatMode: state.chatMode,
  }));

  const defaultPlaceholder = useMemo(() => {
    if (placeholder) {
      return placeholder;
    }
    if (chatMode === 'agent' && enableChatModeSelector) {
      return t('canvas.launchpad.chatInputPlaceholder');
    } else {
      return t('canvas.launchpad.commonChatInputPlaceholder');
    }
  }, [chatMode, placeholder, t, enableChatModeSelector]);

  const handleImageUpload = useCallback(
    async (file: File) => {
      const resource = await handleUploadImage(file, canvasId);
      if (resource) {
        setTimeout(() => {
          // Use functional update to avoid state race conditions
          setContextItems((prevContextItems) => [
            ...(prevContextItems || []),
            {
              type: 'resource',
              entityId: resource.resourceId,
              title: resource.title,
              metadata: {
                resourceType: resource.resourceType,
                resourceMeta: resource.data,
                storageKey: resource.storageKey,
                rawFileKey: resource.rawFileKey,
                downloadURL: resource.downloadURL,
              },
            },
          ]);
        }, 10);
      }
    },
    [handleUploadImage, setContextItems, canvasId],
  );

  const handleMultipleImagesUpload = useCallback(
    async (files: File[]) => {
      const resources = await handleUploadMultipleImages(files, canvasId);
      if (resources?.length) {
        setTimeout(() => {
          const newContextItems: IContextItem[] = resources.map((resource) => ({
            type: 'resource' as const,
            entityId: resource.resourceId,
            title: resource.title,
            metadata: {
              resourceType: resource.resourceType,
              resourceMeta: resource.data,
              storageKey: resource.storageKey,
              rawFileKey: resource.rawFileKey,
              downloadURL: resource.downloadURL,
            },
          }));

          // Use functional update to avoid state race conditions
          setContextItems((prevContextItems) => [...(prevContextItems || []), ...newContextItems]);
        }, 10);
      }
    },
    [handleUploadMultipleImages, setContextItems, canvasId],
  );

  return (
    <div className={`flex flex-col gap-3 h-full box-border ${className}`}>
      <ContextManager
        className={contextClassName}
        contextItems={contextItems}
        setContextItems={setContextItems}
      />

      {enableRichInput ? (
        <RichChatInput
          readonly={readonly}
          ref={inputRef}
          query={query}
          setQuery={(value) => {
            setQuery(value);
          }}
          inputClassName={inputClassName}
          maxRows={maxRows}
          handleSendMessage={handleSendMessage}
          onUploadImage={handleImageUpload as (file: File) => Promise<void>}
          onUploadMultipleImages={handleMultipleImagesUpload as (files: File[]) => Promise<void>}
          onFocus={onFocus}
          contextItems={contextItems}
          setContextItems={setContextItems}
          placeholder={defaultPlaceholder}
          mentionPosition={mentionPosition}
          selectedToolsets={selectedToolsets}
          setSelectedToolsets={onSelectedToolsetsChange}
        />
      ) : (
        <ChatInput
          readonly={readonly}
          ref={ref as any}
          query={query}
          setQuery={(value) => {
            setQuery(value);
          }}
          inputClassName={inputClassName}
          maxRows={maxRows}
          handleSendMessage={handleSendMessage}
          onUploadImage={handleImageUpload as (file: File) => Promise<void>}
          onUploadMultipleImages={handleMultipleImagesUpload as (files: File[]) => Promise<void>}
          onFocus={onFocus}
          placeholder={defaultPlaceholder}
        />
      )}

      <ChatActions
        className={actionsClassName}
        query={query}
        model={modelInfo}
        setModel={setModelInfo}
        handleSendMessage={handleSendMessage}
        handleAbort={handleAbort ?? (() => {})}
        onUploadImage={handleImageUpload as (file: File) => Promise<void>}
        contextItems={contextItems}
        runtimeConfig={runtimeConfig}
        setRuntimeConfig={setRuntimeConfig}
        selectedToolsets={selectedToolsets}
        setSelectedToolsets={onSelectedToolsetsChange}
        isExecuting={isExecuting}
        enableChatModeSelector={enableChatModeSelector}
        customActions={customActions}
      />
    </div>
  );
});

ChatComposerComponent.displayName = 'ChatComposerComponent';

export const ChatComposer = memo(ChatComposerComponent);
