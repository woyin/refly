import { SkillInput } from '@refly/openapi-schema';
import { ProgressStage } from '../pilot.types';

export function buildSubtaskSkillInput(params: {
  stage: ProgressStage;
  query: string;
  locale?: string;
}): SkillInput {
  const { stage, query } = params;

  const _prompt = `ROLE:
You are executing a focused subtask as part of a larger multi-epoch plan.

Stage CONTEXT:
- Stage: "${stage.name}"
- Stage Description: "${stage.description}"
- Stage Objectives: "${stage.objectives.join(', ')}"

Finish the following subtask:
- Query: "${query}"
`;

  return { query: _prompt };
}
