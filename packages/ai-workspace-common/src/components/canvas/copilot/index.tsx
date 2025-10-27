import { memo, useCallback, useState } from 'react';

import { ChatBox } from './chat-box';
import { Greeting } from './greeting';
import { SessionDetail } from './session-detail';
import { CopilotHeader } from './copilot-header';

import { useCopilotStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

interface CopilotProps {
  copilotWidth: number;
  setCopilotWidth: (width: number) => void;
}

export const Copilot = memo(({ copilotWidth, setCopilotWidth }: CopilotProps) => {
  const { canvasId } = useCanvasContext();
  const [query, setQuery] = useState('');
  const { currentSessionId: sessionId, setCurrentSessionId: setSessionId } = useCopilotStoreShallow(
    (state) => ({
      setCurrentSessionId: state.setCurrentSessionId,
      currentSessionId: state.currentSessionId[canvasId] ?? null,
    }),
  );

  const handleQueryClick = useCallback((query: string) => {
    setQuery(query);
  }, []);

  const handleSetSessionId = useCallback(
    (sessionId: string | null) => {
      setSessionId(canvasId, sessionId);
    },
    [setSessionId, canvasId],
  );

  return (
    <div className="w-full h-full overflow-hidden flex flex-col bg-refly-bg-content-z2 border-solid border-r-[1px] border-y-0 border-l-0 border-refly-Card-Border shadow-lg">
      <CopilotHeader
        canvasId={canvasId}
        sessionId={sessionId}
        setSessionId={handleSetSessionId}
        copilotWidth={copilotWidth}
        setCopilotWidth={setCopilotWidth}
      />

      <div className="flex-grow overflow-y-auto">
        {sessionId ? (
          <SessionDetail sessionId={sessionId} />
        ) : (
          <Greeting onQueryClick={handleQueryClick} />
        )}
      </div>

      <div className="w-full p-3 pt-2">
        <ChatBox canvasId={canvasId} query={query} setQuery={setQuery} sessionId={sessionId} />
      </div>
    </div>
  );
});

Copilot.displayName = 'Copilot';
