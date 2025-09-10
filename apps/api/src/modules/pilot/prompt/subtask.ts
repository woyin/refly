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
  return { query: params.query };
}
