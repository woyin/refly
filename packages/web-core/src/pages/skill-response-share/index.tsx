import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSiderStoreShallow } from '@refly/stores';
import { Result } from 'antd';
import { SimpleStepCard } from '@refly-packages/ai-workspace-common/components/slideshow/components/SimpleStepCard';
import { useFetchShareData } from '@refly-packages/ai-workspace-common/hooks/use-fetch-share-data';
import { PreviewChatInput } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/preview-chat-input';
import { ActionStep } from '@refly/openapi-schema';
import { useEffect, useCallback, useState } from 'react';
import PoweredByRefly from '../../components/common/PoweredByRefly';

const SkillResponseSharePage = () => {
  const { shareId = '' } = useParams();
  const { t } = useTranslation();
  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));
  const { data: skillResponseData, loading: isLoading } = useFetchShareData(shareId);
  const [showBranding, setShowBranding] = useState(true);

  // Force collapse by default
  useEffect(() => {
    setCollapse(true);
  }, [setCollapse]);

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    setCollapse(!collapse);
  }, [collapse, setCollapse]);

  // Handle close button click
  const handleClose = useCallback(() => {
    setShowBranding(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full w-full grow items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">
          {t('canvas.skillResponse.shareLoading', 'Loading shared skill response...')}
        </div>
      </div>
    );
  }

  if (!skillResponseData) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Result
          status="404"
          title={t('canvas.skillResponse.notFound', 'Skill Response Not Found')}
          subTitle={t(
            'canvas.skillResponse.notFoundDesc',
            'The skill response you are looking for does not exist or has been removed.',
          )}
        />
      </div>
    );
  }

  const { title, steps = [], actionMeta } = skillResponseData;

  return (
    <div className="flex h-full w-full grow relative">
      {collapse && showBranding && <PoweredByRefly onClick={toggleSidebar} onClose={handleClose} />}

      <div
        className={`absolute h-16 bottom-0 left-0 right-0 box-border flex justify-between items-center py-2 px-4 pr-0 bg-transparent ${
          collapse ? 'w-[calc(100vw-12px)]' : 'w-[calc(100vw-260px)]'
        }`}
      >
        {/* Removed the collapse button since we now use PoweredByRefly for toggling */}
      </div>

      {/* Main content */}
      <div className="flex h-full w-full grow bg-white overflow-auto dark:bg-gray-900">
        <div className="flex flex-col space-y-4 p-4 h-full max-w-[1024px] mx-auto w-full">
          {title && (
            <PreviewChatInput
              enabled={true}
              readonly={true}
              contextItems={[]}
              query={title}
              actionMeta={actionMeta}
              setEditMode={() => {}}
            />
          )}

          <div className="flex-grow">
            {steps.map((step: ActionStep, index: number) => (
              <SimpleStepCard key={step.name} step={step} index={index + 1} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillResponseSharePage;
