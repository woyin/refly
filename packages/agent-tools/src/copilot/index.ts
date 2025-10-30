import { z } from 'zod/v3';
import { AgentBaseTool, ToolCallResult } from '../base';
import { workflowPlanSchema } from '@refly/canvas-common';

export class GenerateWorkflow extends AgentBaseTool {
  name = 'generate_workflow';
  toolsetKey = 'copilot';

  schema = workflowPlanSchema;

  description = 'Generate a complete workflow plan';

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    return {
      status: 'success',
      data: input,
      summary: 'Successfully generated workflow plan',
    };
  }
}
