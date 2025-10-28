import { memo, useEffect, useMemo } from 'react';
import { Skeleton } from 'antd';
import { useGetCopilotSessionDetail } from '@refly-packages/ai-workspace-common/queries';

interface SessionDetailProps {
  sessionId: string;
}
export const SessionDetail = memo(({ sessionId }: SessionDetailProps) => {
  const { data, refetch, isLoading } = useGetCopilotSessionDetail(
    {
      query: {
        sessionId,
      },
    },
    [],
    {
      enabled: false,
    },
  );

  console.log('data', data);

  useEffect(() => {
    if (sessionId) {
      refetch();
    }
  }, [sessionId]);

  const loadingSkeleton = useMemo(() => {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton title={false} active />
        <Skeleton title={false} active />
        <Skeleton title={false} active />
        <Skeleton title={false} active />
        <Skeleton title={false} active />
        <Skeleton title={false} active />
        <Skeleton title={false} active />
        <Skeleton title={false} active />
        <Skeleton title={false} active />
      </div>
    );
  }, []);

  return (
    <div className="w-full px-4 py-5">
      {isLoading ? loadingSkeleton : <div>SessionDetail: {sessionId}</div>}
    </div>
  );
});

SessionDetail.displayName = 'SessionDetail';
