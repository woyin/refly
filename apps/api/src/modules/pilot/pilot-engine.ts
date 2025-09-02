import { Logger } from '@nestjs/common';
import { BaseChatModel } from '@refly/providers';
import { extractJsonFromMarkdown } from '@refly/utils';
import { CanvasContentItem } from '../canvas/canvas.dto';
import { PilotSession, PilotStep, GenericToolset } from '@refly/openapi-schema';
import { multiStepSchema, PilotStepRawOutput } from './prompt/schema';
import {
  generatePlanningPrompt,
  generateFallbackPrompt,
  getRecommendedStageForEpoch,
} from './prompt';
import { MAX_EPOCH, MAX_STEPS_PER_EPOCH } from './pilot.service';
import { ProgressPlan, ProgressStage } from './pilot.types';

export class PilotEngine {
  private logger = new Logger(PilotEngine.name);

  constructor(
    private readonly model: BaseChatModel,
    private readonly session: PilotSession,
    private readonly steps: PilotStep[],
    private readonly progressPlan?: ProgressPlan,
  ) {}

  async run(
    contentItems: CanvasContentItem[],
    toolsets: GenericToolset[],
    maxStepsPerEpoch = MAX_STEPS_PER_EPOCH,
    locale?: string,
  ): Promise<PilotStepRawOutput[]> {
    const sessionInput = this.session.input;
    const userQuestion = sessionInput.query;

    try {
      if (!userQuestion) {
        this.logger.warn('No user question provided for research planning');
        return [];
      }

      // If we have a progress plan, use it for execution
      if (this.progressPlan) {
        return this.runWithProgressPlan(contentItems, toolsets, maxStepsPerEpoch, locale);
      }

      // Fallback to original logic for backward compatibility
      // Get the current epoch information
      const currentEpoch = this.session?.currentEpoch ?? 0;
      const totalEpochs = this.session?.maxEpoch ?? MAX_EPOCH;
      const recommendedStage = getRecommendedStageForEpoch(currentEpoch, totalEpochs);

      if (currentEpoch > totalEpochs) {
        this.logger.warn('Current epoch exceeds total epochs');
        return [];
      }

      this.logger.log(
        `Planning research steps for "${userQuestion}" with ${contentItems.length} content items. ` +
          `Current epoch: ${currentEpoch + 1}/${totalEpochs + 1}, recommended stage: ${recommendedStage}`,
      );

      // First attempt: Use LLM structured output capability
      try {
        const structuredLLM = this.model.withStructuredOutput(multiStepSchema);

        // Generate the full prompt with optimized guidelines
        const fullPrompt = generatePlanningPrompt({
          userQuestion,
          session: this.session,
          steps: this.steps,
          availableToolsets: toolsets,
          contentItems,
          maxStepsPerEpoch,
          locale,
        });

        const { steps } = await structuredLLM.invoke(fullPrompt);

        this.logger.log(`Generated research plan: ${JSON.stringify(steps)}`);

        if (recommendedStage === 'creation') {
          const creationSteps =
            steps
              .filter(
                (step) =>
                  step.skillName === 'generateDoc' ||
                  step.skillName === 'codeArtifacts' ||
                  step.skillName === 'generateMedia' ||
                  step.skillName === 'commonQnA',
              )
              .slice(0, 1) || [];
          return creationSteps?.length > 0
            ? creationSteps
            : steps?.length > 0
              ? [{ ...steps?.[0], skillName: 'commonQnA' }]
              : [];
        } else {
          return steps.filter(
            (step) =>
              step.skillName !== 'generateDoc' &&
              step.skillName !== 'codeArtifacts' &&
              step.skillName !== 'generateMedia',
          );
        }
      } catch (structuredError) {
        this.logger.warn(
          `Structured output failed: ${structuredError.message}, trying fallback approach`,
        );
        // Continue to fallback
      }

      // Second attempt: Manual JSON parsing approach
      const fallbackPrompt = generateFallbackPrompt({
        userQuestion,
        session: this.session,
        steps: this.steps,
        contentItems,
        availableToolsets: toolsets,
        maxStepsPerEpoch,
        locale,
      });

      const response = await this.model.invoke(fallbackPrompt);
      const responseText = response.content.toString();

      // Extract and parse JSON
      const extraction = extractJsonFromMarkdown(responseText);

      if (extraction.error) {
        throw new Error(
          `JSON extraction failed: ${extraction.error.message}, using final fallback`,
        );
      }

      const { steps } = await multiStepSchema.parseAsync(extraction.result);

      this.logger.log(`Successfully generated research plan with ${steps?.length} steps`);
      return steps;
    } catch (error) {
      this.logger.error(`Error generating research plan: ${error.message}`);
      return [];
    }
  }

