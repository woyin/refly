import type { SkillInput } from '@refly/openapi-schema';

/**
 * Build the SkillInput for Summary step.
 * The prompt itself is in English, while the required output language follows locale.
 */
export function buildSummarySkillInput(params: {
  userQuestion: string;
  currentEpoch: number;
  maxEpoch: number;
  locale?: string;
  subtaskTitles?: string[];
}): SkillInput {
  const { userQuestion, currentEpoch, maxEpoch, locale, subtaskTitles = [] } = params;

  // Normalize display locale; default to en-US if not provided
  const displayLocale = locale ?? 'en-US';

  // Optional section listing subtask titles to help the model focus
  const subtaskListSection = subtaskTitles?.length
    ? `\n- Subtasks in this epoch:\n${subtaskTitles.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}`
    : '';

  // English prompt with strict instructions to output in locale
  const query = `ROLE:
You are a world-class prompt engineer and agent engineer.

OBJECTIVE:
Given the runtime-provided context (context + resultHistory) and the original user goal, generate:
1) A phase structured report in human-readable Markdown summarizing the current epoch outputs.
2) A multi-dimensional gap analysis against the original goal and an actionable next-epoch plan.

OUTPUT LANGUAGE:
Write the entire output in ${displayLocale}. Do not use any other language.

INPUTS:
- Original user goal (userQuestion): "${userQuestion}"
- Current epoch: ${currentEpoch + 1}/${maxEpoch + 1}
- Context usage policy: read from provided context (resources/documents/codeArtifacts/contentList) and resultHistory (previous skill responses). When citing evidence, include their IDs like [doc:ID], [res:ID], [artifact:ID], or [result:ID] for traceability.${subtaskListSection}

REQUIRED OUTPUTS (Markdown):
1) Phase Structured Report
   - Title
   - Executive Summary (3-6 bullet points)
   - Key Findings & Conclusions (grouped by topic; each key statement must cite evidence IDs)
   - Deliverables Produced (documents/code/intermediate results with their IDs)
   - Risks & Uncertainties
   - Open Questions & Pending Hypotheses
2) Gap Analysis & Next-Epoch Plan
   - Alignment with the original goal (coverage, depth, timeliness, reliability, contradictions, completeness)
   - Missing Information List (e.g., missing topics/data/validation/comparisons/sources)
   - Next-Epoch Action Plan (prioritized): for each action, provide
     * Suggested tool (one of: webSearch, librarySearch, commonQnA, generateDoc, codeArtifacts, generateMedia)
     * A focused query
     * Expected context types/IDs to reference or collect
   - Decision: Are we ready to produce the final output? (Yes/No + rationale)
   - Subtask-Summary loop optimizations (how to organize subtasks, parallel vs sequential, prompt parameters/model choices, evaluation criteria)

CONSTRAINTS:
- Only infer from the available context/history; explicitly mark unknowns.
- Every important conclusion must cite evidence IDs.
- Use clear headings and subsections to maximize readability for humans.

FINAL NOTE:
End with a concise Decision Highlights section (3-5 bullets).`;

  return { query };
}
