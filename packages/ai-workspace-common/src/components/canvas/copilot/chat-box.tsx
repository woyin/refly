import { memo, useState } from 'react';
import { ChatComposer } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-composer';
import { GenericToolset } from '@refly-packages/ai-workspace-common/requests/types.gen';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { IContextItem } from '@refly/common-types/src/context';

interface ChatBoxProps {
  canvasId: string;
  sessionId?: string;
  query: string;
  setQuery: (query: string) => void;
}

export const ChatBox = memo(({ canvasId, sessionId, query, setQuery }: ChatBoxProps) => {
  console.log('sessionId', sessionId);
  const [contextItems, setContextItems] = useState<IContextItem[]>([]);

  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedToolsets, setSelectedToolsets] = useState<GenericToolset[]>([]);
  const handleSendMessage = async () => {
    setIsExecuting(true);
    const response = await getClient().chatWithCopilot({
      body: {
        sessionId,
        input: {
          query,
        },
        canvasId,
      },
    });

    setIsExecuting(false);
    if (response?.error) {
      console.error('Error sending message:', response.error);
    }
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
        enableRichInput={true}
        selectedToolsets={selectedToolsets}
        onSelectedToolsetsChange={setSelectedToolsets}
        isExecuting={isExecuting}
      />
    </div>
  );
});

ChatBox.displayName = 'ChatBox';
