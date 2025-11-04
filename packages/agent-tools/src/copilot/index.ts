import { z } from 'zod/v3';
import { AgentBaseTool, ToolCallResult } from '../base';
import { workflowPlanSchema, normalizeWorkflowPlan } from '@refly/canvas-common';

export class GenerateWorkflow extends AgentBaseTool {
  name = 'generate_workflow';
  toolsetKey = 'copilot';

  schema = workflowPlanSchema;

  description = 'Generate a complete workflow plan';

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    const parsed = this.schema.safeParse(input);
    if (!parsed.success) {
      return {
        status: 'error',
        data: { issues: parsed.error.issues },
        summary: 'Invalid workflow plan input',
      };
    }
    try {
      return {
        status: 'success',
        data: normalizeWorkflowPlan(parsed.data),
        summary: 'Successfully generated workflow plan',
      };
    } catch (e) {
      return {
        status: 'error',
        data: { message: (e as Error)?.message },
        summary: 'Failed to generate workflow plan',
      };
    }
  }
}
