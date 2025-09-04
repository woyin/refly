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
      const result = extraction.result;

      // Validate the extracted result
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid JSON structure in fallback response');
      }

      // Convert to ProgressPlanWithSubtasks (similar to structured output logic)
      const stages: ProgressStage[] = (result.stages || []).map(
        (stageInfo: any, _index: number) => {
          const stageId = genPilotStepID();
          return {
            id: stageId,
            name: stageInfo.name || 'Unnamed Stage',
            description: stageInfo.description || 'No description',
            objectives: stageInfo.objectives || ['Complete task'],
            status: stageInfo.status || 'pending',
            createdAt: new Date().toISOString(),
            startedAt: stageInfo.status === 'in_progress' ? new Date().toISOString() : undefined,
            subtasks: [],
            toolCategories: stageInfo.toolCategories || ['general'],
            priority: stageInfo.priority || 1,
          };
        },
      );

      const currentStageSubtasks: ProgressSubtask[] = (result.currentStageSubtasks || []).map(
        (subtaskInfo: any, index: number) => ({
          id: `subtask_${Date.now()}_${index}`,
          name: subtaskInfo.name || 'Unnamed Subtask',
          query: subtaskInfo.query || userQuestion,
          status: subtaskInfo.status || 'pending',
          createdAt: new Date().toISOString(),
        }),
      );

      // Find current stage index
      const currentStageIndex = stages.findIndex((stage) => stage.status === 'in_progress');

      return {
        stages:
          stages.length > 0
            ? stages
            : [
                {
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
                },
              ],
        currentStageIndex: currentStageIndex >= 0 ? currentStageIndex : 0,
        overallProgress: progressPlan?.overallProgress || 0,
        lastUpdated: new Date().toISOString(),
        planningLogic: result.planningLogic || 'Fallback planning with manual JSON parsing',
        userIntent: result.userIntent || userQuestion,
        estimatedTotalEpochs: result.estimatedTotalEpochs || 2,
        currentStageSubtasks:
          currentStageSubtasks.length > 0
            ? currentStageSubtasks
            : [
                {
                  id: `subtask_${Date.now()}_0`,
                  name: 'Execute General Task',
                  query: userQuestion,
                  status: 'pending',
                  createdAt: new Date().toISOString(),
                },
              ],
        planningContext: {
          isInitialPlan,
          previousExecutionSummary:
            result.previousExecutionSummary || 'No previous execution summary',
          userIntent: result.userIntent || userQuestion,
          currentStageIndex: currentStageIndex >= 0 ? currentStageIndex : 0,
        },
      };
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

### Completed Stages with Execution Results:
${completedStages
  .map((stage) => {
    const summary = stage.summary || 'No execution summary available';
    const processedSummary = this.processStageSummary(summary);
    return `
- **${stage.name}**: ${stage.description}
  - **Objectives**: ${stage.objectives.join(', ')}
  - **Progress**: ${stage.stageProgress || 0}%
  - **Tool Categories**: ${stage.toolCategories.join(', ')}
  - **Execution Summary**: ${processedSummary}
  - **Completion Status**: ${stage.status}
  - **Completed At**: ${stage.completedAt || 'Not specified'}`;
  })
  .join('\n')}

### Current Stage Details:
${
  currentStage
    ? `
- **Name**: ${currentStage.name}
- **Description**: ${currentStage.description}
- **Objectives**: ${currentStage.objectives.join(', ')}
- **Progress**: ${currentStage.stageProgress || 0}%
- **Tool Categories**: ${currentStage.toolCategories.join(', ')}
- **Status**: ${currentStage.status}
- **Started At**: ${currentStage.startedAt || 'Not started'}
- **Current Summary**: ${currentStage.summary ? this.processStageSummary(currentStage.summary) : 'No summary available yet'}`
    : 'No current stage'
}

