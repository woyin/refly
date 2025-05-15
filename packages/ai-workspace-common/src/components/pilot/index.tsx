import { memo } from 'react';
import { SessionContainer } from './session-container';
import { usePilotStoreShallow } from '@refly-packages/ai-workspace-common/stores/pilot';

export const Pilot = memo(() => {
  const { activeSessionId } = usePilotStoreShallow((state) => ({
    activeSessionId: state.activeSessionId,
  }));

  return <SessionContainer sessionId={activeSessionId} />;
});

Pilot.displayName = 'Pilot';
