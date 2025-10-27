import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Divider, Tooltip } from 'antd';
import { History, SideLeft, NewConversation } from 'refly-icons';
import { ChatBox } from './chat-box';
import { Greeting } from './greeting';
import { SessionDetail } from './session-detail';

interface CopilotHeaderProps {
  copilotWidth: number;
  setCopilotWidth: (width: number) => void;
}

const CopilotHeader = memo(({ copilotWidth, setCopilotWidth }: CopilotHeaderProps) => {
  const { t } = useTranslation();

  const handleClose = useCallback(() => {
    if (copilotWidth === 0) {
      return;
    }

    setCopilotWidth(0);
  }, [copilotWidth, setCopilotWidth]);

  return (
    <div className="h-[46px] px-4 py-3 flex items-center gap-3 justify-between">
      <div className="text-refly-text-0 text-base font-semibold leading-[26px]">
        {t('copilot.title')}
      </div>

      <div className="flex items-center gap-3">
        <Tooltip title={t('copilot.header.history')}>
          <Button
            className="flex items-center justify-center"
            size="small"
            type="text"
            icon={<History size={18} />}
          />
        </Tooltip>

        <Tooltip title={t('copilot.header.newConversation')}>
          <Button
            className="flex items-center justify-center"
            size="small"
            type="text"
            icon={<NewConversation size={18} />}
          />
        </Tooltip>

        <Divider type="vertical" className="m-0 h-4 bg-refly-Card-Border" />

        <Tooltip title={t('copilot.header.close')}>
          <Button
            className="flex items-center justify-center"
            size="small"
            type="text"
            icon={<SideLeft size={18} />}
            onClick={handleClose}
          />
        </Tooltip>
      </div>
    </div>
  );
});

CopilotHeader.displayName = 'CopilotHeader';

interface CopilotProps {
  copilotWidth: number;
  setCopilotWidth: (width: number) => void;
}

export const Copilot = memo(({ copilotWidth, setCopilotWidth }: CopilotProps) => {
  const [query, setQuery] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);

  const handleQueryClick = useCallback((query: string) => {
    setQuery(query);
  }, []);

  console.log('sessionId', setSessionId);

  return (
    <div className="w-full h-full flex flex-col bg-refly-bg-content-z2 border-solid border-r-[1px] border-y-0 border-l-0 border-refly-Card-Border shadow-lg">
      <CopilotHeader copilotWidth={copilotWidth} setCopilotWidth={setCopilotWidth} />

      <div className="flex-grow overflow-hidden">
        {sessionId ? (
          <SessionDetail sessionId={sessionId} />
        ) : (
          <Greeting onQueryClick={handleQueryClick} />
        )}
      </div>

      <div className="w-full p-3 pt-2">
        <ChatBox query={query} setQuery={setQuery} sessionId={sessionId} />
      </div>
    </div>
  );
});

Copilot.displayName = 'Copilot';
