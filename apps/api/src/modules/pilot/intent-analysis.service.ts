import { Injectable, Logger } from '@nestjs/common';
import { BaseChatModel } from '@refly/providers';
import { extractJsonFromMarkdown } from '@refly/utils';
import { IntentAnalysisResult, ProgressPlan, ProgressStage } from './pilot.types';
import { CanvasContentItem } from '../canvas/canvas.dto';
import { GenericToolset } from '@refly/openapi-schema';
import { genPilotStepID } from '@refly/utils';

@Injectable()
export class IntentAnalysisService {
  private logger = new Logger(IntentAnalysisService.name);

  /**
   * Analyze user intent and generate dynamic stage planning
   */
  async analyzeIntentAndPlan(
    model: BaseChatModel,
    userQuestion: string,
    availableTools: GenericToolset[],
    canvasContent: CanvasContentItem[],
    locale?: string,
  ): Promise<ProgressPlan> {
    try {
      this.logger.log(`Starting intent analysis for: "${userQuestion}"`);

      // Analyze user intent
      const intentAnalysis = await this.analyzeUserIntent(
        model,
        userQuestion,
        availableTools,
        canvasContent,
        locale,
      );

      // Generate progress plan based on intent analysis
      const progressPlan = await this.generateProgressPlan(
        model,
        intentAnalysis,
        availableTools,
        locale,
      );

      this.logger.log(
        `Intent analysis completed. Generated ${progressPlan.stages.length} stages with ${progressPlan.estimatedTotalEpochs} estimated epochs`,
      );

      return progressPlan;
    } catch (error) {
      this.logger.error('Intent analysis failed:', error);
      // Return a default plan as fallback
      return this.generateDefaultPlan(userQuestion);
    }
  }

