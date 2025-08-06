import { useMemo } from 'react';
import { useImportResourceStoreShallow, type CanvasResourcesParentType } from '@refly/stores';
import { Button, Segmented } from 'antd';
import { useTranslation } from 'react-i18next';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import { Add } from 'refly-icons';

const StepsList = () => {
  return <div>StepsList</div>;
};

const MyUploadList = () => {
  return <div>MyUploadList</div>;
};

const ResultList = () => {
  return <div>ResultList</div>;
};

interface ResourceOverviewProps {
  activeTab: CanvasResourcesParentType;
  setActiveTab: (tab: CanvasResourcesParentType) => void;
}

export const ResourceOverview = ({ activeTab, setActiveTab }: ResourceOverviewProps) => {
  const { t } = useTranslation();
  const showEmpty = true;
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
        label: t('canvas.resourceLibrary.myUploads'),
        value: 'myUpload',
      },
    ];
  }, [t]);

  return (
    <div className="p-4 flex-grow flex flex-col">
      {showEmpty ? (
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
            {activeTab === 'stepsRecord' && <StepsList />}
            {activeTab === 'myUpload' && <MyUploadList />}
            {activeTab === 'resultsRecord' && <ResultList />}
          </div>
        </>
      )}
    </div>
  );
};
