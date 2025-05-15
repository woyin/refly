import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { SessionContainer } from './session-container';
import { Button, Result } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

export interface PilotPageProps {
  className?: string;
}

export const PilotPage = memo(({ className }: PilotPageProps) => {
  const { t } = useTranslation();
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const handleBack = useCallback(() => {
    navigate('/pilot');
  }, [navigate]);

  // Handle case where sessionId is missing
  if (!sessionId) {
    return (
      <Result
        status="warning"
        title={t('pilot.error.missingSessionId', { defaultValue: 'Session ID is missing' })}
        extra={
          <Button type="primary" onClick={handleBack}>
            {t('common.backToList', { defaultValue: 'Back to Sessions' })}
          </Button>
        }
      />
    );
  }

  return (
    <div className={className}>
      <div className="mb-4 flex items-center">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleBack} className="mr-2">
          {t('common.back', { defaultValue: 'Back' })}
        </Button>
        <h1 className="text-xl font-medium m-0">
          {t('pilot.sessionDetails', { defaultValue: 'Session Details' })}
        </h1>
      </div>

      <SessionContainer sessionId={sessionId} className="max-w-4xl mx-auto" />
    </div>
  );
});

PilotPage.displayName = 'PilotPage';
