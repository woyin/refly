import { useEffect, useState, useMemo, memo, useCallback } from 'react';
import { Button, Divider, message, Result, Skeleton, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { useActionResultStoreShallow, useSubscriptionStoreShallow } from '@refly/stores';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { ActionResult } from '@refly/openapi-schema';
import { CanvasNode, ResponseNodeMeta } from '@refly/canvas-common';
import { Subscription, Thinking } from 'refly-icons';
import { actionEmitter } from '@refly-packages/ai-workspace-common/events/action';
import { ActionStepCard } from './action-step';
import { convertResultContextToItems, purgeContextItems } from '@refly/canvas-common';
import { logEvent } from '@refly/telemetry-web';
import { PreviewChatInput } from './preview-chat-input';
import { SourceListModal } from '@refly-packages/ai-workspace-common/components/source-list/source-list-modal';
import { useKnowledgeBaseStoreShallow } from '@refly/stores';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';
import { EditChatInput } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/edit-chat-input';
import { cn } from '@refly/utils/cn';
import { useReactFlow } from '@xyflow/react';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import {
  IconError,
  IconLoading,
  IconRerun,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { locateToNodePreviewEmitter } from '@refly-packages/ai-workspace-common/events/locateToNodePreview';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import { processContentPreview } from '@refly-packages/ai-workspace-common/utils/content';
import { useUserStore } from '@refly/stores';
import { useActionPolling } from '@refly-packages/ai-workspace-common/hooks/canvas/use-action-polling';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { useSkillError } from '@refly-packages/ai-workspace-common/hooks/use-skill-error';
import { guessModelProviderError, ModelUsageQuotaExceeded } from '@refly/errors';
import { useGetCreditBalance } from '@refly-packages/ai-workspace-common/queries';
import { sortSteps } from '@refly/utils/step';
import { ActionContainer } from './action-container';

interface SkillResponseNodePreviewProps {
  node: CanvasNode<ResponseNodeMeta>;
  resultId: string;
}

const OUTPUT_STEP_NAMES = ['answerQuestion', 'generateDocument', 'generateCodeArtifact'];

const SkillResponseNodePreviewComponent = ({ node, resultId }: SkillResponseNodePreviewProps) => {
  const { result, traceId, isStreaming, updateActionResult } = useActionResultStoreShallow(
    (state) => ({
      result: state.resultMap[resultId],
      traceId: state.traceIdMap[resultId],
      isStreaming: !!state.streamResults[resultId],
      updateActionResult: state.updateActionResult,
    }),
  );
  const knowledgeBaseStore = useKnowledgeBaseStoreShallow((state) => ({
    sourceListDrawerVisible: state.sourceListDrawer.visible,
  }));

  const { getNodes } = useReactFlow();
  const { setNodeData } = useNodeData();
  const { deleteNode } = useDeleteNode();

  const { canvasId, readonly } = useCanvasContext();
  const { invokeAction } = useInvokeAction({ source: 'skill-response-node-preview' });
  const { resetFailedState } = useActionPolling();

  const { t } = useTranslation();
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(!result);

  const shareId = node.data?.metadata?.shareId;
  const { data: shareData } = useFetchShareData(shareId);

  const [statusText, setStatusText] = useState('');

  useEffect(() => {
    if (shareData && !result) {
      updateActionResult(resultId, shareData);
      setLoading(false);
    }
  }, [shareData, result, resultId, updateActionResult]);

  const fetchActionResult = async (resultId: string) => {
    const { isLogin } = useUserStore.getState();
    if (!isLogin) {
      return;
    }

    setLoading(true);
    const { data, error } = await getClient().getActionResult({
      query: { resultId },
    });
    setLoading(false);

    if (error || !data?.success) {
      return;
    }

    updateActionResult(resultId, data.data!);

    const remoteResult = data.data;
    const node = getNodes().find((node) => node.data?.entityId === resultId);
    if (node && remoteResult) {
      setNodeData(node.id, {
        title: remoteResult.title,
        contentPreview: processContentPreview(remoteResult.steps?.map((s) => s?.content || '')),
        metadata: {
          status: remoteResult?.status,
          reasoningContent: processContentPreview(
            remoteResult.steps?.map((s) => s?.reasoningContent || ''),
          ),
        },
      });
    }
  };

  useEffect(() => {
    if (!result && !shareId) {
      fetchActionResult(resultId);
    } else if (result) {
      setLoading(false);
    }
  }, [resultId, result, shareId]);

  const scrollToBottom = useCallback(
    (event: { resultId: string; payload: ActionResult }) => {
      if (event.resultId !== resultId || event.payload?.status !== 'executing') {
        return;
      }

      const container = document.body.querySelector('.preview-container');
      if (container) {
        const { scrollHeight, clientHeight } = container;
        container.scroll({
          behavior: 'smooth',
          top: scrollHeight - clientHeight + 50,
        });
      }
    },
    [resultId],
  );

  useEffect(() => {
    actionEmitter.on('updateResult', scrollToBottom);
    return () => {
      actionEmitter.off('updateResult', scrollToBottom);
    };
  }, [scrollToBottom]);

  const { data } = node;

  const title = result?.title ?? data?.title;
  const actionMeta = result?.actionMeta ?? data?.metadata?.actionMeta;
  const version = result?.version ?? data?.metadata?.version ?? 0;
  const modelInfo = result?.modelInfo ?? data?.metadata?.modelInfo;
  const tplConfig = result?.tplConfig ?? data?.metadata?.tplConfig;
  const runtimeConfig = result?.runtimeConfig ?? data?.metadata?.runtimeConfig;

  const { errCode, errMsg, rawError } = useSkillError(result?.errors?.[0] ?? '');

  const { setSubscribeModalVisible } = useSubscriptionStoreShallow((state) => ({
    setSubscribeModalVisible: state.setSubscribeModalVisible,
  }));

  const { data: balanceData, isSuccess: isBalanceSuccess } = useGetCreditBalance();
  const creditBalance = balanceData?.data?.creditBalance ?? 0;

  const handleSubscriptionClick = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setSubscribeModalVisible(true);

      logEvent('subscription::upgrade_click', 'skill_invoke');
    },
    [setSubscribeModalVisible],
  );

  const { steps = [], context, history = [] } = result ?? {};
  const contextItems = useMemo(() => {
    // Prefer contextItems from node metadata
    if (data?.metadata?.contextItems) {
      return purgeContextItems(data?.metadata?.contextItems);
    }

    // Fallback to contextItems from context (could be legacy nodes)
    return convertResultContextToItems(context ?? {}, history);
  }, [data, context, history]);

  useEffect(() => {
    const skillName = actionMeta?.name || 'commonQnA';
    if (result?.status !== 'executing') return;

    const sortedSteps = sortSteps(steps);

    if (sortedSteps.length === 0) {
      setStatusText(
        t(`${skillName}.steps.analyzeQuery.description`, {
          ns: 'skill',
        }),
      );
      return;
    }

    const lastStep = sortedSteps[sortedSteps.length - 1];
    setStatusText(
      t(`${skillName}.steps.${lastStep.name}.description`, {
        ns: 'skill',
      }),
    );
  }, [result?.status, steps, t]);

  const handleDelete = useCallback(() => {
    deleteNode({
      id: node.id,
      type: 'skillResponse',
      data: node.data,
      position: node.position || { x: 0, y: 0 },
    });
  }, [node, deleteNode]);

  const handleRetry = useCallback(() => {
    // Reset failed state before retrying
    resetFailedState(resultId);

    // Update node status immediately to show "waiting" state
    setNodeData(node.id, {
      ...node.data,
      metadata: {
        ...node.data?.metadata,
        status: 'waiting',
      },
    });

    invokeAction(
      {
        resultId,
        query: title,
        selectedSkill: {
          name: actionMeta?.name || 'commonQnA',
        },
        contextItems,
      },
      {
        entityId: canvasId,
        entityType: 'canvas',
      },
    );
  }, [resultId, title, canvasId, invokeAction, resetFailedState, setNodeData, node.id, node.data]);

  useEffect(() => {
    const handleLocateToPreview = (event: { id: string; type?: 'editResponse' }) => {
      if (event.id === node.id && event.type === 'editResponse') {
        setEditMode(true);
      }
    };

    locateToNodePreviewEmitter.on('locateToNodePreview', handleLocateToPreview);

    return () => {
      locateToNodePreviewEmitter.off('locateToNodePreview', handleLocateToPreview);
    };
  }, [node.id]);

  const error = guessModelProviderError(result?.errors?.[0] ?? '');

  const errDescription = useMemo(() => {
    return `${errCode} ${errMsg} ${rawError ? `: ${String(rawError)}` : ''}`;
  }, [errCode, errMsg, rawError]);

  if (!result && !loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Result
          status="404"
          subTitle={t('canvas.skillResponse.resultNotFound')}
          extra={<Button onClick={handleDelete}>{t('canvas.nodeActions.delete')}</Button>}
        />
      </div>
    );
  }

  const outputStep = steps.find((step) => OUTPUT_STEP_NAMES.includes(step.name));

  return (
    <div className="flex flex-col space-y-4 p-4 h-full max-w-[1024px] mx-auto">
      {title && (
        <>
          <EditChatInput
            enabled={editMode}
            resultId={resultId}
            version={version}
            contextItems={contextItems}
            query={title}
            actionMeta={actionMeta}
            modelInfo={
              modelInfo ?? {
                name: '',
                label: '',
                provider: '',
                contextLimit: 0,
                maxOutput: 0,
              }
            }
            setEditMode={setEditMode}
            tplConfig={tplConfig}
            runtimeConfig={runtimeConfig}
          />
          <PreviewChatInput
            enabled={!editMode}
            readonly={readonly}
            contextItems={contextItems}
            query={title}
            actionMeta={actionMeta}
            setEditMode={setEditMode}
          />
        </>
      )}

      <Spin
        spinning={!isStreaming && result?.status === 'executing'}
        indicator={<IconLoading className="animate-spin" />}
        size="large"
        tip={t('canvas.skillResponse.generating')}
      >
        <div
          className={cn('flex-grow transition-opacity duration-500', { 'opacity-30': editMode })}
          onClick={() => {
            if (editMode) {
              setEditMode(false);
            }
          }}
        >
          {loading && <Skeleton className="mt-1" active paragraph={{ rows: 5 }} />}
          {!outputStep && statusText && (
            <div className="flex flex-col gap-2 animate-pulse">
              <Divider dashed className="my-2" />
              <div className="m-2 flex items-center gap-1 text-gray-500">
                <Thinking size={16} />
                <span className="text-sm">{statusText}</span>
              </div>
            </div>
          )}
          {outputStep && (
            <>
              <Divider dashed className="my-2" />
              <ActionStepCard
                result={result}
                step={outputStep}
                status={result?.status}
                query={title}
              />
            </>
          )}

          {result?.status === 'failed' && (
            <div className="mt-2 flex flex-col gap-2 border border-solid border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-md">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="font-medium text-sm flex items-center gap-2">
                    <IconError className="flex items-center justify-center text-yellow-500 flex-shrink-0" />
                    {t('canvas.skillResponse.error.defaultTitle')}
                  </div>
                  {errCode && (
                    <div className="space-y-2">
                      <p className="text-gray-700 dark:text-gray-200 text-xs break-words">
                        {errDescription}
                      </p>
                      {traceId && (
                        <p className="text-gray-500 dark:text-gray-400 text-xs break-all">
                          Trace ID: {traceId}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="text"
                  size="small"
                  className="text-xs"
                  onClick={() => {
                    if (errCode) {
                      navigator.clipboard.writeText(`${errDescription}\nTrace ID: ${traceId}`);
                      message.success(t('components.markdown.copySuccess'));
                    }
                  }}
                >
                  {t('common.copyRequestInfo')}
                </Button>
                {error instanceof ModelUsageQuotaExceeded &&
                creditBalance <= 0 &&
                isBalanceSuccess ? (
                  <Button
                    type="primary"
                    size="small"
                    className="text-xs flex items-center justify-center"
                    icon={
                      <Subscription
                        size={13}
                        className="text-[#1C1F23] dark:text-white text-xs flex items-center justify-center"
                      />
                    }
                    onClick={handleSubscriptionClick}
                  >
                    {t('canvas.nodeActions.upgrade')}
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    size="small"
                    className="text-xs"
                    icon={<IconRerun className="text-xs flex items-center justify-center" />}
                    onClick={handleRetry}
                  >
                    {t('canvas.nodeActions.rerun')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </Spin>

      {outputStep && <ActionContainer result={result} step={outputStep} nodeId={node.id} />}

      {knowledgeBaseStore?.sourceListDrawerVisible ? (
        <SourceListModal classNames="source-list-modal" />
      ) : null}
    </div>
  );
};

export const SkillResponseNodePreview = memo(
  SkillResponseNodePreviewComponent,
  (prevProps, nextProps) => {
    return prevProps.node.id === nextProps.node.id && prevProps.resultId === nextProps.resultId;
  },
);
