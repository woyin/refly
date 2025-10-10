import { WorkflowApp } from '@refly/openapi-schema';
import { HoverCardContainer } from '@refly-packages/ai-workspace-common/components/common/hover-card';
import { Button } from 'antd';
import { time } from '@refly-packages/ai-workspace-common/utils/time';
import { LOCALE } from '@refly/common-types';
import { useTranslation } from 'react-i18next';
import { WiTime3 } from 'react-icons/wi';
import { AiOutlineUser } from 'react-icons/ai';
import { useNavigate } from 'react-router-dom';

export const AppCard = ({ data, onDelete }: { data: WorkflowApp; onDelete?: () => void }) => {
  const { i18n, t } = useTranslation();
  const language = i18n.languages?.[0];
  const navigate = useNavigate();

  const handleUnpublish = () => {
    console.log('unpublish');
    onDelete?.();
  };

  const handleView = () => {
    navigate(`/app/${data.appId}`);
  };

  const actionContent = (
    <>
      <Button type="primary" onClick={handleView} className="flex-1">
        {t('appManager.view')}
      </Button>
      <Button type="default" onClick={handleUnpublish} className="flex-1">
        {t('appManager.unpublish')}
      </Button>
    </>
  );

  return (
    <HoverCardContainer actionContent={actionContent}>
      <div className="flex flex-col justify-between border-[1px] border-solid border-refly-Card-Border rounded-xl bg-refly-bg-content-z2 hover:shadow-refly-m cursor-pointer overflow-hidden">
        <div className="h-40 bg-gray-100 dark:bg-gray-700 flex items-center justify-center" />
        <div className="p-4 flex-1 flex flex-col gap-5">
          <div className="text-sm font-semibold truncate">{data.title}</div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm text-refly-text-2 flex-1 min-w-0">
              <AiOutlineUser className="w-4 h-4 text-refly-text-2 flex-shrink-0" />
              <span className="truncate">用户名</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-refly-text-2 flex-shrink-0">
              <WiTime3 className="w-4 h-4 text-refly-text-2" />
              <span className="whitespace-nowrap">
                {time(data.updatedAt, language as LOCALE)
                  ?.utc()
                  ?.fromNow()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </HoverCardContainer>
  );
};
