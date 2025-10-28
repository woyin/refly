import { z } from 'zod/v3';
import { AgentBaseTool, ToolCallResult } from '../base';
import { ReflyService } from '../builtin/interface';
import { User } from '@refly/openapi-schema';

interface BuiltinToolParams {
  user: User;
  reflyService: ReflyService;
}

export class GenerateWorkflow extends AgentBaseTool<BuiltinToolParams> {
  name = 'generate_workflow';
  toolsetKey = 'copilot';

  schema = z.object({
    tasks: z
      .array(
        z.object({
          id: z.string().describe('Unique identifier for the task'),
          title: z.string().describe('Display title of the task'),
          prompt: z.string().describe('The prompt or instruction for this task'),
          contextItems: z.array(z.any()).describe('Context items associated with this task'),
          selectedToolsets: z.array(z.any()).describe('Toolsets selected for this task'),
        }),
      )
      .describe('Array of workflow tasks to be executed'),
    variables: z
      .array(
        z.object({
          name: z.string().describe('Variable name used in the workflow'),
          type: z.string().describe('Data type of the variable (e.g., string, number, boolean)'),
          description: z.string().describe('Description of what this variable represents'),
        }),
      )
      .describe('Array of variables defined for the workflow'),
  });

  description = 'Save a complete workflow DSL directly without further processing';

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    return {
      status: 'success',
      data: input,
      summary: 'Successfully performed workflow DSL generation',
    };
  }
}