  /**
   * Run pilot with progress plan-based execution
   */
  private async runWithProgressPlan(
    contentItems: CanvasContentItem[],
    toolsets: GenericToolset[],
    maxStepsPerEpoch: number,
    locale?: string,
  ): Promise<PilotStepRawOutput[]> {
    try {
      if (!this.progressPlan) {
        this.logger.warn('No progress plan available');
        return [];
      }

      const currentEpoch = this.session?.currentEpoch ?? 0;
      const currentStage = this.progressPlan.stages[currentEpoch];

      if (!currentStage) {
        this.logger.warn(`No stage found for epoch ${currentEpoch}`);
        return [];
      }

      this.logger.log(
        `Executing stage "${currentStage.name}" for epoch ${currentEpoch + 1}/${this.progressPlan.stages.length}`,
      );

      // Generate subtasks for the current stage
      const subtasks = await this.generateStageSubtasks(
        currentStage,
        contentItems,
        toolsets,
        maxStepsPerEpoch,
        locale,
      );

      this.logger.log(`Generated ${subtasks.length} subtasks for stage "${currentStage.name}"`);
      return subtasks;
    } catch (error) {
      this.logger.error(`Error running with progress plan: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate subtasks for a specific stage
   */
  private async generateStageSubtasks(
    stage: ProgressStage,
    contentItems: CanvasContentItem[],
    toolsets: GenericToolset[],
    maxStepsPerEpoch: number,
    locale?: string,
  ): Promise<PilotStepRawOutput[]> {
    try {
      // Use the stage's tool categories to filter available toolsets
      const relevantToolsets = toolsets.filter((toolset) =>
        stage.toolCategories.some(
          (category) =>
            toolset.name?.toLowerCase().includes(category.toLowerCase()) ||
            toolset.toolset?.definition?.tools?.some((tool) =>
              tool.name?.toLowerCase().includes(category.toLowerCase()),
            ),
        ),
      );

      // Generate prompt for stage-specific subtask generation
      const prompt = this.buildStageSubtaskPrompt(
        stage,
        contentItems,
        relevantToolsets,
        maxStepsPerEpoch,
        locale,
      );

      // Try structured output first
      try {
        const structuredModel = this.model.withStructuredOutput(multiStepSchema);
        const { steps } = await structuredModel.invoke(prompt);
        return steps;
      } catch (error) {
        this.logger.warn('Structured output failed, using fallback approach:', error);

        // Fallback: manual JSON parsing
        const response = await this.model.invoke(prompt);
        const responseText = response.content.toString();
        const extraction = extractJsonFromMarkdown(responseText);

        if (extraction.error) {
          throw new Error(`JSON extraction failed: ${extraction.error.message}`);
        }

        const { steps } = await multiStepSchema.parseAsync(extraction.result);
        return steps;
      }
    } catch (error) {
      this.logger.error(`Error generating stage subtasks: ${error.message}`);
      return [];
    }
  }

  /**
   * Build prompt for stage-specific subtask generation
   */
  private buildStageSubtaskPrompt(
    stage: ProgressStage,
    contentItems: CanvasContentItem[],
    toolsets: GenericToolset[],
    maxStepsPerEpoch: number,
    locale?: string,
  ): string {
    const toolInfo = toolsets
      .map(
        (toolset) =>
          `${toolset.name}: ${toolset.toolset?.definition?.descriptionDict?.en || 'No description available'}`,
      )
      .join('\n');

    const contentInfo =
      contentItems.length > 0
        ? `Available canvas content: ${contentItems.length} items`
        : 'No existing canvas content';

    return `# ROLE: Parallel Task Executor
You are a **Parallel Task Executor** responsible for breaking down a single stage into multiple independent subtasks that can be executed simultaneously. All subtasks must be completely independent and can start at the same time.

## CORE PRINCIPLES
- **Parallel Execution**: All subtasks must be able to run simultaneously
- **Independence**: No subtask should depend on another subtask's completion
- **Simultaneous Start**: All subtasks can begin at the same time
- **No Dependencies**: Subtasks cannot wait for each other

## CURRENT STAGE
**Stage Name**: ${stage.name}
**Description**: ${stage.description}
**Main Objectives**: ${stage.objectives.join(', ')}

## AVAILABLE TOOLS
${toolInfo}

## CANVAS CONTENT
${contentInfo}

## TASK ANALYSIS
Break down the stage objectives into ${maxStepsPerEpoch} **parallel subtasks** that can be executed simultaneously to achieve the stage goals.

## PARALLEL SUBTASK DESIGN PRINCIPLES
1. **Complete Independence**: Each subtask must be completely independent
2. **Simultaneous Execution**: All subtasks can start at the same time
3. **Goal-Oriented**: Each subtask should directly contribute to a specific objective
4. **Complementary**: Subtasks should work together to complete the full objective
5. **Tool Agnostic**: Focus on what needs to be done, not which tool to use
6. **Measurable**: Each subtask should have clear success criteria

## EXAMPLES OF GOOD PARALLEL SUBTASK SPLITTING

### Example 1: Data Collection Stage
**Stage Objective**: "Extract top 8 products from Product Hunt"
**Parallel Subtasks** (All can start simultaneously):
- Extract product #1 data (rank, name, URL, description)
- Extract product #2 data (rank, name, URL, description)
- Extract product #3 data (rank, name, URL, description)
- Extract product #4 data (rank, name, URL, description)
- Extract product #5 data (rank, name, URL, description)
- Extract product #6 data (rank, name, URL, description)
- Extract product #7 data (rank, name, URL, description)
- Extract product #8 data (rank, name, URL, description)

### Example 2: Content Generation Stage
**Stage Objective**: "Generate articles, web pages, and podcasts"
**Parallel Subtasks** (All can start simultaneously):
- Generate article content for product #1
- Generate article content for product #2
- Generate web page layout and structure
- Generate podcast script outline

### Example 3: Analysis Stage
**Stage Objective**: "Analyze market trends and competitor data"
**Parallel Subtasks** (All can start simultaneously):
- Analyze market size and growth trends
- Analyze competitor pricing strategies
- Analyze customer satisfaction metrics
- Analyze technology adoption patterns

## WHAT TO AVOID
❌ **DO NOT** create subtasks like:
- "First collect data, then analyze it" (Serial dependency - these should be separate stages)
- "Use web scraping tool to get data" (Tool-focused, not goal-focused)
- "Extract product information" (Too vague and not specific)
- "Process all products together" (Not parallelizable)
- "Wait for data collection to complete" (Serial dependency)
- "Analyze data after collection" (Serial dependency)

✅ **DO** create subtasks like:
- "Extract product #1 data" (Specific, independent, parallel)
- "Analyze competitor A pricing" (Independent, measurable, parallel)
- "Generate content for topic X" (Clear objective, independent, parallel)
- "Research market trend Y" (Independent, parallel)

## INDEPENDENCE VERIFICATION
For each subtask, verify:
- Can this subtask start immediately without waiting for other subtasks?
- Does this subtask have all the information it needs to begin?
- Is this subtask completely independent of other subtasks?
- Can this subtask run simultaneously with all other subtasks?

## OUTPUT FORMAT
Generate a JSON array of subtasks following the exact schema:
\`\`\`json
[
  {
    "name": "Clear, specific task name",
    "query": "Detailed description of what this subtask accomplishes",
    "contextItemIds": ["relevant-context-ids"],
    "workflowStage": "${stage.name.toLowerCase()}"
  }
]
\`\`\`

## CRITICAL REQUIREMENTS
- **MUST** create exactly ${maxStepsPerEpoch} subtasks
- **MUST** ensure all subtasks can run in parallel
- **MUST** focus on objectives, not tools
- **MUST** make each task specific and actionable
- **MUST** avoid any serial dependencies between subtasks
- **MUST** ensure subtasks are complementary, not overlapping
- **MUST** ensure each subtask is completely independent

## PARALLEL EXECUTION VALIDATION
Before submitting, verify:
□ Each subtask can start immediately without waiting
□ No subtask depends on another subtask's completion
□ All subtasks can run simultaneously
□ Each subtask has a clear, specific objective
□ Tasks work together to achieve the full stage goal
□ Each task is measurable and actionable
□ No subtask mentions "waiting for" or "after" other subtasks

## INDEPENDENCE CHECKLIST
For each subtask, confirm:
- ✅ Can start immediately
- ✅ Has all required information
- ✅ No dependencies on other subtasks
- ✅ Can run simultaneously with others
- ✅ Contributes to stage objectives

${locale ? `\n## LANGUAGE REQUIREMENT\nAll output should be in ${locale} language.` : ''}`;
  }
}
