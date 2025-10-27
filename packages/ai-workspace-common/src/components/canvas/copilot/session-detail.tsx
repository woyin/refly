import { memo } from 'react';

interface SessionDetailProps {
  sessionId: string;
}
export const SessionDetail = memo(({ sessionId }: SessionDetailProps) => {
  return <div>SessionDetail: {sessionId}</div>;
});

SessionDetail.displayName = 'SessionDetail';
