import { useMemo, memo } from 'react';
import {
  useCanvasResourcesPanelStoreShallow,
  useImportResourceStoreShallow,
  type CanvasResourcesParentType,
} from '@refly/stores';
import { Button, Segmented } from 'antd';
import { Add } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import { StepList } from './step-list';
import { ResultList } from './result-list';
import { MyUploadList } from './my-upload';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';

export const ResourceOverview = memo(() => {
  const { t } = useTranslation();
  const { nodes } = useRealtimeCanvasData();

  const { activeTab, setActiveTab } = useCanvasResourcesPanelStoreShallow((state) => ({
    activeTab: state.activeTab,
    setActiveTab: state.setActiveTab,
  }));
  const { setImportResourceModalVisible } = useImportResourceStoreShallow((state) => ({
    setImportResourceModalVisible: state.setImportResourceModalVisible,
  }));

  const handleNewResource = () => {
    setImportResourceModalVisible(true);
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

  return (
    <div className="p-4 flex-grow flex flex-col">
      {nodes.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center gap-4">
          <img src={EmptyImage} alt="empty" className="w-[200px] h-[200px]" />
          <div className="text-refly-text-2 text-xs leading-5">
            {t('canvas.resourceLibrary.empty')}
          </div>
          <div className="flex gap-2">
            <Button type="default">{t('canvas.resourceLibrary.new.document')}</Button>
            <Button type="primary" icon={<Add size={16} />} onClick={handleNewResource}>
              {t('canvas.resourceLibrary.new.resource')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Segmented
            className="w-full [&_.ant-segmented-item]:flex-1 [&_.ant-segmented-item]:text-center"
            size="middle"
            shape="round"
            style={{ width: '100%' }}
            options={segmentedOptions}
            value={activeTab}
            onChange={(value) => setActiveTab(value as CanvasResourcesParentType)}
          />

          <div className="flex-1 overflow-auto">
            {activeTab === 'stepsRecord' && <StepList />}
            {activeTab === 'myUpload' && <MyUploadList />}
            {activeTab === 'resultsRecord' && <ResultList />}
          </div>
        </>
      )}
    </div>
  );
});

ResourceOverview.displayName = 'ResourceOverview';
