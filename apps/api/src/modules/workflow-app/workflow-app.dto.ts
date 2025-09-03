import { WorkflowApp, WorkflowVariable } from '@refly/openapi-schema';
import { WorkflowApp as WorkflowAppPO } from '../../generated/client';

export function workflowAppPO2DTO(dbWorkflowApp: WorkflowAppPO): WorkflowApp | null {
  if (!dbWorkflowApp) {
    return null;
  }

  // Parse variables from JSON string to WorkflowVariable array
  let variables: WorkflowVariable[] = [];
  try {
    if (dbWorkflowApp.variables) {
      variables = JSON.parse(dbWorkflowApp.variables) as WorkflowVariable[];
    }
  } catch (error) {
    this.logger.warn(
      `Failed to parse variables for workflow app ${dbWorkflowApp.workflowAppId}:`,
      error,
    );
    variables = [];
  }

  return {
    appId: dbWorkflowApp.workflowAppId,
    title: dbWorkflowApp.title ?? undefined,
    description: dbWorkflowApp.description ?? undefined,
    canvasId: dbWorkflowApp.canvasId ?? '',
    query: dbWorkflowApp.query ?? undefined,
    variables,
    createdAt: dbWorkflowApp.createdAt?.toISOString(),
    updatedAt: dbWorkflowApp.updatedAt?.toISOString(),
  };
}
