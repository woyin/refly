import { Injectable, Logger } from '@nestjs/common';
import { DivergentEngine } from './divergent-engine';
import { PrismaService } from '../common/prisma.service';
import { SkillService } from '../skill/skill.service';
import { CanvasService } from '../canvas/canvas.service';
import { CanvasSyncService } from '../canvas/canvas-sync.service';
import { ProviderService } from '../provider/provider.service';
import { User, CanvasNodeType, SkillContext, ActionResult } from '@refly/openapi-schema';
import {
  CanvasNodeFilter,
  convertContextItemsToNodeFilters,
  convertResultContextToItems,
} from '@refly/canvas-common';
import { CanvasContentItem } from '../canvas/canvas.dto';
import {
  DivergentSession,
  ConvergenceResult,
  NextActionDecision,
  DivergentTask,
  TaskResult,
} from './types/divergent.types';
// import { findBestMatch } from '@refly/utils'; // Not available, implement simple version

/**
 * Simple implementation of findBestMatch for string similarity
 */
function findBestMatch(
  target: string,
  candidates: string[],
  _options: { threshold?: number } = {},
): string | null {
  for (const candidate of candidates) {
    if (candidate === target) {
      return candidate; // Exact match
    }
    if (candidate.includes(target) || target.includes(candidate)) {
      return candidate; // Contains match
    }
  }

  // If no good match found within threshold, return first candidate as fallback
  return candidates.length > 0 ? candidates[0] : null;
}

/**
 * Main orchestrator for divergent-convergent workflow
 * Manages the complete "总分总" cycle with LLM intelligence
 */
@Injectable()
export class DivergentOrchestrator {
  private logger = new Logger(DivergentOrchestrator.name);

  constructor(
    private readonly divergentEngine: DivergentEngine,
    private readonly prisma: PrismaService,
    private readonly skillService: SkillService,
    private readonly canvasService: CanvasService,
    private readonly canvasSyncService: CanvasSyncService,
    private readonly providerService: ProviderService,
  ) {}

  /**
   * Execute complete divergent-convergent cycle for a session
   */
  async executeSession(sessionId: string, user: User): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.logger.log(`Starting divergent execution for session ${sessionId}`);

