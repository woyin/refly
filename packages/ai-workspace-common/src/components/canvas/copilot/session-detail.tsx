import { memo, useEffect, useMemo } from 'react';
import { Skeleton, Divider } from 'antd';
import { useGetCopilotSessionDetail } from '@refly-packages/ai-workspace-common/queries';
import { useActionResultStoreShallow, useCopilotStoreShallow } from '@refly/stores';
import { ActionResult } from '@refly/openapi-schema';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { useTranslation } from 'react-i18next';

interface SessionDetailProps {
  sessionId: string;
}

interface CopilotMessageProps {
  result: ActionResult;
  isFinal: boolean;
}

const CopilotMessage = memo(({ result, isFinal }: CopilotMessageProps) => {
  const { input, steps, status } = result;
  const content = steps?.[0]?.content ?? '';
  console.log('CopilotMessage content', result);
  const { t } = useTranslation();

  const isThinking = useMemo(() => {
    return ['waiting', 'executing'].includes(status ?? '') && !content;
  }, [status, content]);

  return (
    <div className="flex flex-col gap-4">
      {/* User query - right aligned blue bubble */}
      <div className="flex justify-end pl-5">
        <div className="rounded-xl bg-[#F2FDFF] text-refly-text-0 px-4 py-3 text-[15px]">
          {input?.query}
        </div>
      </div>
      {/* AI response - left aligned */}
      {isThinking ? (
        <div className="mt-4 text-refly-text-2">{t('copilot.sessionDetail.thinking')}</div>
      ) : (
        <Markdown content={content} mode="readonly" />
      )}
      {!isFinal && <Divider type="horizontal" className="my-[10px] bg-refly-Card-Border h-[1px]" />}
    </div>
  );
});
CopilotMessage.displayName = 'CopilotMessage';

export const SessionDetail = memo(({ sessionId }: SessionDetailProps) => {
  const { sessionResultIds, setSessionResultIds, createdCopilotSessionIds } =
    useCopilotStoreShallow((state) => ({
      sessionResultIds: state.sessionResultIds[sessionId],
      setSessionResultIds: state.setSessionResultIds,
      createdCopilotSessionIds: state.createdCopilotSessionIds,
    }));
  const { updateActionResult } = useActionResultStoreShallow((state) => ({
    updateActionResult: state.updateActionResult,
  }));

  const { resultMap } = useActionResultStoreShallow((state) => ({
    resultMap: state.resultMap,
  }));
  const results = useMemo(() => {
    return sessionResultIds?.map((resultId) => resultMap[resultId]) ?? [];
  }, [sessionResultIds, resultMap]);

  const { data, isLoading } = useGetCopilotSessionDetail(
    {
      query: {
        sessionId,
      },
    },
    [sessionId],
    {
      enabled: sessionId && !createdCopilotSessionIds[sessionId],
    },
  );

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
        <div className="flex flex-col gap-4">
          {results.map((result, index) => (
            <CopilotMessage
              key={result.resultId}
              result={result}
              isFinal={index === results.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
});

SessionDetail.displayName = 'SessionDetail';
