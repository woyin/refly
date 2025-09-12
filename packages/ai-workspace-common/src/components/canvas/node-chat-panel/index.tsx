import { memo, useEffect, useRef } from 'react';

import { ChatComposer } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-composer';
import { ModelInfo, SkillRuntimeConfig, GenericToolset } from '@refly/openapi-schema';
import { IContextItem } from '@refly/common-types';
import { useTranslation } from 'react-i18next';

import { cn } from '@refly/utils/cn';
import classNames from 'classnames';
import { ProjectKnowledgeToggle } from '@refly-packages/ai-workspace-common/components/project/project-knowledge-toggle';

import './index.scss';

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
  className?: string;
  mode?: 'node' | 'list';
  projectId?: string;
  handleProjectChange?: (newProjectId: string) => void;
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
    className = '',
    mode = 'node',
    loading = false,
    projectId,
    handleProjectChange,
    enableRichInput = false,
    selectedToolsets,
    onSelectedToolsetsChange,
  }: ChatPanelProps) => {
    const chatInputRef = useRef<HTMLDivElement>(null);
    const isList = mode === 'list';

    const contextItemsRef = useRef(contextItems);
    const { t } = useTranslation();

    useEffect(() => {
      contextItemsRef.current = contextItems;
    }, [contextItems]);

    // Add useEffect for auto focus
    useEffect(() => {
      if (!readonly) {
        setTimeout(() => {
          if (chatInputRef.current) {
            const textArea = chatInputRef.current.querySelector('textarea');
            if (textArea) {
              textArea.focus();
            }
          }
        }, 100);
      }
    }, [readonly]);

    const renderContent = () => (
      <ChatComposer
        ref={chatInputRef}
        query={query}
        setQuery={(value) => {
          setQuery(value);
        }}
        handleSendMessage={handleSendMessage}
        handleAbort={handleAbortAction}
        contextItems={contextItems}
        setContextItems={setContextItems}
        modelInfo={modelInfo}
        setModelInfo={setModelInfo}
        runtimeConfig={runtimeConfig}
        setRuntimeConfig={setRuntimeConfig}
        placeholder={t('canvas.launchpad.commonChatInputPlaceholder')}
        inputClassName="px-1 py-0"
        maxRows={6}
        onFocus={() => {}}
        contextClassName={classNames({ 'py-2': isList })}
        actionsClassName={classNames({ 'py-2': isList })}
        enableRichInput={enableRichInput}
        selectedToolsets={selectedToolsets}
        onSelectedToolsetsChange={onSelectedToolsetsChange}
        isExecuting={loading}
      />
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
