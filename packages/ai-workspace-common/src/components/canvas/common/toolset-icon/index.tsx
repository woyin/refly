import React from 'react';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { GenericToolset } from '@refly/openapi-schema';
import { Mcp } from 'refly-icons';
import { Favicon } from '@refly-packages/ai-workspace-common/components/common/favicon';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';

interface ToolsetIconConfig {
  size?: number;
  className?: string;
  builtinClassName?: string;
}

export const ToolsetIcon: React.FC<{
  toolset: GenericToolset;
  isBuiltin?: boolean;
  config?: ToolsetIconConfig;
}> = React.memo(({ toolset, config, isBuiltin }) => {
  const { size = 24, className, builtinClassName } = config ?? {};

  if (toolset.type === 'mcp') {
    return (
      <div className={cn('flex items-center justify-center overflow-hidden', className)}>
        <Mcp size={size} color="var(--refly-text-1)" />
      </div>
    );
  }

  return (
    <div
      className={cn('flex items-center justify-center overflow-hidden', className)}
      aria-label={`Toolset icon for ${toolset.toolset?.definition?.domain ?? 'unknown domain'}`}
    >
      {isBuiltin ? (
        <Logo logoProps={{ show: true, className: builtinClassName }} textProps={{ show: false }} />
      ) : (
        <Favicon url={toolset.toolset?.definition?.domain ?? ''} size={size} />
      )}
    </div>
  );
});
