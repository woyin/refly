import { Injectable, Logger } from '@nestjs/common';
import { BaseChatModel } from '@refly/providers';
import { extractJsonFromMarkdown } from '@refly/utils';
import {
  ProgressPlan,
  ProgressStage,
  ProgressPlanWithSubtasks,
  ProgressSubtask,
} from './pilot.types';
import { CanvasContentItem } from '../canvas/canvas.dto';
import { GenericToolset } from '@refly/openapi-schema';
import { genPilotStepID } from '@refly/utils';

@Injectable()
export class IntentAnalysisService {
  private logger = new Logger(IntentAnalysisService.name);

  /**
   * Analyze user intent and generate dynamic stage planning with subtasks
   * This method handles both initial planning and dynamic re-planning with context
   */
  async analyzeIntentAndPlanWithSubtasks(
    model: BaseChatModel,
    userQuestion: string,
    progressPlan: ProgressPlan | null,
    availableTools: GenericToolset[],
    canvasContent: CanvasContentItem[],
    locale?: string,
  ): Promise<ProgressPlanWithSubtasks> {
    try {
      const isInitialPlan = progressPlan === null;
      this.logger.log(
        `Starting ${isInitialPlan ? 'initial' : 'dynamic'} intent analysis for: "${userQuestion}"`,
      );

      // Generate comprehensive plan with subtasks
      const planWithSubtasks = await this.generateComprehensivePlan(
        model,
        userQuestion,
        progressPlan,
        availableTools,
        canvasContent,
        locale,
      );

      this.logger.log(
        `Comprehensive planning completed. Generated ${planWithSubtasks.stages.length} stages with ${planWithSubtasks.currentStageSubtasks.length} current stage subtasks`,
      );

      return planWithSubtasks;
    } catch (error) {
      this.logger.error('Comprehensive planning failed:', error);
      // Return a default plan as fallback
      return this.generateDefaultPlanWithSubtasks(userQuestion);
    }
  }

