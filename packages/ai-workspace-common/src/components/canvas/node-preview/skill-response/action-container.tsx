import { useMemo, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, message, Tooltip } from 'antd';
import { AiChat, Data } from 'refly-icons';
import { ModelIcon } from '@lobehub/icons';
import { ActionResult, ActionStep, Source } from '@refly/openapi-schema';
import { CheckCircleOutlined, CopyOutlined, ImportOutlined } from '@ant-design/icons';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { parseMarkdownCitationsAndCanvasTags, safeParseJSON } from '@refly/utils/parse';
import { useDocumentStoreShallow, useUserStoreShallow } from '@refly/stores';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-document';
import { editorEmitter, EditorOperation } from '@refly/utils/event-emitter/editor';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useListProviderItems } from '@refly-packages/ai-workspace-common/queries';

interface ActionContainerProps {
  step: ActionStep;
  result: ActionResult;
  nodeId?: string;
}

const buttonClassName = 'text-xs flex justify-center items-center h-6 px-1 rounded-lg';

const ActionContainerComponent = ({ result, step }: ActionContainerProps) => {
  const { t } = useTranslation();
  const { debouncedCreateDocument, isCreating } = useCreateDocument();
  const { readonly } = useCanvasContext();
  const { hasEditorSelection, activeDocumentId } = useDocumentStoreShallow((state) => ({
    hasEditorSelection: state.hasEditorSelection,
    activeDocumentId: state.activeDocumentId,
  }));

  const { title } = result ?? {};
  const isPending = result?.status === 'executing';

  // Check if we're in share mode by checking if resultId exists
  // This indicates a "proper" result vs a shared result that might be loaded from share data
  const isShareMode = !result.resultId;

  const sources = useMemo(
    () =>
      typeof step?.structuredData?.sources === 'string'
        ? safeParseJSON(step?.structuredData?.sources)
        : (step?.structuredData?.sources as Source[]),
    [step?.structuredData],
  );

  const editorActionList = useMemo(
    () => [
      {
        icon: <ImportOutlined style={{ fontSize: 14 }} />,
        key: 'insertBelow',
        enabled: step.content && activeDocumentId,
      },
      {
        icon: <CheckCircleOutlined style={{ fontSize: 14 }} />,
        key: 'replaceSelection',
        enabled: step.content && activeDocumentId && hasEditorSelection,
      },
    ],
    [step.content, activeDocumentId, hasEditorSelection],
  );

  const handleEditorOperation = useCallback(
    async (type: EditorOperation | 'createDocument', content: string) => {
      const parsedContent = parseMarkdownCitationsAndCanvasTags(content, sources);

      if (type === 'insertBelow' || type === 'replaceSelection') {
        editorEmitter.emit(type, parsedContent);
      } else if (type === 'createDocument') {
        await debouncedCreateDocument(title ?? '', content, {
          sourceNodeId: result.resultId,
          addToCanvas: true,
        });
      }
    },
    [sources, title, result.resultId, debouncedCreateDocument],
  );

  const handleCopyToClipboard = useCallback(
    (content: string) => {
      const parsedText = parseMarkdownCitationsAndCanvasTags(content, sources);
      copyToClipboard(parsedText || '');
      message.success(t('copilot.message.copySuccess'));
    },
    [sources, t],
  );

  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  const { data: providerItemList } = useListProviderItems({
    query: {
      category: 'llm',
      enabled: true,
      isGlobal: userProfile?.preferences?.providerMode === 'global',
    },
  });

  const tokenUsage = step?.tokenUsage?.[0];

  const providerItem = useMemo(() => {
    if (!tokenUsage || !providerItemList?.data) return null;

    // If providerItemId is provided, use it to find the provider item
    if (tokenUsage?.providerItemId) {
      return providerItemList?.data?.find((item) => item.itemId === tokenUsage?.providerItemId);
    }

    // Fallback to modelName if providerItemId is not provided
    return (
      providerItemList?.data?.find((item) => item.config?.modelId === tokenUsage?.modelName) || null
    );
  }, [providerItemList, tokenUsage]);

  if (isPending) {
    return null;
  }

  return (
    <div className="border-[1px] border-solid border-b-0 border-x-0 border-refly-Card-Border pt-3">
      <div className="flex flex-row items-center justify-between bg-refly-tertiary-default px-3 py-2 rounded-xl mx-3">
        <div className="flex flex-row items-center gap-1 px-2">
          <span className="font-[600]">下一步建议</span>
          <Button type="text" size="small" icon={<AiChat size={16} />} className="mx-4">
            <span>追问</span>
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between p-3 rounded-b-xl">
        {tokenUsage && (
          <div className="flex flex-row text-gray-500 text-sm gap-3">
            <div className="flex items-center gap-1">
              <ModelIcon size={16} model={tokenUsage?.modelName} type="color" />
              {tokenUsage?.modelLabel || providerItem?.name}
            </div>
            <div className="flex items-center gap-1">
              <Data size={16} />
              {tokenUsage?.inputTokens + tokenUsage?.outputTokens}
            </div>
          </div>
        )}
        {!isPending && step?.content && (
          <div className="flex flex-row justify-between items-center text-sm">
            <div className="-ml-1 text-sm flex flex-row items-center gap-1">
              {!readonly && !isShareMode && step.content && (
                <Tooltip title={t('copilot.message.copy')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined style={{ fontSize: 14 }} />}
                    className={buttonClassName}
                    onClick={() => handleCopyToClipboard(step.content ?? '')}
                  />
                </Tooltip>
              )}
              {!readonly &&
                !isShareMode &&
                editorActionList.map((item) => (
                  <Tooltip key={item.key} title={t(`copilot.message.${item.key}`)}>
                    <Button
                      key={item.key}
                      size="small"
                      type="text"
                      className={buttonClassName}
                      icon={item.icon}
                      disabled={!item.enabled}
                      loading={isCreating}
                      onClick={() => {
                        const parsedText = parseMarkdownCitationsAndCanvasTags(
                          step.content ?? '',
                          sources,
                        );
                        handleEditorOperation(item.key as EditorOperation, parsedText || '');
                      }}
                    />
                  </Tooltip>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ActionContainer = memo(ActionContainerComponent, (prevProps, nextProps) => {
  return (
    prevProps.step === nextProps.step &&
    prevProps.result === nextProps.result &&
    prevProps.nodeId === nextProps.nodeId
  );
});
