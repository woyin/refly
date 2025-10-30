import { memo, useState } from 'react';
import { ChatComposer } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-composer';
import { GenericToolset } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { IContextItem } from '@refly/common-types/src/context';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { genActionResultID, genCopilotSessionID } from '@refly/utils/id';
import { useCopilotStoreShallow } from '@refly/stores';

interface ChatBoxProps {
  canvasId: string;
  query: string;
  setQuery: (query: string) => void;
}

export const ChatBox = memo(({ canvasId, query, setQuery }: ChatBoxProps) => {
  const [contextItems, setContextItems] = useState<IContextItem[]>([]);

  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedToolsets, setSelectedToolsets] = useState<GenericToolset[]>([]);

  const {
    currentSessionId,
    setCurrentSessionId,
    appendSessionResultId,
    setCreatedCopilotSessionId,
  } = useCopilotStoreShallow((state) => ({
    currentSessionId: state.currentSessionId[canvasId],
    setCurrentSessionId: state.setCurrentSessionId,
    appendSessionResultId: state.appendSessionResultId,
    setCreatedCopilotSessionId: state.setCreatedCopilotSessionId,
  }));

  const { invokeAction } = useInvokeAction();

  const handleSendMessage = async () => {
    console.log('handleSendMessage currentSessionId', currentSessionId);

    setIsExecuting(true);

    const resultId = genActionResultID();
    let sessionId = currentSessionId;

    if (!sessionId) {
      sessionId = genCopilotSessionID();
    }

    invokeAction(
      {
        query,
        resultId,
        selectedSkill: undefined,
        modelInfo: null,
        tplConfig: {},
        runtimeConfig: {},
        contextItems,
        agentMode: 'copilot_agent',
        copilotSessionId: sessionId,
      },
      {
        entityId: canvasId,
        entityType: 'canvas',
      },
    );

    setCurrentSessionId(canvasId, sessionId);
    appendSessionResultId(sessionId, resultId);
    setCreatedCopilotSessionId(sessionId);

    setIsExecuting(false);
  };

  return (
    <div className="w-full px-4 py-3 rounded-xl overflow-hidden border-[1px] border-solid border-refly-primary-default ">
      <ChatComposer
        query={query}
        setQuery={setQuery}
        handleSendMessage={handleSendMessage}
        handleAbort={() => {}}
        contextItems={contextItems}
        setContextItems={setContextItems}
        modelInfo={null}
        setModelInfo={() => {}}
        enableRichInput={false}
        selectedToolsets={selectedToolsets}
        onSelectedToolsetsChange={setSelectedToolsets}
        isExecuting={isExecuting}
      />
    </div>
  );
});

ChatBox.displayName = 'ChatBox';
