import type {
  ActionStatus,
  User,
  WorkflowExecution,
  WorkflowExecutionStatus,
  WorkflowNodeExecution,
} from '@refly/openapi-schema';
import {
  WorkflowExecution as WorkflowExecutionPO,
  WorkflowNodeExecution as WorkflowNodeExecutionPO,
} from '../../generated/client';
import { pick } from '@refly/utils';

type JobUser = Pick<User, 'uid'>;

export interface SyncWorkflowJobData {
  user: Pick<User, 'uid'>;
  nodeExecutionId: string;
}

export interface RunWorkflowJobData {
  user: JobUser;
  executionId: string;
  nodeId: string;
  newNodeId?: string; // New node ID for new canvas mode
}

export interface InitializeWorkflowResponse {
  executionId: string;
  success: boolean;
}

export const workflowNodeExecutionPO2DTO = (
  nodeExecution: WorkflowNodeExecutionPO,
): WorkflowNodeExecution => {
  return {
    ...pick(nodeExecution, ['nodeExecutionId', 'nodeId', 'newEntityId', 'title', 'progress']),
    status: nodeExecution.status as ActionStatus,
    createdAt: nodeExecution.createdAt.toJSON(),
    updatedAt: nodeExecution.updatedAt.toJSON(),
  };
};

export const workflowExecutionPO2DTO = (
  execution: WorkflowExecutionPO & { nodeExecutions?: WorkflowNodeExecutionPO[] },
): WorkflowExecution => {
  return {
    ...pick(execution, ['executionId', 'canvasId', 'title']),
    status: execution.status as WorkflowExecutionStatus,
    nodeExecutions: execution.nodeExecutions?.map(workflowNodeExecutionPO2DTO),
    createdAt: execution.createdAt.toJSON(),
    updatedAt: execution.updatedAt.toJSON(),
  };
};
