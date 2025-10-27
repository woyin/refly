import { memo, useState } from 'react';
import { ChatComposer } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-composer';
import { GenericToolset } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

interface ChatBoxProps {
  sessionId?: string;
}

export const ChatBox = memo(({ sessionId }: ChatBoxProps) => {
  console.log('sessionId', sessionId);
  const { canvasId } = useCanvasContext();

  const [query, setQuery] = useState('');
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
    <div className="w-full h-full px-4 pb-4 z-10 rounded-2xl">
      <div className="w-full px-4 py-3 rounded-xl overflow-hidden border-[1px] border-solid border-refly-primary-default ">
        <ChatComposer
          query={query}
          setQuery={setQuery}
          handleSendMessage={handleSendMessage}
          handleAbort={() => {}}
          contextItems={[]}
          setContextItems={() => {}}
          modelInfo={null}
          setModelInfo={() => {}}
          enableRichInput={true}
          selectedToolsets={selectedToolsets}
          onSelectedToolsetsChange={setSelectedToolsets}
          isExecuting={isExecuting}
        />
      </div>
    </div>
  );
});

ChatBox.displayName = 'ChatBox';
