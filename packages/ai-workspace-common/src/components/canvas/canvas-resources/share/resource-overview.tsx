import { useMemo, memo } from 'react';
import {
  useCanvasResourcesPanelStoreShallow,
  useImportResourceStoreShallow,
  type CanvasResourcesParentType,
} from '@refly/stores';
import { Button, Input, Segmented } from 'antd';
import { Add } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import { StepList } from '../step-list';
import { ResultList } from '../result-list';
import { MyUploadList } from '../my-upload';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-document';

export const ResourceOverview = memo(() => {
  const { t } = useTranslation();
  const { nodes } = useRealtimeCanvasData();
  const { createSingleDocumentInCanvas, isCreating: isCreatingDocument } = useCreateDocument();

  const { activeTab, searchKeyword, setActiveTab, setSearchKeyword } =
    useCanvasResourcesPanelStoreShallow((state) => ({
      activeTab: state.activeTab,
      searchKeyword: state.searchKeyword,
      setActiveTab: state.setActiveTab,
      setSearchKeyword: state.setSearchKeyword,
    }));
  const { setImportResourceModalVisible } = useImportResourceStoreShallow((state) => ({
    setImportResourceModalVisible: state.setImportResourceModalVisible,
  }));

  const handleNewResource = () => {
    setImportResourceModalVisible(true);
  };

  const handleNewDocument = () => {
    createSingleDocumentInCanvas();
  };

  const segmentedOptions = useMemo(() => {
    return [
      {
        label: <div className="h-5">{t('canvas.resourceLibrary.stepsRecord')}</div>,
        value: 'stepsRecord',
      },
      {
        label: <div className="h-5">{t('canvas.resourceLibrary.resultsRecord')}</div>,
        value: 'resultsRecord',
      },
      {
        label: <div className="h-5">{t('canvas.resourceLibrary.myUpload')}</div>,
        value: 'myUpload',
      },
    ];
  }, [t]);

  const hasData = useMemo(() => {
    return (
      nodes.filter((node) =>
        [
          'skillResponse',
          'document',
          'resource',
          'codeArtifact',
          'image',
          'video',
          'audio',
          'website',
        ].includes(node.type),
      ).length > 0
    );
  }, [nodes]);

  return (
    <div className="p-4 flex-grow flex flex-col gap-4 overflow-hidden">
      {!hasData ? (
        <div className="h-full flex flex-col items-center justify-center gap-4">
          <img src={EmptyImage} alt="empty" className="w-[200px] h-[200px]" />
          <div className="text-refly-text-2 text-xs leading-5">
            {t('canvas.resourceLibrary.empty')}
          </div>
          <div className="flex gap-2">
            <Button
              type="default"
              onClick={handleNewDocument}
              loading={isCreatingDocument}
              disabled={isCreatingDocument}
            >
              {t('canvas.resourceLibrary.new.document')}
            </Button>
            <Button type="primary" icon={<Add size={16} />} onClick={handleNewResource}>
              {t('canvas.resourceLibrary.new.resource')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="w-full">
            <Input
              placeholder={t('canvas.resourceLibrary.searchPlaceholder')}
              className="border border-refly-Card-Border"
              variant="filled"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
          </div>
          <Segmented
            className="w-full [&_.ant-segmented-item]:flex-1 [&_.ant-segmented-item]:text-center"
            size="middle"
            shape="round"
            style={{ width: '100%' }}
            options={segmentedOptions}
            value={activeTab}
            onChange={(value) => setActiveTab(value as CanvasResourcesParentType)}
          />

          <div className="flex-grow overflow-y-auto min-h-0">
            {activeTab === 'stepsRecord' && <StepList />}
            {activeTab === 'resultsRecord' && <ResultList />}
            {activeTab === 'myUpload' && <MyUploadList />}
          </div>
        </>
      )}
    </div>
  );
});

ResourceOverview.displayName = 'ResourceOverview';
