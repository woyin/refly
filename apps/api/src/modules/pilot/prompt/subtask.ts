import type { SkillInput } from '@refly/openapi-schema';

/**
 * Build the SkillInput for a subtask step.
 * The prompt itself is in English, while the required output language follows locale.
 * It leverages last epoch's Summary as authoritative guidance to keep the subtask focused and verifiable.
 */
export function buildSubtaskSkillInput(params: {
  userQuestion: string;
  locale?: string;
  summaryTitle?: string; // optional: last epoch summary title for reference
  plannedAction?: {
    priority?: number;
    skillName?:
      | 'webSearch'
      | 'librarySearch'
      | 'commonQnA'
      | 'generateDoc'
      | 'codeArtifacts'
      | 'generateMedia';
    query?: string; // planner's suggested query for this subtask
    contextHints?: string[]; // planner's hints on what context to use/collect
  };
}): SkillInput {
  const { userQuestion, locale, summaryTitle, plannedAction } = params;

  const displayLocale = locale ?? 'en-US';

  const plannedSkill = plannedAction?.skillName ?? 'commonQnA';
  const plannedQuery = plannedAction?.query ?? '';
  const plannedContextHints = plannedAction?.contextHints ?? [];

  const hintsSection = plannedContextHints.length
    ? `- Context hints: ${plannedContextHints.join('; ')}`
    : '- Context hints: (none)';

  const summaryRef = summaryTitle
    ? `- Use the latest Summary titled: "${summaryTitle}" as the primary guidance.\n`
    : '';

  const query = `ROLE:
You are executing a focused subtask as part of a larger multi-epoch plan.

OUTPUT LANGUAGE:
Write the entire output in ${displayLocale}. Do not use any other language.

GOAL CONTEXT:
- Original user goal: "${userQuestion}"
${summaryRef}- Rely on runtime-provided context and resultHistory. Cite evidence IDs for key statements.

THIS SUBTASK (execution-ready):
- Suggested tool: ${plannedSkill}
- Suggested query: ${plannedQuery || '(to be refined precisely by you)'}
${hintsSection}

REQUIREMENTS:
1) Stay strictly within the scope of this subtask and the plan from the latest Summary
2) Produce a result that can be directly aggregated by the next Summary step
3) Cite evidence IDs in-line for important claims
4) If information is missing, explicitly state what is missing and propose a minimal next step

EXPECTED OUTPUT (Markdown):
- Brief Objective
- Method & Assumptions (with evidence citations)
- Findings / Result (with evidence citations)
- Limitations / Open Issues
- Next Minimal Step (if needed)

QUALITY GUARD:
- Checklist:
  * Evidence cited for key claims
  * Output language is exactly ${displayLocale}
  * Scope limited to this subtask
  * Result is easily aggregatable by Summary
`;

  return { query };
}
