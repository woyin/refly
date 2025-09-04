import { memo, useEffect, useMemo } from 'react';
import { SessionContainer } from './session-container';
import { useListPilotSessions } from '@refly-packages/ai-workspace-common/queries/queries';
import { usePilotStoreShallow } from '@refly/stores';

interface PilotProps {
  canvasId: string;
}
export const Pilot = memo(
  ({ canvasId }: PilotProps) => {
    const { setActiveSessionId } = usePilotStoreShallow((state) => ({
      setActiveSessionId: state.setActiveSessionId,
    }));
    const { data } = useListPilotSessions(
      {
        query: {
          targetId: canvasId,
          targetType: 'canvas',
          page: 1,
          pageSize: 1,
        },
      },
      undefined,
      {
        enabled: !!canvasId,
      },
    );
    const sessionsList = useMemo(() => data?.data, [data]);

    useEffect(() => {
      if (
        sessionsList?.length > 0 &&
        ['init', 'executing', 'waiting'].includes(sessionsList[0].status)
      ) {
        setActiveSessionId(canvasId, sessionsList[0].sessionId);
      }
    }, [sessionsList, setActiveSessionId, canvasId]);

    return <SessionContainer canvasId={canvasId} />;
  },
  (prevProps, nextProps) => {
    return prevProps.canvasId === nextProps.canvasId;
  },
);

Pilot.displayName = 'Pilot';