    try {
      while (session.currentDepth < session.maxDepth) {
        // Get current summary (last convergence result or initial input)
        const currentSummary = await this.getCurrentSummary(session);

        // Generate divergent tasks
        const tasks = await this.generateDivergentTasks(session, currentSummary, user);

        // Execute tasks in parallel
        const taskResults = await this.executeTasksInParallel(session, tasks, user);

        // Converge results into new summary
        const convergenceResult = await this.convergeResults(session, taskResults, user);

        // Create convergence step
        await this.createConvergenceStep(session, convergenceResult, user);

        // Assess completion and decide next action
        const decision = await this.assessAndDecide(session, convergenceResult);

        if (
          decision.action === 'generate_final_output' ||
          decision.action === 'force_final_output'
        ) {
          await this.generateFinalOutput(session, decision, user);
          break;
        }

        // Continue to next depth
        session.currentDepth++;
        await this.updateSessionDepth(session);
      }

      // Mark session as completed
      await this.markSessionCompleted(session);
      this.logger.log(`Divergent execution completed for session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error in divergent execution for session ${sessionId}:`, error);
      await this.markSessionFailed(session);
      throw error;
    }
  }

  /**
   * Generate divergent tasks for current summary
   */
  private async generateDivergentTasks(
    session: DivergentSession,
    currentSummary: string,
    user: User,
  ) {
    const canvasContext = await this.getCanvasContext(user, session.targetId || '');

    const tasks = await this.divergentEngine.generateDivergentTasks(
      currentSummary,
      canvasContext,
      session.maxDivergence,
      session.currentDepth,
    );

    this.logger.log(`Generated ${tasks.length} divergent tasks for depth ${session.currentDepth}`);
    return tasks;
  }

  /**
   * Execute multiple tasks in parallel - following runPilot pattern
   */
  private async executeTasksInParallel(
    session: DivergentSession,
    tasks: DivergentTask[],
    user: User,
  ) {
    // Get canvas content items for context building
    const canvasContentItems =
      session.targetType === 'canvas' && session.targetId
        ? await this.canvasService.getCanvasContentItems(user, session.targetId, true)
        : [];

    // Get user's provider configuration
    const chatPi = await this.providerService.findDefaultProviderItem(user, 'chat');
    if (!chatPi || chatPi.category !== 'llm' || !chatPi.enabled) {
      throw new Error(`No valid chat provider found for user ${user.uid}`);
    }
    const chatModelId = JSON.parse(chatPi.config).modelId;

    // Get available skills
    const skills = this.skillService.listSkills(true);

    const promises = tasks.map(async (task, index) => {
      try {
        // Find skill definition
        const skill = skills.find((s) => s.name === task.skillName);
        if (!skill) {
          this.logger.warn(`Skill ${task.skillName} not found, skipping task ${index}`);
          return null;
        }

        // Build context and history (similar to runPilot)
        const { context, history } = await this.buildContextAndHistory(
          canvasContentItems,
          task.contextItemIds || [], // DivergentTask may not have contextItemIds
        );

        // Create ActionResult first (following runPilot pattern)
        const { genActionResultID } = await import('@refly/utils');
        const resultId = genActionResultID();

        const actionResult = await this.prisma.actionResult.create({
          data: {
            uid: user.uid,
            resultId,
            title: task.name,
            actionMeta: JSON.stringify({
              type: 'skill',
              name: skill.name,
              icon: skill.icon,
            }),
            // biome-ignore lint/style/useTemplate: <explanation>
            input: JSON.stringify({ query: task.parameters.query + ' ' + task.parameters.context }),
            status: 'waiting',
            targetId: session.targetId,
            targetType: session.targetType,
            context: JSON.stringify(context),
            history: JSON.stringify(history),
            modelName: chatModelId,
            tier: chatPi.tier,
            errors: '[]',
            pilotStepId: '', // Will be set when step is created
            pilotSessionId: session.sessionId,
            runtimeConfig: '{}',
            tplConfig: '{}',
            providerItemId: chatPi.itemId,
          },
        });

        // Create PilotStep and link to ActionResult
        const step = await this.createExecutionStep(
          session,
          task,
          index,
          user,
          actionResult.resultId,
        );

        // Update ActionResult with stepId
        await this.prisma.actionResult.updateMany({
          where: { resultId },
          data: { pilotStepId: step.stepId },
        });

        // Create Canvas context items (following runPilot pattern)
        const contextItems = convertResultContextToItems(context, history);

        // Add node to Canvas (following runPilot pattern)
        if (session.targetType === 'canvas' && session.targetId) {
          await this.canvasService.addNodeToCanvas(
            user,
            session.targetId,
            {
              type: 'skillResponse',
              data: {
                title: task.name,
                entityId: resultId,
                metadata: {
                  status: 'executing',
                  contextItems,
                  tplConfig: '{}',
                  runtimeConfig: '{}',
                  modelInfo: {
                    modelId: chatModelId,
                  },
                },
              },
            },
            convertContextItemsToNodeFilters(contextItems),
          );
        }

        // Execute skill using SkillService (following runPilot pattern)
        await this.skillService.sendInvokeSkillTask(user, {
          resultId,
          // biome-ignore lint/style/useTemplate: <explanation>
          input: { query: task.parameters.query + ' ' + task.parameters.context },
          target: {
            entityId: session.targetId,
            entityType: session.targetType,
          },
          modelName: chatModelId,
          modelItemId: chatPi.itemId,
          context,
          resultHistory: history,
          skillName: skill.name,
          selectedMcpServers: [],
        });

        return {
          stepId: step.stepId,
          skill: task.skillName,
          result: {
            resultId,
            skillName: task.skillName,
            status: 'executing',
            description: task.description,
          },
        };
      } catch (error) {
        this.logger.warn(`Task ${index} failed:`, error);
        return null; // Failed task returns null
      }
    });

    const results = await Promise.all(promises);
    const successfulResults = results.filter((r) => r !== null);

    this.logger.log(`Completed ${successfulResults.length}/${tasks.length} tasks`);
    return successfulResults;
  }

  /**
   * Converge task results into summary
   */
  private async convergeResults(
    session: DivergentSession,
    taskResults: TaskResult[],
    user: User,
  ): Promise<ConvergenceResult> {
    const canvasContext = await this.getCanvasContext(user, session.targetId || '');
    const originalQuery = typeof session.input === 'string' ? session.input : session.input.query;

    return await this.divergentEngine.convergeResults(
      taskResults,
      originalQuery,
      canvasContext,
      session.currentDepth,
    );
  }

  /**
   * Assess completion and decide next action
   */
  private async assessAndDecide(
    session: DivergentSession,
    convergenceResult: ConvergenceResult,
  ): Promise<NextActionDecision> {
    const originalQuery = typeof session.input === 'string' ? session.input : session.input.query;

    return await this.divergentEngine.assessCompletion(
      convergenceResult,
      originalQuery,
      session.currentDepth,
      session.maxDepth,
    );
  }

  /**
   * Generate final output using appropriate skill
   */
  private async generateFinalOutput(
    session: DivergentSession,
    decision: NextActionDecision,
    user: User,
  ) {
    const skillName = decision.recommendedSkill || 'generateDoc';
    const summary = await this.getCurrentSummary(session);

    // Get canvas content items and provider configuration
    const canvasContentItems =
      session.targetType === 'canvas' && session.targetId
        ? await this.canvasService.getCanvasContentItems(user, session.targetId, true)
        : [];

    const chatPi = await this.providerService.findDefaultProviderItem(user, 'chat');
    if (!chatPi || chatPi.category !== 'llm' || !chatPi.enabled) {
      throw new Error(`No valid chat provider found for user ${user.uid}`);
    }
    const chatModelId = JSON.parse(chatPi.config).modelId;

    const skills = this.skillService.listSkills(true);
    const skill = skills.find((s) => s.name === skillName);
    if (!skill) {
      throw new Error(`Skill ${skillName} not found for final output`);
    }

    // Build context and history
    const { context, history } = await this.buildContextAndHistory(canvasContentItems, []);

    // Create ActionResult first
    const { genActionResultID } = await import('@refly/utils');
    const resultId = genActionResultID();

    const actionResult = await this.prisma.actionResult.create({
      data: {
        uid: user.uid,
        resultId,
        title: `Final Output (${skillName})`,
        actionMeta: JSON.stringify({
          type: 'skill',
          name: skill.name,
          icon: skill.icon,
        }),
        input: JSON.stringify({ query: summary }),
        status: 'waiting',
        targetId: session.targetId,
        targetType: session.targetType,
        context: JSON.stringify(context),
        history: JSON.stringify(history),
        modelName: chatModelId,
        tier: chatPi.tier,
        errors: '[]',
        pilotStepId: '',
        pilotSessionId: session.sessionId,
        runtimeConfig: '{}',
        tplConfig: '{}',
        providerItemId: chatPi.itemId,
      },
    });

    // Create final output step
    const step = await this.createFinalOutputStep(session, skillName, user, actionResult.resultId);

    // Update ActionResult with stepId
    await this.prisma.actionResult.updateMany({
      where: { resultId },
      data: { pilotStepId: step.stepId },
    });

    // Create Canvas context items (following runPilot pattern)
    const contextItems = convertResultContextToItems(context, history);

    // Add final output node to Canvas (following runPilot pattern)
    if (session.targetType === 'canvas' && session.targetId) {
      await this.canvasService.addNodeToCanvas(
        user,
        session.targetId,
        {
          type: 'skillResponse',
          data: {
            title: `Final Output (${skillName})`,
            entityId: resultId,
            metadata: {
              status: 'executing',
              contextItems,
              tplConfig: '{}',
              runtimeConfig: '{}',
              modelInfo: {
                modelId: chatModelId,
              },
            },
          },
        },
        convertContextItemsToNodeFilters(contextItems),
      );
    }

    try {
      // Execute final skill using SkillService
      await this.skillService.sendInvokeSkillTask(user, {
        resultId,
        input: { query: summary },
        target: {
          entityId: session.targetId,
          entityType: session.targetType,
        },
        modelName: chatModelId,
        modelItemId: chatPi.itemId,
        context,
        resultHistory: history,
        skillName: skill.name,
        selectedMcpServers: [],
      });

      this.logger.log(`Generated final output using ${skillName}`);
    } catch (error) {
      this.logger.error('Failed to generate final output:', error);
      throw error;
    }
  }

  // ========== DATABASE HELPER METHODS ==========

  private async getSession(sessionId: string): Promise<DivergentSession | null> {
    const session = await this.prisma.pilotSession.findUnique({
      where: { sessionId },
    });

    if (!session) return null;

    return {
      ...session,
      mode: session.mode || 'divergent',
      maxDivergence: session.maxDivergence || 8,
      maxDepth: session.maxDepth || 5,
      currentDepth: session.currentDepth || 0,
      createdAt: session.createdAt?.toISOString() || '',
      updatedAt: session.updatedAt?.toISOString() || '',
    } as unknown as DivergentSession;
  }

  private async getCurrentSummary(session: DivergentSession): Promise<string> {
    // Get the latest convergence step result, or use initial input
    const latestStep = await this.prisma.pilotStep.findFirst({
      where: {
        sessionId: session.sessionId,
        nodeType: 'summary',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (latestStep?.rawOutput) {
      try {
        const parsed = JSON.parse(latestStep.rawOutput);
        return parsed.summary || latestStep.rawOutput;
      } catch {
        return latestStep.rawOutput;
      }
    }

    return typeof session.input === 'string' ? session.input : session.input.query;
  }

  /**
   * Build context and history from canvas content items (copied from pilot.service.ts)
   */
  private async buildContextAndHistory(
    contentItems: CanvasContentItem[],
    contextItemIds: string[],
  ): Promise<{ context: SkillContext; history: ActionResult[] }> {
    // Create an empty context structure
    const context: SkillContext = {
      resources: [],
      documents: [],
      codeArtifacts: [],
    };
    const history: ActionResult[] = [];

    // If either array is empty, return the empty context
    if (!contentItems?.length || !contextItemIds?.length) {
      return { context, history };
    }

    // For each contextItemId, find the closest matching contentItem using edit distance
    const matchedItems: CanvasContentItem[] = [];

    const contentItemIds = contentItems.map((item) => item.id);

    // Create a map of contentItemId to contentItem for efficient lookup
    const contentItemMap = new Map<string, CanvasContentItem>();
    for (const item of contentItems) {
      contentItemMap.set(item.id, item);
    }

    for (const contextItemId of contextItemIds) {
      // Find the best match with a similarity threshold of 3 from the contentItemIds
      const bestMatch = findBestMatch(contextItemId, contentItemIds, { threshold: 3 });

      // If a match was found and it's reasonably close, add it to the matched items
      // (Using a threshold to avoid completely unrelated matches)
      if (bestMatch) {
        matchedItems.push(contentItemMap.get(bestMatch));
      }
    }

    // Process the matched items and add them to the appropriate context arrays
    for (const item of matchedItems) {
      switch (item?.type) {
        case 'resource':
          context.resources.push({
            resourceId: item.id,
            resource: {
              resourceId: item.id,
              title: item.title ?? '',
              resourceType: 'text', // Default to text if not specified
              content: item.content ?? item.contentPreview ?? '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          });
          break;
        case 'document':
          context.documents.push({
            document: {
              docId: item.id,
              title: item.title ?? '',
              content: item.content ?? item.contentPreview ?? '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          });
          break;
        case 'codeArtifact':
          context.codeArtifacts.push({
            codeArtifact: {
              artifactId: item.id,
              title: item.title ?? '',
              type: 'javascript' as any, // Default type
              language: 'text', // Default language
              content: item.content ?? item.contentPreview ?? '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          });
          break;
        case 'skillResponse':
          // For skillResponse items, try to find the corresponding ActionResult
          try {
            const actionResults = await this.prisma.actionResult.findMany({
              where: { resultId: item.id },
              take: 1,
            });
            if (actionResults.length > 0) {
              // Convert Prisma result to ActionResult type
              const result = actionResults[0];
              const actionResult: ActionResult = {
                ...result,
                type: result.type as any, // Cast to ActionType
                tier: result.tier as any, // Cast to ModelTier
                targetType: result.targetType as any, // Cast to EntityType
                createdAt: result.createdAt.toISOString(), // Convert Date to string
                updatedAt: result.updatedAt.toISOString(), // Convert Date to string
                input: JSON.parse(result.input || '{}'),
                context: JSON.parse(result.context || '{}'),
                history: JSON.parse(result.history || '[]'),
                actionMeta: JSON.parse(result.actionMeta || '{}'),
                runtimeConfig: JSON.parse(result.runtimeConfig || '{}'),
                tplConfig: JSON.parse(result.tplConfig || '{}'),
                errors: JSON.parse(result.errors || '[]'),
              };
              history.push(actionResult);
            }
          } catch (error) {
            this.logger.warn(`Failed to fetch ActionResult for ${item.id}:`, error);
          }
          break;
        default:
          // For unknown types, treat as document
          context.documents.push({
            document: {
              docId: item.id,
              title: item.title ?? 'Unknown Item',
              content: item.content ?? item.contentPreview ?? '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          });
          break;
      }
    }

    return { context, history };
  }

  private async createExecutionStep(
    session: DivergentSession,
    task: DivergentTask,
    index: number,
    _user: User,
    entityId?: string,
  ) {
    const stepId = `${session.sessionId}-d${session.currentDepth}-t${index}`;

    // Create step in database
    const step = await this.prisma.pilotStep.create({
      data: {
        stepId,
        sessionId: session.sessionId,
        name: task.name,
        epoch: session.currentDepth,
        entityId: entityId || stepId, // Use ActionResult ID if provided
        entityType: 'skillResponse',
        rawOutput: JSON.stringify(task),
        nodeType: 'execution',
        depth: session.currentDepth,
        convergenceGroup: `depth-${session.currentDepth}`,
        status: 'executing',
      },
    });

    // Find parent step ID for connection
    let _parentStepId: string | undefined;
    if (session.currentDepth > 0) {
      // Connect to the latest summary step from previous depth
      const parentSummaryStep = await this.prisma.pilotStep.findFirst({
        where: {
          sessionId: session.sessionId,
          nodeType: 'summary',
          depth: session.currentDepth - 1,
        },
        orderBy: { createdAt: 'desc' },
      });
      _parentStepId = parentSummaryStep?.stepId;
    }

    // Canvas node creation is now handled directly in executeTasksInParallel method

    return step;
  }

  private async createConvergenceStep(
    session: DivergentSession,
    convergenceResult: ConvergenceResult,
    _user: User,
  ) {
    const stepId = `${session.sessionId}-d${session.currentDepth}-summary`;
    const summaryTitle = `Summary D${session.currentDepth} (${Math.round(convergenceResult.completionScore * 100)}%)`;

    // Create step in database
    const step = await this.prisma.pilotStep.create({
      data: {
        stepId,
        sessionId: session.sessionId,
        name: summaryTitle,
        epoch: session.currentDepth,
        nodeType: 'summary',
        depth: session.currentDepth,
        completionScore: convergenceResult.completionScore.toString(),
        status: 'completed',
        rawOutput: JSON.stringify(convergenceResult),
      },
    });

    // Find all execution steps from current convergence group
    const executionSteps = await this.prisma.pilotStep.findMany({
      where: {
        sessionId: session.sessionId,
        nodeType: 'execution',
        depth: session.currentDepth,
        convergenceGroup: `depth-${session.currentDepth}`,
      },
      select: { stepId: true },
    });

    const _executionStepIds = executionSteps.map((step) => step.stepId);

    // Add summary node to canvas with connections from execution nodes
    // Canvas summary node creation will be added separately if needed

    return step;
  }

  private async createFinalOutputStep(
    session: DivergentSession,
    skill: string,
    _user: User,
    entityId?: string,
  ) {
    const stepId = `${session.sessionId}-final-output`;
    const finalTitle = `Final Output (${skill})`;

    // Create step in database
    const step = await this.prisma.pilotStep.create({
      data: {
        stepId,
        sessionId: session.sessionId,
        name: finalTitle,
        epoch: session.currentDepth,
        entityId: entityId || stepId, // Use ActionResult ID if provided
        entityType: 'skillResponse',
        rawOutput: JSON.stringify({ skill, type: 'final_output' }),
        nodeType: 'summary',
        depth: session.currentDepth,
        status: 'executing',
      },
    });

    // Find the latest summary step to connect from
    const latestSummaryStep = await this.prisma.pilotStep.findFirst({
      where: {
        sessionId: session.sessionId,
        nodeType: 'summary',
        stepId: { not: stepId }, // Exclude the final output step itself
      },
      orderBy: { createdAt: 'desc' },
      select: { stepId: true },
    });

    const _parentStepIds = latestSummaryStep ? [latestSummaryStep.stepId] : [];

    // Add final output node to canvas
    // Canvas final output node is created in generateFinalOutput method

    return step;
  }

  private async updateSessionDepth(session: DivergentSession) {
    return await this.prisma.pilotSession.update({
      where: { sessionId: session.sessionId },
      data: { currentDepth: session.currentDepth },
    });
  }

  private async markSessionCompleted(session: DivergentSession) {
    return await this.prisma.pilotSession.update({
      where: { sessionId: session.sessionId },
      data: { status: 'completed' },
    });
  }

  private async markSessionFailed(session: DivergentSession) {
    return await this.prisma.pilotSession.update({
      where: { sessionId: session.sessionId },
      data: { status: 'failed' },
    });
  }

  private async getCanvasContext(user: User, targetId: string) {
    if (!targetId) {
      return { nodes: [], connections: [] };
    }

    try {
      // Get canvas state which contains all nodes and edges
      const canvasState = await this.canvasSyncService.getCanvasData(
        user, // Use the real user for proper access control
        { canvasId: targetId },
      );

      // Transform canvas nodes to our CanvasContext format
      const nodes = canvasState.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
      }));

      // Transform canvas edges to our connections format
      const connections = canvasState.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
      }));

      return { nodes, connections };
    } catch (error) {
      this.logger.warn(`Failed to get canvas context for ${targetId}: ${error?.message}`);
      // Return empty context on error to prevent blocking divergent execution
      return { nodes: [], connections: [] };
    }
  }

  // ========== CANVAS INTEGRATION METHODS ==========

  /**
   * Add execution node to canvas for divergent task
   */
  private async addExecutionNodeToCanvas(
    session: DivergentSession,
    stepId: string,
    taskName: string,
    parentStepId: string | undefined,
    user: User,
  ) {
    // Only create canvas nodes for canvas targets
    if (session.targetType !== 'canvas' || !session.targetId) {
      return;
    }

    try {
      // Use the real user for canvas operations to ensure proper transaction tracking

      // Determine connection to parent node if exists
      let connectTo: CanvasNodeFilter[] | undefined = undefined;
      if (parentStepId) {
        connectTo = [
          {
            type: 'skillResponse' as CanvasNodeType,
            entityId: parentStepId,
            handleType: 'source' as const,
          },
        ];
      }

      await this.canvasService.addNodeToCanvas(
        user,
        session.targetId,
        {
          type: 'skillResponse',
          data: {
            title: taskName,
            entityId: stepId,
            metadata: {
              status: 'executing',
              contextItems: [], // Required by frontend - empty for divergent tasks
              tplConfig: '{}', // Required by frontend
              runtimeConfig: '{}', // Required by frontend
              modelInfo: {
                modelId: 'divergent-execution',
              },
              // Custom divergent metadata (preserved for internal use)
              nodeType: 'execution',
              depth: session.currentDepth,
              convergenceGroup: `depth-${session.currentDepth}`,
            },
            // sizeMode: 'compact', // Removed - not part of CanvasNodeData interface
          },
        },
        connectTo,
      );

      this.logger.log(`Added execution node to canvas: ${stepId}`);
    } catch (error) {
      this.logger.error(`Failed to add execution node to canvas: ${stepId}`, error);
    }
  }

  /**
   * Add summary node to canvas for convergence result
   */
  private async addSummaryNodeToCanvas(
    session: DivergentSession,
    stepId: string,
    summaryTitle: string,
    convergenceGroupStepIds: string[],
    user: User,
  ) {
    // Only create canvas nodes for canvas targets
    if (session.targetType !== 'canvas' || !session.targetId) {
      return;
    }

    try {
      // Use the real user for canvas operations to ensure proper transaction tracking

      // Connect from all execution nodes in the convergence group
      const connectTo: CanvasNodeFilter[] = convergenceGroupStepIds.map((executionStepId) => ({
        type: 'skillResponse' as CanvasNodeType,
        entityId: executionStepId,
        handleType: 'source' as const,
      }));

      await this.canvasService.addNodeToCanvas(
        user,
        session.targetId,
        {
          type: 'skillResponse',
          data: {
            title: summaryTitle,
            entityId: stepId,
            metadata: {
              status: 'completed',
              contextItems: [], // Required by frontend - empty for summary nodes
              tplConfig: '{}', // Required by frontend
              runtimeConfig: '{}', // Required by frontend
              modelInfo: {
                modelId: 'divergent-summary',
              },
              // Custom divergent metadata (preserved for internal use)
              nodeType: 'summary',
              depth: session.currentDepth,
            },
            // sizeMode: 'compact', // Removed - not part of CanvasNodeData interface
          },
        },
        connectTo,
      );

      this.logger.log(`Added summary node to canvas: ${stepId}`);
    } catch (error) {
      this.logger.error(`Failed to add summary node to canvas: ${stepId}`, error);
    }
  }
}
