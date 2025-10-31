import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
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

// Typing/thinking indicator with three scaling dots
interface ThinkingDotsProps {
  label: string;
}

const ThinkingDots = memo(({ label }: ThinkingDotsProps) => {
  // Precompute indices to avoid creating arrays on each render
  const dotIndices = useMemo(() => [0, 1, 2], []);

  // Animation delays for each dot
  const delays = useMemo(() => ['0ms', '150ms', '300ms'], []);

  return (
    <div className="flex items-center gap-2">
      <div className="text-refly-text-2">{label}</div>
      <div className="flex items-center gap-1">
        {dotIndices.map((idx) => (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={idx}
            className="inline-block h-1.5 w-1.5 rounded-full bg-refly-text-2"
            style={{
              animation: 'rf-dot-pulse 1.2s infinite ease-in-out',
              animationDelay: delays[idx] ?? '0ms',
            }}
          />
        ))}
      </div>
      {/* Local keyframes for dot scaling animation */}
      <style>
        {`
          @keyframes rf-dot-pulse {
            0%, 80%, 100% { transform: scale(0.6); opacity: 0.6; }
            40% { transform: scale(1); opacity: 1; }
          }
        `}
      </style>
    </div>
  );
});
ThinkingDots.displayName = 'ThinkingDots';

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
        <div className="rounded-xl bg-[#F2FDFF] dark:bg-[#327576] text-refly-text-0 px-4 py-3 text-[15px]">
          {input?.query}
        </div>
      </div>
      {/* AI response - left aligned */}
      {isThinking ? (
        <div className="mt-4">
          <ThinkingDots label={t('copilot.sessionDetail.thinking')} />
        </div>
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
  const { updateActionResult, resultMap } = useActionResultStoreShallow((state) => ({
    updateActionResult: state.updateActionResult,
    resultMap: state.resultMap,
  }));

  const results = useMemo(() => {
    return sessionResultIds?.map((resultId) => resultMap[resultId]) ?? [];
  }, [sessionResultIds, resultMap]);

  const lastResultContent = useMemo(() => {
    return results?.length > 0 ? (results[results.length - 1]?.steps?.[0]?.content ?? '') : '';
  }, [results]);

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

  // Scroll handling: keep message list pinned to bottom when results change
  const listRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = useCallback(() => {
    const container = listRef.current;
    if (!container) {
      return;
    }
    container.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      scrollToBottom();
    }, 200);

    return () => clearTimeout(timeout);
  }, [results?.length, lastResultContent]);

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
    <div className="w-full px-4">
      {isLoading ? (
        loadingSkeleton
      ) : (
        <div ref={listRef} className="flex flex-col gap-4 py-5">
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
