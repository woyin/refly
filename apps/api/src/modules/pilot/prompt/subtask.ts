import { SkillInput } from '@refly/openapi-schema';

export function buildSubtaskSkillInput(params: {
  userQuestion: string;
  query: string;
  locale?: string;
}): SkillInput {
  const { userQuestion, query } = params;

  const prompt = `ROLE:
You are executing a focused subtask as part of a larger multi-epoch plan.

GOAL CONTEXT:
- Original user goal: "${userQuestion}"

THIS SUBTASK:
- Query: "${query}"

REQUIREMENTS:
1) Stay strictly within the scope of this subtask
2) Produce a focused result that addresses the specific query
3) If information is missing, explicitly state what is missing
4) Keep the output concise and actionable

EXPECTED OUTPUT (Markdown):
- Brief Objective
- Method & Approach
- Findings / Result
- Limitations / Open Issues`;

  return { query: prompt };
}
