import { memo, useEffect, useMemo } from 'react';
import { Skeleton, Divider } from 'antd';
import { useGetCopilotSessionDetail } from '@refly-packages/ai-workspace-common/queries';
import { useActionResultStoreShallow, useCopilotStoreShallow } from '@refly/stores';
import { ActionResult } from '@refly/openapi-schema';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { LoadingOutlined } from '@ant-design/icons';

interface SessionDetailProps {
  sessionId: string;
}

const CopilotMessage = memo(({ result }: { result: ActionResult }) => {
  const { input, steps, status } = result;
  const content = steps?.[0]?.content ?? '';

  return (
    <div className="flex flex-col gap-4">
      {/* User query - right aligned blue bubble */}
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg bg-refly-primary-default px-3 py-2 text-sm text-white">
          {input?.query}
        </div>
      </div>
      {/* AI response - left aligned */}
      <div className="text-sm text-refly-text-secondary-default">
        {status === 'executing' && !content ? (
          <LoadingOutlined className="ml-2" />
        ) : (
          <Markdown content={content} mode="readonly" />
        )}
      </div>
      <Divider type="horizontal" />
    </div>
  );
});
CopilotMessage.displayName = 'CopilotMessage';

export const SessionDetail = memo(({ sessionId }: SessionDetailProps) => {
  const { sessionResultIds, setSessionResultIds } = useCopilotStoreShallow((state) => ({
    sessionResultIds: state.sessionResultIds[sessionId],
    setSessionResultIds: state.setSessionResultIds,
  }));
  const { updateActionResult } = useActionResultStoreShallow((state) => ({
    updateActionResult: state.updateActionResult,
  }));
  console.log('SessionDetail sessionResultIds', sessionResultIds);

  const { resultMap } = useActionResultStoreShallow((state) => ({
    resultMap: state.resultMap,
  }));
  const results = useMemo(() => {
    return sessionResultIds?.map((resultId) => resultMap[resultId]) ?? [];
  }, [sessionResultIds, resultMap]);

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

  useEffect(() => {
    if (sessionId) {
      refetch();
    }
  }, [sessionId]);

  useEffect(() => {
    if (data) {
      const results = data.data?.results ?? [];
      setSessionResultIds(sessionId, results.map((result) => result.resultId) ?? []);
      for (const result of results) {
        updateActionResult(result.resultId, result);
      }
    }
  }, [data, updateActionResult, setSessionResultIds]);

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
      {isLoading ? (
        loadingSkeleton
      ) : (
        <div>
          {results.map((result) => (
            <CopilotMessage key={result.resultId} result={result} />
          ))}
        </div>
      )}
    </div>
  );
});

SessionDetail.displayName = 'SessionDetail';
