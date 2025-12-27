import { memo, useMemo } from 'react';
import { GenericToolset } from '@refly/openapi-schema';
import { UsedToolsets } from '@refly-packages/ai-workspace-common/components/workflow-list/used-toolsets';

export const UsedTools = memo(({ usedTools }: { usedTools?: string }) => {
  // Convert tool names (string[]) to GenericToolset[] format
  const toolsets = useMemo((): GenericToolset[] => {
    if (!usedTools) return [];
    try {
      const parsed = JSON.parse(usedTools) as string[];
      if (!Array.isArray(parsed)) return [];

      return parsed.map((toolName) => ({
        id: toolName,
        name: toolName,
        type: 'regular' as const,
        builtin: true,
      }));
    } catch {
      return [];
    }
  }, [usedTools]);

  if (toolsets.length === 0) {
    return <span className="text-gray-400">-</span>;
  }

  return <UsedToolsets toolsets={toolsets} />;
});

UsedTools.displayName = 'UsedTools';
