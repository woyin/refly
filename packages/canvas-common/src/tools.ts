import { GenericToolset } from '@refly/openapi-schema';

export const purgeToolsets = (toolsets: GenericToolset[]) => {
  if (!Array.isArray(toolsets)) {
    return [];
  }
  return toolsets.map((t) => {
    let next = { ...t };
    if (next.toolset) {
      const { definition, authData, ...safeToolset } = next.toolset;
      next = { ...next, toolset: safeToolset };
    }
    if (next.mcpServer) {
      const { headers, env, ...safeMcp } = next.mcpServer;
      next = { ...next, mcpServer: safeMcp };
    }
    return next;
  });
};
