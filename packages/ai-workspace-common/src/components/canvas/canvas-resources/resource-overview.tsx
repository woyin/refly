import { useMemo } from 'react';
import { CanvasResourcesParentType } from './canvas-resources-header';
import { Segmented } from 'antd';
import { useTranslation } from 'react-i18next';

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

  const segmentedOptions = useMemo(() => {
    return [
      {
        label: t('canvas.resourceLibrary.stepsRecord'),
        value: 'stepsRecord',
      },
      {
        label: t('canvas.resourceLibrary.myUploads'),
        value: 'myUpload',
      },
      {
        label: t('canvas.resourceLibrary.resultsRecord'),
        value: 'resultsRecord',
      },
    ];
  }, [t]);

  return (
    <div className="p-4 flex-1 overflow-hidden flex flex-col">
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
    </div>
  );
};
