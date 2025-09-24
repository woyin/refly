import { useMemo, memo, useEffect, useRef, useCallback } from 'react';
import {
  useCanvasResourcesPanelStoreShallow,
  useImportResourceStoreShallow,
  type CanvasResourcesParentType,
} from '@refly/stores';
import { Button, Input, Segmented } from 'antd';
import { Add, Cancelled } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import { StepList } from '../step-list';
import { ResultList } from '../result-list';
import { MyUploadList } from '../my-upload';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';
import { useCreateDocument } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-document';
import { useListResources } from '@refly-packages/ai-workspace-common/queries/queries';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';

export const ResourceOverview = memo(() => {
  const { t } = useTranslation();
  const { nodes } = useRealtimeCanvasData();
  const { canvasId } = useCanvasContext();
  const { projectId } = useGetProjectCanvasId();
  const { createSingleDocumentInCanvas, isCreating: isCreatingDocument } = useCreateDocument();

  const {
    data: resourcesData,
    isLoading: isLoadingResources,
    refetch: refetchResources,
  } = useListResources({
    query: {
      canvasId,
      projectId,
    },
  });
  const resources = resourcesData?.data ?? [];
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    pollingIntervalRef.current = setInterval(() => {
      refetchResources();
    }, 2000);
  }, [refetchResources]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const shouldPoll = resources.some(
      (resource) => resource.indexStatus === 'wait_parse' || resource.indexStatus === 'wait_index',
    );

    if (shouldPoll && !pollingIntervalRef.current) {
      startPolling();
    } else if (!shouldPoll && pollingIntervalRef.current) {
      stopPolling();
    }

    // Cleanup on unmount
    return () => {
      stopPolling();
    };
  }, [resources, startPolling, stopPolling]);

  const { searchKeyword, setSearchKeyword, parentType, activeTab, setActiveTab } =
    useCanvasResourcesPanelStoreShallow((state) => ({
      activeTab: state.activeTab,
      searchKeyword: state.searchKeyword,
      setActiveTab: state.setActiveTab,
      setSearchKeyword: state.setSearchKeyword,
      parentType: state.parentType,
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
        label: t('canvas.resourceLibrary.stepsRecord'),
        value: 'stepsRecord',
      },
      {
        label: t('canvas.resourceLibrary.resultsRecord'),
        value: 'resultsRecord',
      },
      {
        label: t('canvas.resourceLibrary.myUpload'),
        value: 'myUpload',
      },
    ];
  }, [t]);

  // Get tip text based on active tab
  const getTipText = useMemo(() => {
    switch (activeTab) {
      case 'stepsRecord':
        return t('canvas.resourceLibrary.tip.stepsRecord');
      case 'resultsRecord':
        return t('canvas.resourceLibrary.tip.resultsRecord');
      case 'myUpload':
        return t('canvas.resourceLibrary.tip.myUpload');
      default:
        return t('canvas.resourceLibrary.tip.resultsRecord');
    }
  }, [activeTab, t]);

  const hasData = useMemo(() => {
    if (isLoadingResources) {
      return true;
    }

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
      ).length > 0 || resources.length > 0
    );
  }, [nodes, isLoadingResources, resources]);

  useEffect(() => {
    if (parentType) {
      setActiveTab(parentType);
    }
  }, [parentType, setActiveTab]);

  return (
    <div className="p-4 flex-grow flex flex-col gap-4 overflow-hidden">
      {isLoadingResources ? (
        <div className="h-full flex flex-col items-center justify-center gap-4">
          <div className="text-refly-text-2 text-sm leading-5">{t('common.loading')}</div>
        </div>
      ) : !hasData ? (
        <div className="h-full flex flex-col items-center justify-center gap-4">
          <img src={EmptyImage} alt="empty" className="w-[200px] h-[200px]" />
          <div className="text-refly-text-2 text-sm leading-5">
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
            shape="round"
            options={segmentedOptions}
            value={activeTab}
            onChange={(value) => setActiveTab(value as CanvasResourcesParentType)}
          />

          {/* Info tip module */}
          <div className="flex items-center gap-2 w-full p-2 px-3 rounded-xl bg-gradient-to-br from-[rgba(31,201,150,0.10)] via-[rgba(31,201,150,0.08)] to-[rgba(69,190,255,0.06)] dark:from-[rgba(31,201,150,0.15)] dark:via-[rgba(31,201,150,0.12)] dark:to-[rgba(69,190,255,0.10)] border border-[rgba(31,201,150,0.15)] dark:border-[rgba(31,201,150,0.25)] bg-white dark:bg-[var(--bg-refly-bg-body-z0,#1a1a1a)]">
            <div className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center">
              <Cancelled
                size={16}
                color="var(--text-icon-refly-text-1,rgba(28,31,35,0.80))"
                className="dark:text-[rgba(255,255,255,0.85)]"
              />
            </div>

            <div className="text-[var(--text-refly-text-1,#1C1F23)] dark:text-[rgba(255,255,255,0.85)] text-xs leading-[1.83]">
              {getTipText}
            </div>
          </div>

          {/* block */}
          <div className="flex-grow overflow-y-auto min-h-0">
            {activeTab === 'stepsRecord' && <StepList />}
            {activeTab === 'resultsRecord' && <ResultList />}
            {activeTab === 'myUpload' && <MyUploadList resources={resources} />}
          </div>
        </>
      )}
    </div>
  );
});

ResourceOverview.displayName = 'ResourceOverview';
