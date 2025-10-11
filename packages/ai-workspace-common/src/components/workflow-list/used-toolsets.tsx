import { GenericToolset } from '@refly/openapi-schema';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';
import { ToolsetPopover } from './toolset-popover';

const MAX_TOOLSETS = 4;

export const UsedToolsets = ({ toolsets }: { toolsets: GenericToolset[] }) => {
  if (!toolsets || toolsets?.length === 0) {
    return null;
  }

  return (
    <ToolsetPopover toolsets={toolsets}>
      <div
        className="w-fit flex flex-wrap gap-2 prevent-hover-action hover:bg-refly-bg-control-z0 rounded-md p-1 -ml-1"
        onClick={(e) => e.stopPropagation()}
      >
        {toolsets.slice(0, MAX_TOOLSETS).map((toolset) => (
          <div key={toolset.toolset?.toolsetId} className="rounded-md overflow-hidden">
            <ToolsetIcon
              toolset={toolset}
              isBuiltin={toolset.id === 'builtin'}
              config={{ size: 20, builtinClassName: 'rounded-full !w-5 !h-5' }}
            />
          </div>
        ))}

        {toolsets.length > MAX_TOOLSETS && (
          <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-md bg-refly-tertiary-default hover:bg-refly-tertiary-hover text-refly-text-2 text-xs cursor-pointer">
            +{toolsets.length - MAX_TOOLSETS}
          </div>
        )}
      </div>
    </ToolsetPopover>
  );
};
