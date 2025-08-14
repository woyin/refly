import { SkillInput } from '@refly/openapi-schema';

export function buildSummarySkillInput(params: {
  userQuestion: string;
  currentEpoch: number;
  maxEpoch: number;
  subtaskTitles?: string[];
}): SkillInput {
  const { userQuestion, currentEpoch, maxEpoch, subtaskTitles = [] } = params;

  const subtaskListSection = subtaskTitles?.length
    ? `\nCompleted subtasks: ${subtaskTitles.map((t, i) => `${i + 1}. ${t}`).join(', ')}`
    : '';

  const progressRatio = currentEpoch / Math.max(maxEpoch, 1);

  let stageFocus = '';
  if (progressRatio < 0.5) {
    stageFocus = `**EARLY STAGE**: Focus on answer completeness assessment for "${userQuestion}"`;
  } else if (progressRatio < 0.8) {
    stageFocus = `**MID STAGE**: Synthesize findings and evaluate answer reliability for "${userQuestion}"`;
  } else {
    stageFocus = `**LATE STAGE**: Finalize answer quality and prepare comprehensive progress report for "${userQuestion}"`;
  }

  const query = `SUMMARY TASK: Three-step validation and progress report

**TARGET**: "${userQuestion}"
**PROGRESS**: Epoch ${currentEpoch + 1}/${maxEpoch + 1} (${Math.round(progressRatio * 100)}% complete)${subtaskListSection}
${stageFocus}

## EXECUTION PROTOCOL

**STEP 1: DIRECT ANSWER GENERATION**
Using all available context, provide complete answer to: "${userQuestion}"
- Synthesize all relevant information 
- Include evidence citations [doc:ID], [res:ID], [artifact:ID]
- Mark confidence levels for each component

**STEP 2: ANSWER QUALITY ASSESSMENT**
Evaluate your Step 1 answer using these criteria:
- **Completeness**: What % of "${userQuestion}" answered?
- **Evidence Quality**: How reliable is supporting information?
- **Information Gaps**: What specific data is missing?
- **User Value**: How useful for user's actual needs?

**STEP 3: HUMAN-READABLE PROGRESS REPORT**
Generate clear status summary:
- **Current Answer Status**: Where we stand on "${userQuestion}"
- **Key Achievements**: What was accomplished this epoch
- **Critical Needs**: What's required for answer improvement
- **Realistic Timeline**: Expected completion outlook

## OUTPUT FORMAT

### ANSWER TO USER QUESTION
[Complete response to "${userQuestion}" with evidence citations]

### QUALITY ASSESSMENT
- **Completeness**: X% - [Explanation]
- **Evidence Strength**: [Strong/Mixed/Weak] - [Why]
- **Missing Information**: [Specific gaps]
- **Confidence Level**: [High/Medium/Low] - [Reasoning]

### EPOCH PROGRESS REPORT
**Current Status**: [Clear summary of answer quality and completeness]
**Achievements**: [Key findings with evidence citations]
**Critical Gaps**: [Specific missing information preventing complete answer]
**Next Priorities**: [What's needed to improve answer quality]
**Timeline**: [Realistic expectations for full answer completion]

**CONSTRAINT**: Use commonQnA for synthesis. Maintain absolute focus on "${userQuestion}".`;

  return { query };
}
