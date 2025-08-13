import type { SkillInput } from '@refly/openapi-schema';

/**
 * Build the SkillInput for Summary step.
 * Focus on summarizing current epoch subtasks and evaluating progress against user question.
 */
export function buildSummarySkillInput(params: {
  userQuestion: string;
  currentEpoch: number;
  maxEpoch: number;
  subtaskTitles?: string[];
}): SkillInput {
  const { userQuestion, currentEpoch, maxEpoch, subtaskTitles = [] } = params;

  // Optional section listing subtask titles to help the model focus
  const subtaskListSection = subtaskTitles?.length
    ? `\n- Subtasks in this epoch:\n${subtaskTitles.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}`
    : '';

  // Calculate progress ratio for stage-specific guidance
  const progressRatio = currentEpoch / Math.max(maxEpoch, 1);

  // Generate stage-specific focus based on progress
  let stageFocus = '';
  if (progressRatio < 0.5) {
    stageFocus = `
## EARLY STAGE SUMMARY FOCUS
- Evaluate the quality and coverage of information gathered so far
- Identify critical gaps that may affect the final answer to: "${userQuestion}"
- Assess if the research direction aligns with user's core question dependencies
- Recommend specific areas for deeper investigation in subsequent epochs`;
  } else if (progressRatio < 0.8) {
    stageFocus = `
## MID-STAGE ANALYSIS FOCUS  
- Synthesize patterns, contradictions, and insights from gathered information
- Evaluate information reliability and cross-reference findings
- Identify the most promising approaches to answer: "${userQuestion}"
- Plan the structure and key components for final deliverables`;
  } else {
    stageFocus = `
## LATE-STAGE SYNTHESIS FOCUS
- Organize findings into coherent frameworks ready for final output creation
- Ensure all critical dependencies for "${userQuestion}" are adequately addressed
- Draft comprehensive outlines for documents, reports, or deliverables
- Validate that gathered evidence supports robust conclusions`;
  }

  // Optimized prompt for enhanced Agent with tool-driven analysis
  const query = `Perform a comprehensive epoch analysis with strategic, dependency-first evaluation focused on the user's original question.

**Context:**
Original user goal: "${userQuestion}"
Current epoch: ${currentEpoch + 1}/${maxEpoch + 1} (${Math.round(progressRatio * 100)}% complete)${subtaskListSection}

${stageFocus}

## TOOL USAGE STRATEGY FOR SUMMARY ANALYSIS

### Core Principle: Focused, Question-Aligned Analysis
- REQUIRED: Use primarily commonQnA for comprehensive synthesis and analysis
- STRATEGY: Focus on analyzing existing context rather than extensive new research
- AVOID: Extensive information gathering unless absolutely necessary for answering the user's question

## USER QUESTION ALIGNMENT ANALYSIS

**Target Question**: "${userQuestion}"

### Critical Evaluation Framework:
1. **Dependency Coverage**: Are all prerequisite facts needed to answer the user's question adequately covered?
2. **Information Quality**: Is the gathered information reliable, current, and directly relevant to the user's specific needs?
3. **Gap Assessment**: What specific information is still missing to provide a complete answer?
4. **Answer Readiness**: Based on current findings, can we confidently address the user's original question?

### Required Analysis Process:
- Map each piece of gathered information to specific components of the user's question
- Identify which aspects of the user's question remain unresolved or inadequately addressed
- Prioritize remaining work based on criticality to delivering the final answer
- Assess confidence levels for different aspects of the potential answer

## STRUCTURED OUTPUT REQUIREMENTS

Your analysis must include these sections in structured Markdown format:

### 1. EPOCH ACHIEVEMENTS SUMMARY
- Key findings and deliverables from completed subtasks with clear evidence
- Achievement quality assessment with proper citations [doc:ID], [res:ID], [artifact:ID]
- Documented risks, uncertainties, and open questions

### 2. USER QUESTION ALIGNMENT ASSESSMENT  
- Detailed evaluation of how current findings address the original question: "${userQuestion}"
- Specific gaps that prevent complete answer delivery to the user
- Confidence level assessment for different aspects of the potential final answer

### 3. INFORMATION QUALITY AND RELIABILITY EVALUATION
- Source credibility and reliability assessment
- Cross-validation status of key facts and claims
- Identified contradictions, uncertainties, or conflicting information

### 4. STRATEGIC RECOMMENDATIONS FOR NEXT PHASE
- Priority areas requiring attention in subsequent epochs (if applicable)
- Specific research directions needed to close critical gaps affecting the user's question
- Risk assessment for timeline and deliverable quality

### 5. ACTIONABLE NEXT STEPS PLANNING
- Concrete actions needed to progress toward answering the user's question
- Resource allocation recommendations for optimal efficiency
- Success criteria and milestones for subsequent work phases

**Quality Standards:**
- All analysis must be evidence-based with proper source citations
- Maintain unwavering focus on the user's original question: "${userQuestion}"
- Provide actionable, specific recommendations rather than generic suggestions
- Ensure complete transparency in information gathering process and source reliability assessment
- Prioritize information and analysis that directly serves the user's question dependencies`;

  return { query };
}
