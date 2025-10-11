import { GenericToolset } from '@refly/openapi-schema';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';
import { ToolsetPopover } from './toolset-popover';

export const UsedToolsets = ({ toolsets }: { toolsets: GenericToolset[] }) => {
  if (!toolsets || toolsets?.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {toolsets.slice(0, 5).map((toolset) => (
        <div key={toolset.toolset?.toolsetId} className="rounded-md overflow-hidden">
          <ToolsetIcon
            toolset={toolset}
            isBuiltin={toolset.id === 'builtin'}
            config={{ size: 20, builtinClassName: 'rounded-full !w-5 !h-5' }}
          />
        </div>
      ))}

      {toolsets.length > 5 && (
        <div className="prevent-hover-action" onClick={(e) => e.stopPropagation()}>
          <ToolsetPopover toolsets={toolsets} />
        </div>
      )}
    </div>
  );
};
