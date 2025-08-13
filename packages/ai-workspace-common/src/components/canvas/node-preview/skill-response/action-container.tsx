import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, message, Dropdown, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import { ActionResult, ActionStep, Source } from '@refly/openapi-schema';
import { CheckCircleOutlined, CopyOutlined, ImportOutlined } from '@ant-design/icons';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { parseMarkdownCitationsAndCanvasTags, safeParseJSON } from '@refly/utils/parse';
import { useDocumentStoreShallow } from '@refly/stores';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-document';
import { editorEmitter, EditorOperation } from '@refly/utils/event-emitter/editor';
import { HiOutlineCircleStack } from 'react-icons/hi2';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

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

  const [tokenUsage, setTokenUsage] = useState(0);

  useEffect(() => {
    let total = 0;
    for (const item of step?.tokenUsage || []) {
      total += (item?.inputTokens || 0) + (item?.outputTokens || 0);
    }
    setTokenUsage(total);
  }, [step?.tokenUsage]);

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

  const tokenUsageDropdownList: MenuProps['items'] = useMemo(
    () =>
      step?.tokenUsage?.map((item: any) => ({
        key: item?.modelName,
        label: (
          <div className="flex items-center">
            <span>
              {item?.modelName}:{' '}
              {t('copilot.tokenUsage', {
                inputCount: item?.inputTokens,
                outputCount: item?.outputTokens,
              })}
            </span>
          </div>
        ),
      })),
    [step?.tokenUsage, t],
  );

  return (
    <div className="flex items-center justify-between border-[1px] border-solid border-b-0 border-x-0 border-refly-Card-Border p-3">
      <div className="-ml-1">
        {step?.tokenUsage && step.tokenUsage.length > 0 && !isShareMode && (
          <Dropdown menu={{ items: tokenUsageDropdownList }}>
            <Button
              type="text"
              size="small"
              icon={<HiOutlineCircleStack style={{ fontSize: 14 }} />}
              className="text-gray-500 text-xs"
            >
              {tokenUsage} tokens
            </Button>
          </Dropdown>
        )}
      </div>
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
  );
};

export const ActionContainer = memo(ActionContainerComponent, (prevProps, nextProps) => {
  return (
    prevProps.step === nextProps.step &&
    prevProps.result === nextProps.result &&
    prevProps.nodeId === nextProps.nodeId
  );
});
