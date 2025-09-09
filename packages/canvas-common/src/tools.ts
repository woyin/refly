import { GenericToolset } from '@refly/openapi-schema';

export const purgeToolsets = (toolsets: GenericToolset[]) => {
  if (!Array.isArray(toolsets)) {
    return [];
  }
  return toolsets.map((toolset) => {
    if (toolset.toolset?.definition) {
      const { definition, ...toolsetWithoutDefinition } = toolset.toolset;
      return {
        ...toolset,
        toolset: toolsetWithoutDefinition,
      };
    }
    return toolset;
  });
};