### Pending Stages:
${pendingStages
  .map(
    (stage) => `
- **Name**: ${stage.name}
- **Description**: ${stage.description}
- **Objectives**: ${stage.objectives.join(', ')}
- **Tool Categories**: ${stage.toolCategories.join(', ')}
- **Priority**: ${stage.priority}
- **Status**: ${stage.status}`,
  )
  .join('\n')}

### Execution Quality Assessment:
${
  completedStages.length > 0
    ? `Based on the execution summaries above, assess the quality and completeness of completed stages to inform better planning for remaining stages.

**Note**: Execution summaries have been processed to extract key information including:
- Progress status (epochs completed, completion percentage)
- Completed subtasks and their outcomes
- Current stage status and objectives
- Target question and scope
- Language requirements
- Completeness and evidence quality assessments

Use this structured information to make informed decisions about future stage planning and subtask generation.`
    : 'No completed stages to assess yet.'
}
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

## CRITICAL BUILT-IN TOOLS (Use These When Applicable)
The following built-in tools are available and should be explicitly used when their functionality matches the task:

- **library_search**: Search and retrieve information from knowledge libraries
- **web_search**: Search the web for current information and data
- **generate_media**: Generate images, videos, or other media content
- **generate_doc**: Generate documents, reports, or written content
- **generate_code_artifact**: Generate code, scripts, or technical artifacts
- **send_email**: Send emails or notifications
- **get_time**: Get current time, date, or timezone information

**IMPORTANT**: When a subtask requires any of these built-in tools, the query MUST explicitly mention the tool name and be specific about what the tool should accomplish.

## CANVAS CONTENT
${contentInfo}
${progressContext}

## EXECUTION RESULT ANALYSIS (For Dynamic Re-planning)
${
  !isInitialPlan
    ? `
When analyzing execution results, pay special attention to:

### Quality Assessment Criteria:
- **Completeness**: Were all stage objectives fully achieved?
- **Accuracy**: Were the results accurate and reliable?
- **Efficiency**: Was the execution efficient and well-organized?
- **Quality**: Was the output quality satisfactory?
- **Gaps**: What was missing or could be improved?

### Learning Integration:
- **Success Patterns**: What worked well and should be replicated?
- **Failure Points**: What didn't work and needs adjustment?
- **Resource Optimization**: How can tools and approaches be better utilized?
- **Timeline Adjustments**: Were time estimates realistic?
- **Dependency Refinement**: Do stage dependencies need adjustment?

### Context for Future Planning:
- **Data Quality**: What data was collected and its reliability?
- **Tool Effectiveness**: Which tools were most/least effective?
- **Approach Validation**: Which approaches proved successful?
- **Scope Refinement**: Does the remaining scope need adjustment?
`
    : ''
}

## COMPREHENSIVE PLANNING REQUIREMENTS

### 1. SEQUENTIAL STAGE PLANNING
- **Sequential Execution**: Stages must be executed in order, one after another
- **Dependency-Based**: Each stage must wait for the previous stage to complete
- **Logical Progression**: Stages should build upon each other logically
- **Objective Logic Alignment**: Stage sequence must follow the objective logic of progressive completion
- **Natural Dependencies**: Each stage must naturally depend on the previous stage's outcomes
- **Minimal Stage Subtasks**: If a stage logically requires only a few subtasks, do not generate excessive subtasks
- **Stage-Specific Optimization**: Optimize subtask count based on each stage's specific requirements and logic
- **Global Optimization**: ${isInitialPlan ? 'Create optimal stage sequence' : 'Re-optimize remaining stages based on progress'}

### 2. DEPENDENCY ANALYSIS AND SUBTASK GENERATION
- **Dependency Analysis First**: Before generating subtasks, analyze all task dependencies
- **Sequential Task Identification**: Identify tasks that must be executed in sequence (e.g., "整理内容然后发送邮件")
- **Parallel Task Identification**: Identify tasks that can be executed simultaneously (e.g., "搜索A信息和搜索B信息")
- **Dependency Validation**: Verify that no subtask depends on another subtask's completion
- **Stage Promotion**: If subtasks have sequential dependencies, promote them to separate stages
- **Goal-Oriented**: Each subtask should directly contribute to stage objectives
- **Necessity**: ONLY generate essential subtasks - avoid redundant or overlapping subtasks
- **Uniqueness**: Each subtask must have distinct objectives and outcomes
- **Tool-Specific Execution**: Each subtask query MUST specify the exact tool to use based on available tools
- **Unambiguous Instructions**: Avoid vague descriptions - be specific about tool usage and expected outcomes
- **Current Stage Focus**: Generate subtasks for the current active stage