  /**
   * Analyze user intent using LLM
   */
  private async analyzeUserIntent(
    model: BaseChatModel,
    userQuestion: string,
    availableTools: GenericToolset[],
    canvasContent: CanvasContentItem[],
    locale?: string,
  ): Promise<IntentAnalysisResult> {
    const prompt = this.buildIntentAnalysisPrompt(
      userQuestion,
      availableTools,
      canvasContent,
      locale,
    );

    try {
      // Try structured output first
      const structuredModel = model.withStructuredOutput({
        type: 'object',
        properties: {
          userIntent: { type: 'string' },
          taskComplexity: { type: 'string', enum: ['simple', 'medium', 'complex'] },
          requiredStages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                objectives: { type: 'array', items: { type: 'string' } },
                toolCategories: { type: 'array', items: { type: 'string' } },
                priority: { type: 'number' },
                estimatedEpochs: { type: 'number' },
              },
              required: [
                'name',
                'description',
                'objectives',
                'toolCategories',
                'priority',
                'estimatedEpochs',
              ],
            },
          },
          planningLogic: { type: 'string' },
          estimatedTotalEpochs: { type: 'number' },
        },
        required: [
          'userIntent',
          'taskComplexity',
          'requiredStages',
          'planningLogic',
          'estimatedTotalEpochs',
        ],
      });

      const result = await structuredModel.invoke(prompt);
      // Ensure the result matches our expected type structure
      return {
        userIntent: result.userIntent || '',
        taskComplexity: result.taskComplexity || 'medium',
        requiredStages: result.requiredStages || [],
        planningLogic: result.planningLogic || '',
        estimatedTotalEpochs: result.estimatedTotalEpochs || 2,
      } as IntentAnalysisResult;
    } catch (error) {
      this.logger.warn('Structured output failed, using fallback approach:', error);

      // Fallback: manual JSON parsing
      const response = await model.invoke(prompt);
      const responseText = response.content.toString();
      const extraction = extractJsonFromMarkdown(responseText);

      if (extraction.error) {
        throw new Error(`JSON extraction failed: ${extraction.error.message}`);
      }

      return extraction.result;
    }
  }

  /**
   * Generate progress plan based on intent analysis
   */
  private async generateProgressPlan(
    _model: BaseChatModel,
    intentAnalysis: IntentAnalysisResult,
    _availableTools: GenericToolset[],
    _locale?: string,
  ): Promise<ProgressPlan> {
    const stages: ProgressStage[] = intentAnalysis.requiredStages.map((stageInfo, index) => {
      const stageId = genPilotStepID();
      return {
        id: stageId,
        name: stageInfo.name,
        description: stageInfo.description,
        objectives: stageInfo.objectives,
        status: index === 0 ? 'in_progress' : 'pending',
        createdAt: new Date().toISOString(),
        startedAt: index === 0 ? new Date().toISOString() : undefined,
        subtasks: [], // Will be populated during execution
        toolCategories: stageInfo.toolCategories,
        priority: stageInfo.priority,
      };
    });

    return {
      stages,
      currentStageIndex: 0,
      overallProgress: 0,
      lastUpdated: new Date().toISOString(),
      planningLogic: intentAnalysis.planningLogic,
      userIntent: intentAnalysis.userIntent,
      estimatedTotalEpochs: intentAnalysis.estimatedTotalEpochs,
    };
  }

  /**
   * Generate default plan as fallback
   */
  private generateDefaultPlan(userQuestion: string): ProgressPlan {
    const defaultStage: ProgressStage = {
      id: genPilotStepID(),
      name: 'General Task Execution',
      description: 'Default stage for task execution',
      objectives: ['Complete the requested task'],
      status: 'in_progress',
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      subtasks: [],
      toolCategories: ['web_search', 'analysis', 'generation'],
      priority: 1,
    };

    return {
      stages: [defaultStage],
      currentStageIndex: 0,
      overallProgress: 0,
      lastUpdated: new Date().toISOString(),
      planningLogic: 'Default plan generated due to analysis failure',
      userIntent: userQuestion,
      estimatedTotalEpochs: 2,
    };
  }

  /**
   * Build intent analysis prompt
   */
  private buildIntentAnalysisPrompt(
    userQuestion: string,
    availableTools: GenericToolset[],
    canvasContent: CanvasContentItem[],
    locale?: string,
  ): string {
    const toolInfo = availableTools
      .map(
        (toolset) =>
          `${toolset.name}: ${toolset.toolset?.definition?.descriptionDict?.en || 'No description available'}`,
      )
      .join('\n');

    const contentInfo =
      canvasContent.length > 0
        ? `Available canvas content: ${canvasContent.length} items`
        : 'No existing canvas content';

    return `# ROLE: Sequential Workflow Planner
You are a **Sequential Workflow Planner** responsible for breaking down user requests into a series of stages that must be executed in a specific order. Each stage depends on the completion of the previous stage.

## CORE PRINCIPLES
- **Sequential Execution**: Stages must be executed in order, one after another
- **Dependency-Based**: Each stage must wait for the previous stage to complete
- **Logical Progression**: Stages should build upon each other logically
- **No Parallel Stages**: Stages cannot run simultaneously - they are sequential

## USER REQUEST
"${userQuestion}"

## AVAILABLE TOOLS
${toolInfo}

## CANVAS CONTENT
${contentInfo}

## TASK ANALYSIS
Analyze the user's intent and create a **sequential execution plan** with multiple dependent stages.

## STAGE PLANNING REQUIREMENTS
1. **User Intent Analysis**: Understand what the user wants to achieve
2. **Task Complexity Assessment**: Determine if the task is simple, medium, or complex
3. **Sequential Stage Identification**: Identify logical stages that must be executed in order
4. **Tool Category Mapping**: Recommend appropriate tool categories for each stage
5. **Epoch Estimation**: Estimate realistic epochs needed for each stage

## SEQUENTIAL STAGE DESIGN PRINCIPLES
- **Dependency Chain**: Each stage must depend on the previous stage's output
- **Clear Input/Output**: Each stage should have defined inputs and outputs
- **Logical Order**: Stages should follow a natural progression (e.g., collect → analyze → synthesize → create)
- **Measurable Objectives**: Each stage should have clear, measurable goals
- **Tool Alignment**: Tool categories should match the stage's specific purpose

## EXAMPLES OF GOOD SEQUENTIAL PLANNING

### Example 1: Research Project
**Sequential Stages** (Must be executed in order):
1. **Data Collection** → 2. **Data Analysis** → 3. **Report Generation**
- Stage 2 cannot start until Stage 1 completes
- Stage 3 cannot start until Stage 2 completes

### Example 2: Content Creation
**Sequential Stages** (Must be executed in order):
1. **Research & Information Gathering** → 2. **Content Planning** → 3. **Content Creation** → 4. **Review & Refinement**
- Each stage builds upon the previous stage's output

## WHAT TO AVOID
❌ **DO NOT** create stages like:
- "Data Collection + Content Creation" (These should be sequential, not parallel)
- "Analysis and Research simultaneously" (These should be sequential)
- Stages that can run independently (This is for parallel task generation, not sequential planning)

✅ **DO** create stages like:
- "Data Collection → Data Analysis → Content Generation" (Sequential dependency)
- "Research → Planning → Execution → Review" (Logical progression)

## VALIDATION REQUIREMENTS
Before submitting, verify:
□ Each stage has a clear dependency on the previous stage
□ Stages cannot be executed in parallel
□ The execution order is logical and necessary
□ Each stage has defined inputs and outputs
□ The progression makes sense for the user's request

## OUTPUT FORMAT
Provide a JSON response with the following structure:
\`\`\`json
{
  "userIntent": "Clear description of what the user wants to achieve",
  "taskComplexity": "simple|medium|complex",
  "requiredStages": [
    {
      "name": "Stage name (e.g., 'Data Collection', 'Analysis', 'Synthesis')",
      "description": "What this stage accomplishes and why it's needed",
      "objectives": ["Specific objective 1", "Specific objective 2"],
      "toolCategories": ["web_search", "analysis", "generation"],
      "priority": 1,
      "estimatedEpochs": 1
    }
  ],
  "planningLogic": "Explanation of why these stages were chosen and why they must be sequential",
  "estimatedTotalEpochs": 3
}
\`\`\`

## CRITICAL REQUIREMENTS
- **MUST** create sequential stages that depend on each other
- **MUST** ensure stages cannot run in parallel
- **MUST** provide clear dependency explanations
- **MUST** make each stage actionable and specific
- **MUST** ensure logical progression between stages
- **MUST** be realistic about time estimates

## DEPENDENCY VERIFICATION
For each stage, explain:
- What input does it need from the previous stage?
- What output does it provide to the next stage?
- Why can't this stage run in parallel with others?

${locale ? `\n## LANGUAGE REQUIREMENT\nAll output should be in ${locale} language.` : ''}`;
  }

  /**
   * Update progress plan based on current execution status
   */
  async updateProgressPlan(
    currentPlan: ProgressPlan,
    _userQuestion: string,
    currentStage: ProgressStage,
    completedStages: ProgressStage[],
    _availableTools: GenericToolset[],
    _locale?: string,
  ): Promise<ProgressPlan> {
    // Update current stage status
    const updatedStages = currentPlan.stages.map((stage) => {
      if (stage.id === currentStage.id) {
        return { ...stage, status: 'in_progress' as const };
      }
      return stage;
    });

    // Calculate overall progress
    const totalStages = currentPlan.stages.length;
    const completedCount = completedStages.length;
    const overallProgress = Math.round((completedCount / totalStages) * 100);

    return {
      ...currentPlan,
      stages: updatedStages,
      overallProgress,
      lastUpdated: new Date().toISOString(),
    };
  }
}
