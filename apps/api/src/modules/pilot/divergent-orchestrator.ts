import { Injectable, Logger } from '@nestjs/common';
import { DivergentEngine } from './divergent-engine';
import { PrismaService } from '../common/prisma.service';
import { SkillService } from '../skill/skill.service';
import {
  DivergentSession,
  ConvergenceResult,
  NextActionDecision,
  DivergentTask,
  TaskResult,
} from './types/divergent.types';

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
  ) {}

  /**
   * Execute complete divergent-convergent cycle for a session
   */
  async executeSession(sessionId: string): Promise<void> {
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
        const tasks = await this.generateDivergentTasks(session, currentSummary);

        // Execute tasks in parallel
        const taskResults = await this.executeTasksInParallel(session, tasks);

        // Converge results into new summary
        const convergenceResult = await this.convergeResults(session, taskResults);

        // Create convergence step
        await this.createConvergenceStep(session, convergenceResult);

        // Assess completion and decide next action
        const decision = await this.assessAndDecide(session, convergenceResult);

        if (
          decision.action === 'generate_final_output' ||
          decision.action === 'force_final_output'
        ) {
          await this.generateFinalOutput(session, decision);
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
  private async generateDivergentTasks(session: DivergentSession, currentSummary: string) {
    const canvasContext = await this.getCanvasContext(session.targetId || '');

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
   * Execute multiple tasks in parallel
   */
  private async executeTasksInParallel(session: DivergentSession, tasks: DivergentTask[]) {
    const promises = tasks.map(async (task, index) => {
      try {
        // Create step in database
        const step = await this.createExecutionStep(session, task, index);

        // Execute skill using the skill service
        const result = await this.executeSkill(task.skillName, task.parameters);

        // Update step with result
        await this.updateStepResult(step.stepId, result);

        return {
          stepId: step.stepId,
          skill: task.skillName,
          result,
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
  ): Promise<ConvergenceResult> {
    const canvasContext = await this.getCanvasContext(session.targetId || '');
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
  private async generateFinalOutput(session: DivergentSession, decision: NextActionDecision) {
    const skill = decision.recommendedSkill || 'generateDoc';
    const summary = await this.getCurrentSummary(session);

    // Create final output step
    const step = await this.createFinalOutputStep(session, skill);

    try {
      // Execute final skill using the skill service
      const result = await this.executeSkill(skill, { summary, type: 'final_output' });

      await this.updateStepResult(step.stepId, result);
      this.logger.log(`Generated final output using ${skill}`);
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

  private async createExecutionStep(session: DivergentSession, task: DivergentTask, index: number) {
    return await this.prisma.pilotStep.create({
      data: {
        stepId: `${session.sessionId}-d${session.currentDepth}-t${index}`,
        sessionId: session.sessionId,
        name: task.name,
        epoch: session.currentDepth,
        nodeType: 'execution',
        depth: session.currentDepth,
        convergenceGroup: `depth-${session.currentDepth}`,
        status: 'executing',
      },
    });
  }

  private async createConvergenceStep(
    session: DivergentSession,
    convergenceResult: ConvergenceResult,
  ) {
    return await this.prisma.pilotStep.create({
      data: {
        stepId: `${session.sessionId}-d${session.currentDepth}-summary`,
        sessionId: session.sessionId,
        name: `convergence_summary_depth_${session.currentDepth}`,
        epoch: session.currentDepth,
        nodeType: 'summary',
        depth: session.currentDepth,
        completionScore: convergenceResult.completionScore.toString(),
        status: 'completed',
        rawOutput: JSON.stringify(convergenceResult),
      },
    });
  }

  private async createFinalOutputStep(session: DivergentSession, _skill: string) {
    return await this.prisma.pilotStep.create({
      data: {
        stepId: `${session.sessionId}-final-output`,
        sessionId: session.sessionId,
        name: 'final_output',
        epoch: session.currentDepth,
        nodeType: 'summary',
        depth: session.currentDepth,
        status: 'executing',
      },
    });
  }

  private async updateStepResult(stepId: string, result: Record<string, unknown> | string | null) {
    return await this.prisma.pilotStep.update({
      where: { stepId },
      data: {
        status: 'completed',
        rawOutput: JSON.stringify(result),
      },
    });
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

  private async getCanvasContext(_targetId: string) {
    // TODO: Implement canvas context retrieval
    // For now, return empty context
    return { nodes: [], connections: [] };
  }

  /**
   * Execute a skill with given parameters
   */
  private async executeSkill(
    skillName: string,
    parameters: Record<string, unknown>,
  ): Promise<Record<string, unknown> | string | null> {
    try {
      // TODO: For Week 1, use simplified mock execution
      // In Week 2, integrate with actual skill service
      this.logger.log(`Executing skill: ${skillName} with parameters:`, parameters);

      const mockResults: Record<string, string> = {
        webSearch: `Mock web search results for query: ${parameters.query || 'default query'}`,
        commonQnA: `Mock Q&A analysis: ${parameters.query || 'default analysis'}`,
        librarySearch: `Mock library search results: ${parameters.query || 'default library'}`,
        generateDoc: 'Mock generated document content',
        codeArtifacts: 'Mock code artifacts generated',
      };

      const result = mockResults[skillName] || 'Mock skill execution result';

      return {
        content: result,
        skillName,
        parameters,
        executedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Skill execution failed for ${skillName}:`, error);
      return null;
    }
  }
}
