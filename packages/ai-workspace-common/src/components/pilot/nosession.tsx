import { memo, useCallback, useMemo, useState } from 'react';
// import { useTranslation } from 'react-i18next';
import cn from 'classnames';
import { useChatStoreShallow, useFrontPageStoreShallow, useUserStoreShallow } from '@refly/stores';
import { MediaChatInput } from '@refly-packages/ai-workspace-common/components/canvas/nodes/media/media-input';
import { ChatModeSelector } from '@refly-packages/ai-workspace-common/components/canvas/front-page/chat-mode-selector';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { McpSelectorPopover } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/mcp-selector-panel';
import { Button } from 'antd';
import { logEvent } from '@refly/telemetry-web';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
import { ModelSelector } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions/model-selector';
import { Send } from 'refly-icons';

/**
 * NoSession
 * UI shown when there is no active pilot session.
 * Layout and styling are referenced from `canvas/front-page/index.tsx`.
 */
export const NoSession = memo(({ canvasId }: { canvasId: string }) => {
  // const { t } = useTranslation();
  const { debouncedCreateCanvas, isCreating } = useCreateCanvas({
    projectId: undefined,
    afterCreateSuccess: () => {
      // When canvas is created successfully, data is already in the store
      // No need to use localStorage anymore
    },
  });
  const [_isExecuting, setIsExecuting] = useState<boolean>(false);
  const { query, setQuery } = useFrontPageStoreShallow((state) => ({
    query: state.query,
    setQuery: state.setQuery,
  }));
  const { chatMode, setChatMode, skillSelectedModel, setSkillSelectedModel } = useChatStoreShallow(
    (state) => ({
      chatMode: state.chatMode,
      setChatMode: state.setChatMode,
      skillSelectedModel: state.skillSelectedModel,
      setSkillSelectedModel: state.setSkillSelectedModel,
    }),
  );
  const userStore = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));
  const isPilotActivated = useMemo(() => chatMode === 'agent', [chatMode]);
  const handleSendMessage = useCallback(() => {
    if (!query?.trim()) return;

    logEvent('agent::send_message', Date.now(), {
      chatMode,
    });

    setIsExecuting(true);
    debouncedCreateCanvas('front-page', {
      isPilotActivated: chatMode === 'agent',
      isAsk: chatMode === 'ask',
    });
  }, [query, debouncedCreateCanvas, chatMode]);
  console.log('canvasId', canvasId);
  return (
    <div className={cn('flex bg-refly-bg-content-z2 overflow-y-auto rounded-lg')}>
      <div className={cn('relative w-full max-w-4xl mx-auto z-10', 'flex flex-col justify-center')}>
        <div className="w-full h-full rounded-[12px] shadow-refly-m overflow-hidden">
          <div className="p-4">
            <div className="w-full rounded-[12px] shadow-refly-m overflow-hidden border-[1px] border-solid border-refly-primary-default ">
              {chatMode === 'media' ? (
                <div className="w-full px-4 pt-4 pb-3">
                  <MediaChatInput
                    readonly={false}
                    query={query}
                    setQuery={setQuery}
                    showChatModeSelector
                  />
                </div>
              ) : (
                <>
                  <div className="px-4 h-[76px]">
                    <ChatInput
                      placeholder="给 Refly 一个任务，它会智能分析和规划，并帮你完成任务..."
                      readonly={false}
                      query={query}
                      setQuery={setQuery}
                      handleSendMessage={handleSendMessage}
                      maxRows={6}
                      inputClassName="px-3 pt-5 pb-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex pl-4 pb-3">
                    <div className="flex items-center w-full">
                      <div className="mr-2">
                        <ChatModeSelector chatMode={chatMode} setChatMode={setChatMode} />
                      </div>
                      {userStore.isLogin && !isPilotActivated && (
                        <ModelSelector
                          model={skillSelectedModel}
                          setModel={setSkillSelectedModel}
                          briefMode={false}
                          trigger={['click']}
                        />
                      )}
                      {userStore.isLogin && <McpSelectorPopover />}
                      <div className="flex items-center gap-2 ml-auto pr-4">
                        <Button
                          className="flex items-center !h-9 !w-9 rounded-full border-none"
                          size="small"
                          type="primary"
                          icon={<Send size={20} />}
                          onClick={handleSendMessage}
                          disabled={isCreating || !query?.trim()}
                          loading={isCreating}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

NoSession.displayName = 'NoSession';