## PLANNING PRINCIPLES

### Dependency Analysis and Task Sequencing:
- **Dependency-First Approach**: Always analyze task dependencies before generating subtasks
- **Sequential vs Parallel Identification**: Clearly distinguish between tasks that must be sequential vs those that can be parallel
- **Logical Flow Validation**: Ensure task sequence follows natural logical progression
- **Data Dependency Check**: Verify if subsequent tasks depend on previous task outputs
- **Resource Dependency Analysis**: Check if tasks require resources from previous tasks

### Subtask Granularity and Quantity Control:
- **Dependency-Aware Granularity**: Break down tasks while respecting dependency relationships
- **Concurrency Optimization**: Generate parallel subtasks ONLY when tasks are truly independent
- **Resource Utilization**: Ensure each subtask can be executed independently without waiting for others
- **Quality Over Quantity**: Generate ONLY essential subtasks - avoid redundant, overlapping, or unnecessary subtasks
- **Minimal Viable Subtasks**: Each subtask must have distinct, non-overlapping objectives and outcomes
- **Burden Avoidance**: Excessive subtasks create overhead - maintain subtask simplicity and necessity
- **Essential Only**: Generate subtasks only when they are absolutely necessary for stage completion
- **No Redundancy**: Avoid creating multiple subtasks that achieve similar or overlapping results
- **Logical Necessity**: Each subtask must be logically required for the stage's success
- **Stage-Appropriate Count**: Simple stages (1-2 subtasks), Complex stages (3-5 subtasks maximum)
- **Avoid Over-Engineering**: Do not artificially inflate subtask count for the sake of concurrency

### For Initial Planning:
1. **User Intent Analysis**: Understand what the user wants to achieve
2. **Task Complexity Assessment**: Determine if the task is simple, medium, or complex
3. **Sequential Stage Identification**: Identify logical stages that must be executed in order
4. **Tool Category Mapping**: Recommend appropriate tool categories for each stage
5. **Current Stage Subtasks**: Generate parallel subtasks for the first stage

### For Dynamic Re-planning:
1. **Execution Quality Analysis**: Thoroughly analyze the execution summaries from completed stages
2. **Progress Assessment**: Evaluate current execution status, quality, and completeness
3. **Stage Re-optimization**: Adjust remaining stages based on lessons learned from execution results
4. **Context Integration**: Incorporate insights, findings, and outcomes from completed stages
5. **Current Stage Subtasks**: Generate or update subtasks for the current active stage based on execution context
6. **Adaptive Planning**: Modify future stages based on actual execution results and quality assessment
7. **Quality Improvement**: Identify areas for improvement and adjust planning accordingly

## TOOL USAGE GUIDELINES

