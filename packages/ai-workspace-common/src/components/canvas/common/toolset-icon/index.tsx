import React from 'react';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { GenericToolset } from '@refly/openapi-schema';
import { Mcp, Websearch, DocChecked, Code, Email, Time } from 'refly-icons';
import { Favicon } from '@refly-packages/ai-workspace-common/components/common/favicon';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { useListToolsetInventory } from '@refly-packages/ai-workspace-common/queries';

interface ToolsetIconConfig {
  size?: number;
  className?: string;
  builtinClassName?: string;
}

const builtinToolsetIconMap = {
  web_search: {
    icon: Websearch,
    backgroundColor: '#94F585',
  },
  generate_doc: {
    icon: DocChecked,
    backgroundColor: '#67CDFF',
  },
  generate_code_artifact: {
    icon: Code,
    backgroundColor: '#D8AEFF',
  },
  send_email: {
    icon: Email,
    backgroundColor: '#FED26A',
  },
  get_time: {
    icon: Time,
    backgroundColor: '#FF9CBD',
  },
};

/**
 * Renders an icon for a given toolset. When necessary and allowed, it will look up
 * additional toolset metadata from inventory to resolve the final domain for favicon.
 * Set disableInventoryLookup to true to avoid using react-query (e.g., outside of
 * QueryClientProvider context such as TipTap NodeViews).
 */
export const ToolsetIcon: React.FC<{
  toolset: GenericToolset;
  config?: ToolsetIconConfig;
  disableInventoryLookup?: boolean;
}> = React.memo(({ toolset, config, disableInventoryLookup }) => {
  if (!toolset) return null;

  const { size = 24, className, builtinClassName } = config ?? {};

  // MCP icons do not require inventory lookup
  if (toolset.type === 'mcp') {
    return (
      <div className={cn('flex items-center justify-center overflow-hidden', className)}>
        <Mcp size={size} color="var(--refly-text-1)" />
      </div>
    );
  }

  // Builtin icon never needs inventory lookup
  if (toolset.builtin) {
    const toolsetKey = toolset.toolset?.key;
    const builtinToolsetIcon = toolsetKey ? builtinToolsetIconMap[toolsetKey] : null;
    const IconComponent = builtinToolsetIcon?.icon ?? null;

    return (
      <div
        className={cn('flex items-center justify-center overflow-hidden', className)}
        aria-label={`Toolset icon for ${toolset.toolset?.definition?.domain ?? 'unknown domain'}`}
      >
        {IconComponent ? (
          // Handle different icon component types

          <IconComponent
            size={size}
            style={{ background: builtinToolsetIcon.backgroundColor }}
            className="rounded-md"
          />
        ) : (
          <Logo
            logoProps={{ show: true, className: builtinClassName }}
            textProps={{ show: false }}
          />
        )}
      </div>
    );
  }

  const domain = toolset.toolset?.definition?.domain ?? toolset.mcpServer?.url;
  const shouldLookup = !disableInventoryLookup && !domain && toolset.type === 'regular';

  if (shouldLookup) {
    return <ToolsetIconWithInventory toolset={toolset} size={size} className={className} />;
  }

  const finalUrl = domain ?? '';
  return (
    <div
      className={cn('flex items-center justify-center overflow-hidden', className)}
      aria-label={`Toolset icon for ${toolset.toolset?.definition?.domain ?? 'unknown domain'}`}
    >
      <Favicon url={finalUrl} size={size} />
    </div>
  );
});

interface ToolsetIconWithInventoryProps {
  toolset: GenericToolset;
  size: number;
  className?: string;
}

/**
 * Internal component that uses react-query to resolve toolset domain from inventory.
 * This component must only be rendered under QueryClientProvider.
 */
const ToolsetIconWithInventory: React.FC<ToolsetIconWithInventoryProps> = React.memo(
  ({ toolset, size, className }) => {
    const { data } = useListToolsetInventory({}, null, {
      enabled: toolset.type === 'regular',
    });
    const toolsetDefinition = data?.data?.find((t) => t.key === toolset.toolset?.key);
    const finalUrl =
      toolsetDefinition?.domain ??
      toolset.toolset?.definition?.domain ??
      toolset.mcpServer?.url ??
      '';

    return (
      <div
        className={cn('flex items-center justify-center overflow-hidden', className)}
        aria-label={`Toolset icon for ${toolset.toolset?.definition?.domain ?? 'unknown domain'}`}
      >
        <Favicon url={finalUrl} size={size} />
      </div>
    );
  },
);
