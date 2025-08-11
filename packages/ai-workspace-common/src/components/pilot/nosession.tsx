import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import cn from 'classnames';
// import { Skeleton } from 'antd';
// import { SessionChat } from './session-chat';
import { ChatModeSelector } from '@refly-packages/ai-workspace-common/components/canvas/front-page/chat-mode-selector';
import { Mcp } from 'refly-icons';
import { Button, Tooltip } from 'antd';

/**
 * NoSession
 * UI shown when there is no active pilot session.
 * Layout and styling are referenced from `canvas/front-page/index.tsx`.
 */
export const NoSession = memo(({ canvasId }: { canvasId: string }) => {
  const { t } = useTranslation();
  console.log('canvasId', canvasId);
  return (
    <div className={cn('flex bg-refly-bg-content-z2 overflow-y-auto rounded-lg')}>
      <div className={cn('relative w-full max-w-4xl mx-auto z-10', 'flex flex-col justify-center')}>
        <div className="w-full h-full rounded-[12px] shadow-refly-m overflow-hidden">
          <div className="p-4">
            <div className="w-full rounded-[12px] h-[96px] shadow-refly-m overflow-hidden border-[1px] border border-solid border-refly-primary-default ">
              <div className="pl-4 pt-3 pr-4 pb-3 h-[52px]">
                <div className="flex items-center gap-2 text-[#6b7280] text-[16px]">
                  给 Refly 一个任务，它会智能分析和规划，并帮你完成任务...
                </div>
              </div>
              <div className="flex pl-4">
                <ChatModeSelector chatMode="agent" setChatMode={() => {}} />
                <Tooltip title={t('copilot.mcpSelector.useMcpServers')} placement="bottom">
                  <Button
                    className="gap-0 h-7 w-7 flex items-center justify-center"
                    type="text"
                    size="small"
                    icon={<Mcp size={20} className="flex items-center" />}
                  >
                    {/* <span className="text-refly-text-2 text-xs font-semibold ml-[2px]">
                      {selectedMcpServers?.length > 0 ? selectedMcpServers.length : ''}
                    </span> */}
                  </Button>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

NoSession.displayName = 'NoSession';
