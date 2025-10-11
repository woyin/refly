import React, { useState, useCallback } from 'react';
import { Popover, Tooltip } from 'antd';
import type { PopoverProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { GenericToolset } from '@refly/openapi-schema';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';

interface ToolsetPopoverProps {
  toolsets: GenericToolset[];
  trigger?: React.ReactNode;
  placement?: PopoverProps['placement'];
  align?: { offset: [number, number] };
}

/**
 * Toolset Popover Component
 * Displays all toolsets in a popover when clicking "More"
 */
export const ToolsetPopover: React.FC<ToolsetPopoverProps> = ({
  toolsets,
  trigger,
  placement = 'bottomLeft',
  align = { offset: [0, 8] },
}) => {
  const { t, i18n } = useTranslation();
  const currentLanguage = (i18n.language || 'en') as 'en' | 'zh';
  const [open, setOpen] = useState(false);

  const handleOpenChange = useCallback((visible: boolean) => {
    setOpen(visible);
  }, []);

  const renderContent = useCallback(() => {
    if (!toolsets?.length) {
      return null;
    }

    return (
      <div className="flex flex-col gap-1.5 p-2">
        {toolsets.map((toolset) => {
          const description =
            toolset?.type === 'mcp'
              ? toolset.mcpServer?.url
              : toolset?.toolset?.definition?.descriptionDict?.[currentLanguage];

          const labelName =
            toolset?.type === 'regular' && toolset?.id === 'builtin'
              ? (toolset?.toolset?.definition?.labelDict?.[currentLanguage] as string)
              : toolset.name;

          const isBuiltin = toolset.id === 'builtin';

          return (
            <div
              key={toolset.id}
              className={cn(
                'flex items-center gap-3 p-2 rounded-lg hover:bg-refly-tertiary-hover',
                'cursor-pointer transition-all duration-200',
              )}
            >
              <div className="bg-refly-tertiary-default rounded-lg p-1">
                <ToolsetIcon
                  toolset={toolset}
                  isBuiltin={isBuiltin}
                  config={{
                    size: 32,
                    builtinClassName: '!w-8 !h-8',
                    className: 'rounded-lg',
                  }}
                />
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="text-sm text-refly-text-0 font-semibold block truncate leading-5">
                  {labelName || toolset.name}
                </div>
                <div className="text-xs text-refly-text-2 font-normal block truncate leading-4">
                  {description as string}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [toolsets, currentLanguage]);

  const defaultTrigger = (
    <Tooltip title={t('common.more')}>
      <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-md bg-refly-tertiary-default hover:bg-refly-tertiary-hover text-refly-text-2 text-xs cursor-pointer">
        +{toolsets.length - 5}
      </div>
    </Tooltip>
  );

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      placement={placement}
      align={align}
      trigger="click"
      arrow={false}
      styles={{ body: { padding: 0 } }}
      content={
        <div className="w-[350px] max-h-[320px] overflow-y-auto border-[1px] border-solid border-refly-Card-Border rounded-lg bg-refly-bg-content-z2 shadow-refly-m prevent-hover-action">
          {renderContent()}
        </div>
      }
    >
      {trigger || defaultTrigger}
    </Popover>
  );
};
