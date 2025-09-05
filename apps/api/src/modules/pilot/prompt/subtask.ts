import { SkillInput } from '@refly/openapi-schema';
import { ProgressStage } from '../pilot.types';

export function buildSubtaskSkillInput(params: {
  stage: ProgressStage;
  query: string;
  context?: string;
  scope?: string;
  outputRequirements?: string;
  locale?: string;
}): SkillInput {
  const { stage, query, context, scope, outputRequirements } = params;

  const _prompt = `ROLE:
You are executing a focused subtask as part of a larger multi-epoch plan.

Stage CONTEXT:
- Stage: "${stage.name}"
- Stage Description: "${stage.description}"
- Stage Objectives: "${stage.objectives.join(', ')}"

Subtask CONTEXT:
- Context: "${context || 'No specific context provided'}"
- Scope: "${scope || 'No specific scope defined'}"
- Output Requirements: "${outputRequirements || 'No specific output requirements'}"

Finish the following subtask:
- Query: "${query}"
`;

  return { query: _prompt };
}
