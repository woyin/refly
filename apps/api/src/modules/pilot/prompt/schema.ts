import { z } from 'zod';

/**
 * Schema for pilot steps with workflowStage to enforce proper tool sequencing
 */
export const pilotStepSchema = z
  .object({
    name: z.string().trim().min(1).describe('A clear and concise title for the step'),
    priority: z
      .number()
      .int()
      .min(1)
      .max(5)
      .describe('Priority level from 1 (highest) to 5 (lowest)'),
    query: z
      .string()
      .trim()
      .min(1)
      .describe('The query to execute with the selected tools for this step'),
    contextItemIds: z
      .array(z.string().trim().min(1))
      .default([])
      .describe('The ID list of the relevant canvas items for this step'),
    workflowStage: z
      .enum(['research', 'analysis', 'synthesis', 'creation'])
      .describe(
        'The workflow stage this step belongs to - must follow proper sequencing: research (early) → analysis (middle) → synthesis (optional) → creation (final). ' +
          'Each stage uses specific tool types: research uses information gathering tools (web_search/library_search/scrape), analysis uses analytical tools, synthesis uses organizational tools, creation uses generation tools (generate_doc/generate_code_artifact/generate_media) only after sufficient context gathering.',
      ),
  })
  .describe('A single action step with intelligent tool selection for the pilot agent');

export const multiStepSchema = z
  .object({
    steps: z
      .array(pilotStepSchema)
      .describe('A list of task steps with intelligent tool selection for the pilot'),
  })
  .describe('A list of task steps with intelligent tool selection for the pilot');

export type PilotStepRawOutput = z.infer<typeof pilotStepSchema>;