### Built-in Tool Selection:
- **Information Gathering**: Use \`web_search\` for current web information, \`library_search\` for knowledge base queries
- **Content Generation**: Use \`generate_doc\` for documents/reports, \`generate_media\` for visual content, \`generate_code_artifact\` for code
- **Communication**: Use \`send_email\` for notifications or communications
- **System Operations**: Use \`get_time\` for time-related information

### Query Format Requirements:
- **Specific Tool Reference**: Always mention the exact tool name
- **Clear Objective**: Specify what the tool should accomplish
- **Actionable Instructions**: Provide enough detail for immediate execution
- **Expected Output**: Describe what kind of result is expected

### Examples of Good vs Bad Queries:
- **Good**: "Use web_search to find the latest statistics about renewable energy adoption in 2024"
- **Bad**: "Search for information about renewable energy"
- **Good**: "Use generate_doc to create a comprehensive market analysis report about the renewable energy sector"
- **Bad**: "Generate a report about renewable energy"


## DEPENDENCY ANALYSIS GUIDELINES

### Dependency Identification Principles:
- **Data Dependency**: Subsequent tasks require output data from previous tasks
- **Logical Dependency**: Tasks must follow natural logical sequence (e.g., "整理内容" → "发送邮件")
- **Time Dependency**: Tasks must be executed in specific chronological order
- **Resource Dependency**: Tasks require resources or results from previous tasks

### Dependency Analysis Methods:
- **Verb Analysis**: Analyze task verbs to identify sequential patterns (e.g., "收集" → "分析" → "生成")
- **Input-Output Check**: Verify if subsequent tasks depend on previous task outputs
- **Logical Flow Validation**: Ensure tasks follow natural execution order
- **Dependency Chain Detection**: Identify chains of dependent tasks

### Sequential vs Parallel Task Examples:
- **Sequential Tasks** (Must be separate stages):
  - "整理内容然后发送邮件" → Stage 1: "整理内容", Stage 2: "发送邮件"
  - "收集数据然后分析结果" → Stage 1: "收集数据", Stage 2: "分析结果"
  - "编写代码然后测试功能" → Stage 1: "编写代码", Stage 2: "测试功能"

- **Parallel Tasks** (Can be subtasks in same stage):
  - "搜索A信息和搜索B信息" → Subtask 1: "搜索A信息", Subtask 2: "搜索B信息"
  - "分析X数据和Y数据" → Subtask 1: "分析X数据", Subtask 2: "分析Y数据"
  - "生成报告和准备演示" → Subtask 1: "生成报告", Subtask 2: "准备演示"

### Dependency Validation Rules:
- **No Circular Dependencies**: Tasks cannot depend on themselves or create cycles
- **Clear Prerequisites**: Each task must have clearly defined prerequisites
- **Output Availability**: Ensure required outputs are available when needed
- **Resource Constraints**: Consider resource limitations and conflicts

## STAGE LOGIC AND DEPENDENCY GUIDELINES

### Objective Logic Alignment:
- **Progressive Completion**: Each stage must naturally build toward the final objective
- **Logical Dependencies**: Stage dependencies must reflect the natural order of task completion
- **Prerequisite Awareness**: Each stage must complete its prerequisites before the next stage begins
- **Outcome-Based Planning**: Plan stages based on what outcomes are needed for the next stage

### Subtask Count Optimization:
- **Stage-Specific**: Adjust subtask count based on each stage's complexity and requirements
- **Necessity-Driven**: Generate subtasks only when they are essential for stage completion
- **Efficiency-Focused**: Avoid over-engineering - sometimes fewer, well-designed subtasks are better
- **Quality Over Quantity**: Prioritize subtask quality and necessity over quantity

### Examples of Appropriate Subtask Counts:
- **Data Collection Stage**: 2-3 subtasks (web search, library search, data validation)
- **Analysis Stage**: 1-2 subtasks (data analysis, pattern identification)
- **Synthesis Stage**: 1-2 subtasks (content generation, review)
- **Simple Stages**: 1 subtask may be sufficient
- **Content Generation Stage**: 2-3 subtasks (research topic, create structure, generate content)

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
      "query": "EXPLICIT tool usage instruction - specify the exact tool name and what it should accomplish. Example: 'Use web_search to find current information about [specific topic]' or 'Use generate_doc to create a [specific type] document about [topic]'",
      "status": "pending"
    }
  ],
  "planningLogic": "Explanation of planning decisions and stage dependencies",
  "estimatedTotalEpochs": 3,
  "previousExecutionSummary": "${isInitialPlan ? 'Initial planning - no previous execution' : 'Summary of what has been accomplished so far'}"
}
\`\`\`

## CRITICAL REQUIREMENTS

### Dependency Analysis Requirements:
- **MUST** analyze all task dependencies before generating subtasks
- **MUST** identify sequential tasks and separate them into different stages
- **MUST** identify parallel tasks and group them as subtasks within the same stage
- **MUST** verify that no subtask depends on another subtask's completion
- **MUST** ensure task sequence follows natural logical progression
- **MUST** handle data dependencies properly (outputs available when needed)
- **MUST** consider resource dependencies and resolve conflicts
- **MUST** avoid circular dependencies in the task graph

### Stage and Subtask Structure Requirements:
- **MUST** create sequential stages that depend on each other
- **MUST** generate parallel subtasks for the current active stage
- **MUST** ensure subtasks can run simultaneously within a stage
- **MUST** provide clear dependency explanations between stages
- **MUST** make each stage and subtask actionable and specific
- **MUST** design subtask queries to be tool-executable and action-oriented
- **MUST** ensure each subtask query is specific enough for direct tool implementation
- **MUST** explicitly specify tool names in subtask queries when using built-in tools
- **MUST** avoid ambiguous tool references - be specific about which tool to use
- **MUST** match subtask requirements with appropriate built-in tools
- **MUST** provide clear, actionable instructions for each tool usage
- **MUST** avoid generating overlapping or redundant subtasks
- **MUST** maintain subtask simplicity and avoid unnecessary complexity
- **MUST** ensure each subtask is absolutely necessary for stage completion
- **MUST** follow objective logic for stage dependencies and progression
- **MUST** optimize subtask count based on each stage's specific requirements
- **MUST** prioritize task completion efficiency over subtask quantity
- **MUST** ${isInitialPlan ? 'create optimal initial plan' : 're-optimize based on current progress and execution results'}
- **MUST** ensure logical progression between stages
- **MUST** be realistic about time estimates
- **MUST** ${isInitialPlan ? 'plan comprehensively from scratch' : 'analyze execution quality and adapt planning accordingly'}
- **MUST** incorporate insights from completed stage summaries into future planning
- **MUST** identify and address any quality issues or gaps from previous execution

## VALIDATION CHECKLIST
Before submitting, verify:

### Dependency Analysis Validation:
□ All task dependencies have been analyzed and identified
□ Sequential tasks are properly separated into different stages
□ Parallel tasks are correctly identified as subtasks within the same stage
□ No subtask depends on another subtask's completion
□ Task sequence follows natural logical progression
□ Data dependencies are properly handled (outputs available when needed)
□ Resource dependencies are considered and resolved
□ No circular dependencies exist in the task graph

### Stage and Subtask Structure Validation:
□ Stages are sequential and cannot run in parallel
□ Subtasks within current stage can run in parallel
□ Each stage has clear dependencies on previous stages
□ Current stage subtasks are independent and parallelizable
□ Each subtask has unique, non-overlapping objectives
□ Each subtask is absolutely necessary for stage completion
□ No redundant or overlapping subtasks exist
□ Stage sequence follows objective logic of progressive completion
□ Subtask count is optimized for each stage's specific requirements
□ No artificial inflation of subtask count for concurrency sake
□ Stage dependencies are based on natural, logical progression
□ Overall plan prioritizes completion efficiency over subtask quantity

### Tool and Execution Validation:
□ Subtask queries are tool-specific and immediately actionable
□ Each subtask query explicitly mentions the tool to be used
□ Built-in tools are properly identified and specified in queries
□ No ambiguous tool references or vague instructions
□ Tool usage matches the subtask requirements and objectives
□ Each tool instruction is specific and actionable
□ Each subtask can be executed independently with available tools
□ The execution order is logical and necessary
□ Each stage and subtask has defined objectives
□ The progression makes sense for the user's request
□ ${isInitialPlan ? 'Initial plan is comprehensive and optimal' : 'Re-planning incorporates lessons learned from execution summaries'}
□ ${isInitialPlan ? 'Initial planning is thorough and well-structured' : 'Execution quality has been analyzed and incorporated into planning'}
□ ${isInitialPlan ? 'All stages are properly planned' : 'Completed stage summaries have been thoroughly reviewed and insights applied'}
□ ${isInitialPlan ? 'Tool categories are appropriately assigned' : 'Tool categories have been adjusted based on execution results'}
□ ${isInitialPlan ? 'Time estimates are realistic' : 'Time estimates have been updated based on actual execution experience'}


${locale ? `\n## LANGUAGE REQUIREMENT\nAll output should be in ${locale} language.` : ''}`;
  }

  /**
   * Process stage summary to extract key information for planning context
   * Handles both Chinese and English formats, extracts essential execution details
   */
  private processStageSummary(summary: string): string {
    if (!summary || summary.trim() === '') {
      return 'No execution summary available';
    }

    try {
      // Extract key information from structured summary
      const lines = summary
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      // Key patterns to extract (support both Chinese and English)
      const patterns = {
        // Progress information
        progress:
          /(?:进度|Progress)[：:]\s*第?\s*(\d+)\/(\d+)\s*周期?\s*\((\d+)%\s*(?:完成|complete)\)/i,
        progressEn:
          /(?:Progress|进度)[：:]\s*(\d+)\/(\d+)\s*(?:epochs?|周期?)\s*\((\d+)%\s*(?:complete|完成)\)/i,

        // Completed subtasks
        completedTasks: /(?:已完成子任务|Completed subtasks?)[：:]\s*(.+)/i,
        completedTasksEn: /(?:Completed subtasks?|已完成子任务)[：:]\s*(.+)/i,

        // Current stage
        currentStage: /(?:当前阶段|Current stage)[：:]\s*(.+)/i,
        currentStageEn: /(?:Current stage|当前阶段)[：:]\s*(.+)/i,

        // Target question
        targetQuestion: /(?:目标问题|Target question)[：:]\s*[""](.+)[""]/i,
        targetQuestionEn: /(?:Target question|目标问题)[：:]\s*[""](.+)[""]/i,

        // Language
        language: /(?:语言|Language)[：:]\s*([a-z-]+)/i,
        languageEn: /(?:Language|语言)[：:]\s*([a-z-]+)/i,

        // Completeness assessment
        completeness: /(?:完整性|Completeness)[：:]\s*(\d+)%\s*[-–]\s*(.+)/i,
        completenessEn: /(?:Completeness|完整性)[：:]\s*(\d+)%\s*[-–]\s*(.+)/i,

        // Evidence quality
        evidenceQuality:
          /(?:证据质量|Evidence quality)[：:]\s*(强|中|弱|Strong|Medium|Weak)\s*[-–]\s*(.+)/i,
        evidenceQualityEn:
          /(?:Evidence quality|证据质量)[：:]\s*(Strong|Medium|Weak|强|中|弱)\s*[-–]\s*(.+)/i,
      };

      const extractedInfo: string[] = [];

      // Extract progress information
      const progressMatch = summary.match(patterns.progress) || summary.match(patterns.progressEn);
      if (progressMatch) {
        extractedInfo.push(
          `Progress: ${progressMatch[1]}/${progressMatch[2]} epochs (${progressMatch[3]}% complete)`,
        );
      }

      // Extract completed tasks
      const completedTasksMatch =
        summary.match(patterns.completedTasks) || summary.match(patterns.completedTasksEn);
      if (completedTasksMatch) {
        const tasks = completedTasksMatch[1]
          .split(/[,，]/)
          .map((task) => task.trim())
          .slice(0, 3); // Limit to first 3 tasks
        extractedInfo.push(`Completed tasks: ${tasks.join(', ')}`);
      }

      // Extract current stage
      const currentStageMatch =
        summary.match(patterns.currentStage) || summary.match(patterns.currentStageEn);
      if (currentStageMatch) {
        extractedInfo.push(`Current stage: ${currentStageMatch[1].trim()}`);
      }

      // Extract target question (truncated for brevity)
      const targetQuestionMatch =
        summary.match(patterns.targetQuestion) || summary.match(patterns.targetQuestionEn);
      if (targetQuestionMatch) {
        const question = targetQuestionMatch[1].trim();
        const truncatedQuestion =
          // biome-ignore lint/style/useTemplate: <explanation>
          question.length > 100 ? question.substring(0, 100) + '...' : question;
        extractedInfo.push(`Target: ${truncatedQuestion}`);
      }

      // Extract language
      const languageMatch = summary.match(patterns.language) || summary.match(patterns.languageEn);
      if (languageMatch) {
        extractedInfo.push(`Language: ${languageMatch[1]}`);
      }

      // Extract completeness assessment
      const completenessMatch =
        summary.match(patterns.completeness) || summary.match(patterns.completenessEn);
      if (completenessMatch) {
        extractedInfo.push(
          `Completeness: ${completenessMatch[1]}% - ${completenessMatch[2].trim()}`,
        );
      }

      // Extract evidence quality
      const evidenceQualityMatch =
        summary.match(patterns.evidenceQuality) || summary.match(patterns.evidenceQualityEn);
      if (evidenceQualityMatch) {
        extractedInfo.push(
          `Evidence quality: ${evidenceQualityMatch[1]} - ${evidenceQualityMatch[2].trim()}`,
        );
      }

      // If we extracted meaningful information, return it
      if (extractedInfo.length > 0) {
        return extractedInfo.join(' | ');
      }

      // Fallback: extract first few lines and truncate if too long
      const firstLines = lines.slice(0, 3).join(' | ');
      // biome-ignore lint/style/useTemplate: <explanation>
      return firstLines.length > 200 ? firstLines.substring(0, 200) + '...' : firstLines;
    } catch (error) {
      this.logger.warn(`Error processing stage summary: ${error.message}`);
      // Fallback to truncated original summary
      // biome-ignore lint/style/useTemplate: <explanation>
      return summary.length > 200 ? summary.substring(0, 200) + '...' : summary;
    }
  }

  /**
   * Analyze user intent and generate progress plan (simplified version)
   * This method is used by PilotEngine for backward compatibility
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

      // Use the comprehensive planning method and extract just the ProgressPlan
      const planWithSubtasks = await this.analyzeIntentAndPlanWithSubtasks(
        model,
        userQuestion,
        null, // No existing progress plan
        availableTools,
        canvasContent,
        locale,
      );

      // Convert ProgressPlanWithSubtasks to ProgressPlan
      const progressPlan: ProgressPlan = {
        stages: planWithSubtasks.stages,
        currentStageIndex: planWithSubtasks.currentStageIndex,
        overallProgress: planWithSubtasks.overallProgress,
        lastUpdated: planWithSubtasks.lastUpdated,
        planningLogic: planWithSubtasks.planningLogic,
        userIntent: planWithSubtasks.userIntent,
        estimatedTotalEpochs: planWithSubtasks.estimatedTotalEpochs,
      };

      this.logger.log(`Intent analysis completed. Generated ${progressPlan.stages.length} stages`);
      return progressPlan;
    } catch (error) {
      this.logger.error('Intent analysis failed:', error);
      // Return a default plan as fallback
      return this.generateDefaultPlan(userQuestion);
    }
  }

  /**
   * Generate a default progress plan as fallback
   */
  private generateDefaultPlan(userQuestion: string): ProgressPlan {
    const defaultStage: ProgressStage = {
      id: genPilotStepID(),
      name: 'Research',
      description: 'Initial research and data gathering',
      objectives: ['Gather relevant information', 'Analyze requirements'],
      toolCategories: ['web', 'search', 'data'],
      priority: 1,
      status: 'pending',
      stageProgress: 0,
      subtasks: [],
      createdAt: new Date().toISOString(),
    };

    return {
      stages: [defaultStage],
      currentStageIndex: 0,
      overallProgress: 0,
      lastUpdated: new Date().toISOString(),
      planningLogic: 'Default fallback plan',
      userIntent: userQuestion,
      estimatedTotalEpochs: 1,
    };
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