  /**
   * Generate comprehensive plan with stages and subtasks
   */
  private async generateComprehensivePlan(
    model: BaseChatModel,
    userQuestion: string,
    progressPlan: ProgressPlan | null,
    availableTools: GenericToolset[],
    canvasContent: CanvasContentItem[],
    locale?: string,
  ): Promise<ProgressPlanWithSubtasks> {
    const isInitialPlan = progressPlan === null;

    // Build comprehensive prompt
    const prompt = this.buildComprehensivePlanningPrompt(
      userQuestion,
      progressPlan,
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
          stages: {
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
                status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
              },
              required: [
                'name',
                'description',
                'objectives',
                'toolCategories',
                'priority',
                'estimatedEpochs',
                'status',
              ],
            },
          },
          currentStageSubtasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                query: { type: 'string' },
                status: { type: 'string', enum: ['pending', 'executing', 'completed', 'failed'] },
              },
              required: ['name', 'query', 'status'],
            },
          },
          planningLogic: { type: 'string' },
          estimatedTotalEpochs: { type: 'number' },
          previousExecutionSummary: { type: 'string' },
        },
        required: [
          'userIntent',
          'taskComplexity',
          'stages',
          'currentStageSubtasks',
          'planningLogic',
          'estimatedTotalEpochs',
        ],
      });

      const result = await structuredModel.invoke(prompt);

      // Convert to ProgressPlanWithSubtasks
      const stages: ProgressStage[] = result.stages.map((stageInfo: any, _index: number) => {
        const stageId = genPilotStepID();
        return {
          id: stageId,
          name: stageInfo.name,
          description: stageInfo.description,
          objectives: stageInfo.objectives,
          status: stageInfo.status,
          createdAt: new Date().toISOString(),
          startedAt: stageInfo.status === 'in_progress' ? new Date().toISOString() : undefined,
          subtasks: [], // Will be populated separately
          toolCategories: stageInfo.toolCategories,
          priority: stageInfo.priority,
        };
      });

      const currentStageSubtasks: ProgressSubtask[] = result.currentStageSubtasks.map(
        (subtaskInfo: any, index: number) => ({
          id: `subtask_${Date.now()}_${index}`,
          name: subtaskInfo.name,
          query: subtaskInfo.query,
          status: subtaskInfo.status,
          createdAt: new Date().toISOString(),
        }),
      );

      // Find current stage index
      const currentStageIndex = stages.findIndex((stage) => stage.status === 'in_progress');

      return {
        stages,
        currentStageIndex: currentStageIndex >= 0 ? currentStageIndex : 0,
        overallProgress: progressPlan?.overallProgress || 0,
        lastUpdated: new Date().toISOString(),
        planningLogic: result.planningLogic,
        userIntent: result.userIntent,
        estimatedTotalEpochs: result.estimatedTotalEpochs,
        currentStageSubtasks,
        planningContext: {
          isInitialPlan,
          previousExecutionSummary: result.previousExecutionSummary,
          userIntent: result.userIntent,
          currentStageIndex: currentStageIndex >= 0 ? currentStageIndex : 0,
        },
      };
    } catch (error) {
      this.logger.warn('Structured output failed, using fallback approach:', error);

      // Fallback: manual JSON parsing
      const response = await model.invoke(prompt);
      const responseText = response.content.toString();
      const extraction = extractJsonFromMarkdown(responseText);

      if (extraction.error) {
        throw new Error(`JSON extraction failed: ${extraction.error.message}`);
      }

      // Process the extracted result similar to structured output
      const _result = extraction.result;
      // ... (similar processing logic)

      // For now, return a default plan if fallback also fails
      return this.generateDefaultPlanWithSubtasks(userQuestion);
    }
  }

  /**
   * Generate default plan with subtasks as fallback
   */
  private generateDefaultPlanWithSubtasks(userQuestion: string): ProgressPlanWithSubtasks {
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

    const defaultSubtasks: ProgressSubtask[] = [
      {
        id: `subtask_${Date.now()}_0`,
        name: 'Execute General Task',
        query: userQuestion,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    ];

    return {
      stages: [defaultStage],
      currentStageIndex: 0,
      overallProgress: 0,
      lastUpdated: new Date().toISOString(),
      planningLogic: 'Default plan with subtasks generated due to analysis failure',
      userIntent: userQuestion,
      estimatedTotalEpochs: 2,
      currentStageSubtasks: defaultSubtasks,
      planningContext: {
        isInitialPlan: true,
        userIntent: userQuestion,
        currentStageIndex: 0,
      },
    };
  }

  /**
   * Build comprehensive planning prompt for both initial and dynamic planning
   */
  private buildComprehensivePlanningPrompt(
    userQuestion: string,
    progressPlan: ProgressPlan | null,
    availableTools: GenericToolset[],
    canvasContent: CanvasContentItem[],
    locale?: string,
  ): string {
    const isInitialPlan = progressPlan === null;
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

    let progressContext = '';
    if (!isInitialPlan && progressPlan) {
      const completedStages = progressPlan.stages.filter((stage) => stage.status === 'completed');
      const currentStage = progressPlan.stages.find((stage) => stage.status === 'in_progress');
      const pendingStages = progressPlan.stages.filter((stage) => stage.status === 'pending');

      progressContext = `
## CURRENT PROGRESS CONTEXT
**Overall Progress**: ${progressPlan.overallProgress}%
**Completed Stages**: ${completedStages.length}/${progressPlan.stages.length}
**Current Stage**: ${currentStage?.name || 'None'}
**Pending Stages**: ${pendingStages.map((s) => s.name).join(', ')}

### Completed Stages Summary:
${completedStages.map((stage) => `- ${stage.name}: ${stage.description}`).join('\n')}

### Current Stage Details:
${
  currentStage
    ? `
- Name: ${currentStage.name}
- Description: ${currentStage.description}
- Objectives: ${currentStage.objectives.join(', ')}
- Progress: ${currentStage.stageProgress || 0}%
- Tool Categories: ${currentStage.toolCategories.join(', ')}
`
    : 'No current stage'
}

### Pending Stages:
${pendingStages
  .map(
    (stage) => `
- Name: ${stage.name}
- Description: ${stage.description}
- Objectives: ${stage.objectives.join(', ')}
- Tool Categories: ${stage.toolCategories.join(', ')}
`,
  )
  .join('\n')}
`;
    }

    return `# ROLE: Comprehensive Task Planner
You are a **Comprehensive Task Planner** responsible for creating both sequential stage planning and parallel subtask generation in a single response. You handle both initial planning and dynamic re-planning with full context awareness.

## PLANNING MODE
**Mode**: ${isInitialPlan ? 'INITIAL PLANNING' : 'DYNAMIC RE-PLANNING'}
${isInitialPlan ? 'Creating a new execution plan from scratch.' : 'Re-planning based on current progress and execution history.'}

## USER REQUEST
"${userQuestion}"

## AVAILABLE TOOLS
${toolInfo}

## CANVAS CONTENT
${contentInfo}
${progressContext}

## COMPREHENSIVE PLANNING REQUIREMENTS

### 1. SEQUENTIAL STAGE PLANNING
- **Sequential Execution**: Stages must be executed in order, one after another
- **Dependency-Based**: Each stage must wait for the previous stage to complete
- **Logical Progression**: Stages should build upon each other logically
- **Global Optimization**: ${isInitialPlan ? 'Create optimal stage sequence' : 'Re-optimize remaining stages based on progress'}

### 2. PARALLEL SUBTASK GENERATION
- **Parallel Execution**: Subtasks within a stage must be able to run simultaneously
- **Independence**: No subtask should depend on another subtask's completion
- **Goal-Oriented**: Each subtask should directly contribute to stage objectives
- **Current Stage Focus**: Generate subtasks for the current active stage

## PLANNING PRINCIPLES

### For Initial Planning:
1. **User Intent Analysis**: Understand what the user wants to achieve
2. **Task Complexity Assessment**: Determine if the task is simple, medium, or complex
3. **Sequential Stage Identification**: Identify logical stages that must be executed in order
4. **Tool Category Mapping**: Recommend appropriate tool categories for each stage
5. **Current Stage Subtasks**: Generate parallel subtasks for the first stage

### For Dynamic Re-planning:
1. **Progress Assessment**: Analyze current execution status and results
2. **Stage Re-optimization**: Adjust remaining stages based on what has been learned
3. **Context Integration**: Incorporate insights from completed stages
4. **Current Stage Subtasks**: Generate or update subtasks for the current active stage
5. **Adaptive Planning**: Modify future stages based on current progress

## OUTPUT FORMAT
Provide a JSON response with the following structure:
\`\`\`json
{
  "userIntent": "Clear description of what the user wants to achieve",
  "taskComplexity": "simple|medium|complex",
  "stages": [
    {
      "name": "Stage name (e.g., 'Data Collection', 'Analysis', 'Synthesis')",
      "description": "What this stage accomplishes and why it's needed",
      "objectives": ["Specific objective 1", "Specific objective 2"],
      "toolCategories": ["web_search", "analysis", "generation"],
      "priority": 1,
      "estimatedEpochs": 1,
      "status": "pending|in_progress|completed"
    }
  ],
  "currentStageSubtasks": [
    {
      "name": "Clear, specific task name",
      "query": "Detailed description of what this subtask accomplishes",
      "status": "pending"
    }
  ],
  "planningLogic": "Explanation of planning decisions and stage dependencies",
  "estimatedTotalEpochs": 3,
  "previousExecutionSummary": "${isInitialPlan ? 'Initial planning - no previous execution' : 'Summary of what has been accomplished so far'}"
}
\`\`\`

## CRITICAL REQUIREMENTS
- **MUST** create sequential stages that depend on each other
- **MUST** generate parallel subtasks for the current active stage
- **MUST** ensure subtasks can run simultaneously within a stage
- **MUST** provide clear dependency explanations between stages
- **MUST** make each stage and subtask actionable and specific
- **MUST** ${isInitialPlan ? 'create optimal initial plan' : 're-optimize based on current progress'}
- **MUST** ensure logical progression between stages
- **MUST** be realistic about time estimates

## VALIDATION CHECKLIST
Before submitting, verify:
□ Stages are sequential and cannot run in parallel
□ Subtasks within current stage can run in parallel
□ Each stage has clear dependencies on previous stages
□ Current stage subtasks are independent and parallelizable
□ The execution order is logical and necessary
□ Each stage and subtask has defined objectives
□ The progression makes sense for the user's request
□ ${isInitialPlan ? 'Initial plan is comprehensive and optimal' : 'Re-planning incorporates lessons learned'}

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
