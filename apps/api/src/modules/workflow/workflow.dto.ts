import { User } from '@refly/openapi-schema';

export interface SyncWorkflowJobData {
  user: User;
  resultId: string;
}

export interface RunWorkflowJobData {
  user: User;
  executionId: string;
  nodeId: string;
}

export interface InitializeWorkflowRequest {
  canvasId: string;
}

export interface InitializeWorkflowResponse {
  executionId: string;
  success: boolean;
}
