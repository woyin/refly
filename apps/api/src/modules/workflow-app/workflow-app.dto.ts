import { WorkflowApp } from '@refly/openapi-schema';
import { WorkflowApp as WorkflowAppPO } from '../../generated/client';
import { safeParseJSON } from '@refly/utils';

export function workflowAppPO2DTO(app: WorkflowAppPO): WorkflowApp | null {
  if (!app) {
    return null;
  }

  return {
    appId: app.appId,
    // IMPORTANT: Include shareId in response for frontend URL generation
    // This allows frontend to use shareId for direct static file access
    shareId: app.shareId ?? undefined,
    title: app.title ?? undefined,
    description: app.description ?? undefined,
    canvasId: app.canvasId ?? '',
    query: app.query ?? undefined,
    variables: safeParseJSON(app.variables),
    createdAt: app.createdAt?.toISOString(),
    updatedAt: app.updatedAt?.toISOString(),
  };
}
