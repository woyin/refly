import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  ActionResult,
  SkillContext,
  User,
  CreatePilotSessionRequest,
  UpdatePilotSessionRequest,
  EntityType,
} from '@refly/openapi-schema';
import {
  convertContextItemsToNodeFilters,
  convertResultContextToItems,
} from '@refly/canvas-common';
import { PilotSession } from '../../generated/client';
import { SkillService } from '../skill/skill.service';
import { genActionResultID, genPilotSessionID, genPilotStepID } from '@refly/utils';
import { CanvasContentItem } from '../canvas/canvas.dto';
import { ProviderService } from '../provider/provider.service';
import { CanvasService } from '../canvas/canvas.service';
import { CanvasSyncService } from '../canvas-sync/canvas-sync.service';
import { VariableExtractionService } from '../variable-extraction/variable-extraction.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_RUN_PILOT } from '../../utils/const';
import { RunPilotJobData } from './pilot.processor';
import { ProviderItemNotFoundError } from '@refly/errors';

import { buildSummarySkillInput } from './prompt/summary';
import { buildSubtaskSkillInput } from './prompt/subtask';
import { findBestMatch } from '../../utils/similarity';
import { ToolService } from '../tool/tool.service';
import { PilotEngineService } from './pilot-engine.service';
import { PilotSessionWithProgress, PilotStepWithMode, ActionResultWithOutput } from './pilot.types';

export const MAX_STEPS_PER_EPOCH = 10;
export const MAX_SUMMARY_STEPS_PER_EPOCH = 1;

export const MAX_EPOCH = 10;

@Injectable()
export class PilotService {
  private logger = new Logger(PilotService.name);

  constructor(
    private prisma: PrismaService,
    private skillService: SkillService,
    private providerService: ProviderService,
    private toolService: ToolService,
    private canvasService: CanvasService,
    private canvasSyncService: CanvasSyncService,
    private variableExtractionService: VariableExtractionService,
    private pilotEngineService: PilotEngineService,
    @InjectQueue(QUEUE_RUN_PILOT) private runPilotQueue: Queue<RunPilotJobData>,
  ) {}

  /**
   * Create a new pilot session
   * @param user - The user to create the session for
   * @param request - The create request
   * @returns The created session
   */
  async createPilotSession(user: User, request: CreatePilotSessionRequest) {
    const sessionId = genPilotSessionID();
    const providerItem = await this.providerService.findDefaultProviderItem(user, 'agent');

    if (!providerItem) {
      throw new ProviderItemNotFoundError(`provider item ${request.providerItemId} not valid`);
    }

    const session = await this.prisma.pilotSession.create({
      data: {
        sessionId,
        uid: user.uid,
        maxEpoch: request.maxEpoch ?? MAX_EPOCH,
        title: request.title || request.input?.query || 'New Pilot Session',
        input: JSON.stringify(request.input),
        targetType: request.targetType,
        targetId: request.targetId,
        providerItemId: providerItem.itemId,
        status: 'executing',
      },
    });

    // Queue the pilot process instead of running it directly
    await this.runPilotQueue.add(
      `run-pilot-${sessionId}`,
      { user, sessionId, mode: 'subtask' },
      { removeOnComplete: true, removeOnFail: 100 },
    );

    return session;
  }

  /**
   * Update a pilot session
   * @param user - The user updating the session
   * @param request - The update requestf
   * @returns The updated session
   */
  async updatePilotSession(user: User, request: UpdatePilotSessionRequest) {
    const session = await this.prisma.pilotSession.findUnique({
      where: {
        sessionId: request.sessionId,
        uid: user.uid,
      },
    });

    if (!session) {
      throw new Error('Pilot session not found');
    }

    const updatedSession = await this.prisma.pilotSession.update({
      where: {
        sessionId: request.sessionId,
      },
      data: {
        ...(request.maxEpoch ? { maxEpoch: request.maxEpoch } : {}),
        ...(request.input ? { input: JSON.stringify(request.input) } : {}),
      },
    });

    return updatedSession;
  }

  /**
   * List pilot sessions for a user
   * @param user - The user to list sessions for
   * @param targetId - Optional target ID filter
   * @param targetType - Optional target type filter
   * @param page - Page number
   * @param pageSize - Page size
   * @returns List of matched sessions
   */
  async listPilotSessions(
    user: User,
    targetId?: string,
    targetType?: EntityType,
    page = 1,
    pageSize = 10,
  ) {
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const sessions = await this.prisma.pilotSession.findMany({
      where: {
        uid: user.uid,
        ...(targetId ? { targetId } : {}),
        ...(targetType ? { targetType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    return sessions;
  }

  /**
   * Get details of a pilot session including steps
   * @param user - The user to get the session for
   * @param sessionId - The ID of the session to retrieve
   * @returns The session with steps
   */
  async getPilotSessionDetail(user: User, sessionId: string) {
    const session = await this.prisma.pilotSession.findUnique({
      where: {
        sessionId,
        uid: user.uid,
      },
    });

    if (!session) {
      throw new Error('Pilot session not found');
    }

    // Get all steps for the session
    const steps = await this.prisma.pilotStep.findMany({
      where: {
        sessionId,
      },
      orderBy: [{ epoch: 'asc' }, { createdAt: 'asc' }],
    });

    // Get all action results for the session's steps in a single query
    const actionResults = await this.prisma.actionResult.findMany({
      where: {
        pilotStepId: {
          in: steps.map((step) => step.stepId).filter(Boolean),
        },
      },
      orderBy: { version: 'desc' },
    });

    // Create a map of stepId to action result for efficient lookup
    const actionResultMap = actionResults.reduce((map, result) => {
      // Group action results by pilotStepId, keeping only the one with the highest version
      if (!map[result.pilotStepId] || result.version > map[result.pilotStepId].version) {
        map[result.pilotStepId] = result;
      }
      return map;
    }, {});

    // Combine steps with their corresponding action results
    const stepsWithResults = steps.map((step) => ({
      step,
      actionResult: actionResultMap[step.stepId] ?? null,
    }));

    return { session, steps: stepsWithResults };
  }

  /**
   * Convert PilotSession to PilotSessionWithProgress
   */
  private convertToPilotSessionWithProgress(
    session: PilotSession,
    progress?: string | null,
  ): PilotSessionWithProgress {
    return {
      pk: BigInt(0), // Default value, will be overridden by actual data
      sessionId: session.sessionId || '',
      uid: session.uid || '',
      currentEpoch: session.currentEpoch || 0,
      maxEpoch: session.maxEpoch || MAX_EPOCH,
      title: session.title || '',
      input: session.input || '',
      progress: progress || undefined,
      modelName: session.modelName || '',
      targetType: session.targetType || '',
      targetId: session.targetId || '',
      providerItemId: session.providerItemId || '',
      status: session.status || 'waiting',
      createdAt: session.createdAt ? new Date(session.createdAt) : new Date(),
      updatedAt: session.updatedAt ? new Date(session.updatedAt) : new Date(),
    };
  }

  /**
   * Convert PilotStep to PilotStepWithMode
   */
  private convertToPilotStepWithMode(step: any, mode?: string): PilotStepWithMode {
    return {
      stepId: step.stepId || '',
      name: step.name || '',
      epoch: step.epoch || 0,
      entityId: step.entityId,
      entityType: step.entityType,
      status: step.status || 'waiting',
      rawOutput: step.rawOutput,
      mode: mode || 'subtask',
      createdAt: step.createdAt ? new Date(step.createdAt) : new Date(),
      updatedAt: step.updatedAt ? new Date(step.updatedAt) : new Date(),
    };
  }

  /**
   * Convert ActionResult to ActionResultWithOutput
   */
  private convertToActionResultWithOutput(result: any): ActionResultWithOutput {
    return {
      resultId: result.resultId || '',
      title: result.title || '',
      input: result.input || '',
      output: result.output,
      errors: result.errors,
      status: result.status || 'waiting',
      createdAt: result.createdAt ? new Date(result.createdAt) : new Date(),
      updatedAt: result.updatedAt ? new Date(result.updatedAt) : new Date(),
    };
  }

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
              contentPreview: item.contentPreview ?? '',
            },
            isCurrent: true,
          });
          break;
        case 'document':
          context.documents.push({
            docId: item.id,
            document: {
              docId: item.id,
              title: item.title ?? '',
              content: item.content ?? item.contentPreview ?? '',
              contentPreview: item.contentPreview ?? '',
            },
            isCurrent: true,
          });
          break;
        case 'codeArtifact':
          context.codeArtifacts.push({
            artifactId: item.id,
            codeArtifact: {
              artifactId: item.id,
              title: item.title ?? '',
              content: item.content ?? '',
              type: 'text/markdown', // Default type if not specified
            },
            isCurrent: true,
          });
          break;
        case 'skillResponse':
          history.push({
            resultId: item.id,
            title: item.title ?? '',
          });
          break;
        default:
          // For other types, add them as contentList items
          if (item.content || item.contentPreview) {
            context.contentList = context.contentList || [];
            context.contentList.push({
              content: item.content ?? item.contentPreview ?? '',
              metadata: {
                title: item.title,
                id: item.id,
                type: item.type,
              },
            });
          }
          break;
      }
    }

    return { context, history };
  }

  /**
   * Generates a summary title based on user's locale preference
   * @param locale User's preferred output locale
   * @returns Localized summary title
   */
  private getSummaryTitle(locale?: string): string {
    // Default to English if no locale is specified
    const userLocale = locale?.toLowerCase() ?? 'en';

    // Map locale to summary title
    const summaryTitles: Record<string, string> = {
      zh: '阶段总结',
      'zh-cn': '阶段总结',
      'zh-hans': '阶段总结',
      'zh-hans-cn': '阶段总结',
      en: 'Stage Summary',
      'en-us': 'Stage Summary',
      'en-gb': 'Stage Summary',
    };

    // Return localized title or fallback to English
    return summaryTitles[userLocale] ?? summaryTitles.en;
  }

  /**
   * Run the pilot for a given session
   * @param user - The user to run the pilot for
   * @param sessionId - The ID of the session to run the pilot for
   * @param options - Options for running the pilot
   */
  async runPilot(
    user: User,
    sessionId: string,
    options: {
      session?: PilotSession;
      mode?: 'subtask' | 'summary';
    } = {},
  ) {
    try {
      const { session, mode } = options;

      const pilotSession =
        session ??
        (await this.prisma.pilotSession.findUnique({
          where: {
            sessionId,
            uid: user.uid,
          },
        }));

      if (!pilotSession) {
        throw new Error('Pilot session not found');
      }

      const { targetId, targetType, currentEpoch, maxEpoch } = pilotSession;

      // Find all steps in the same epoch
      const epochSteps = await this.prisma.pilotStep.findMany({
        where: {
          sessionId: sessionId,
          epoch: currentEpoch,
        },
      });

      const epochSubtaskSteps = epochSteps.filter((step) => step.mode === 'subtask');
      const epochSummarySteps = epochSteps.filter((step) => step.mode === 'summary');

      if (mode === 'subtask') {
        if (epochSubtaskSteps.length !== 0 || epochSummarySteps.length !== 0) {
          return;
        }
      } else {
        if (epochSummarySteps.length !== 0 || epochSubtaskSteps.length === 0) {
          return;
        }

        return this.runPilotSummary(user, sessionId, session, mode);
      }

      this.logger.log(`Epoch (${currentEpoch}/${maxEpoch}) for session ${sessionId} started`);

      // Get common resources needed for execution
      const sessionInputObj = JSON.parse(pilotSession.input ?? '{}');
      const userQuestion = sessionInputObj?.query ?? '';
      const canvasContentItems: CanvasContentItem[] =
        await this.canvasService.getCanvasContentItems(user, targetId, true);
      const toolsets = await this.toolService.listTools(user, { enabled: true });

      // Get user's output locale preference
      const userPo = await this.prisma.user.findUnique({
        select: { outputLocale: true },
        where: { uid: user.uid },
      });
      const locale = userPo?.outputLocale;

      const agentPi = await this.providerService.findProviderItemById(
        user,
        pilotSession.providerItemId,
      );
      if (!agentPi || agentPi.category !== 'llm' || !agentPi.enabled) {
        throw new ProviderItemNotFoundError(
          `provider item ${pilotSession.providerItemId} not valid for agent`,
        );
      }
      const agentModel = await this.providerService.prepareChatModel(user, agentPi.itemId);

      const chatPi = await this.providerService.findDefaultProviderItem(user, 'chat');
      if (!chatPi || chatPi.category !== 'llm' || !chatPi.enabled) {
        throw new ProviderItemNotFoundError(
          `provider item ${pilotSession.providerItemId} not valid`,
        );
      }
      const chatModelId = JSON.parse(chatPi.config).modelId;

      // Use PilotEngineService to handle all planning and execution logic
      const rawSteps = await this.pilotEngineService.runPilot(
        agentModel,
        sessionId,
        userQuestion,
        toolsets,
        canvasContentItems,
        locale,
      );

      if (rawSteps.length === 0) {
        await this.prisma.pilotSession.update({
          where: { sessionId },
          data: { status: 'finish' },
        });
        this.logger.log(`Pilot session ${sessionId} finished due to no steps`);
        return;
      }

      // Get session details for context building
      const { steps } = await this.getPilotSessionDetail(user, sessionId);
      const latestSummarySteps = steps?.filter(({ step }) => step.epoch === currentEpoch - 1) || [];
      const contextEntityIds = latestSummarySteps.map(({ step }) => step.entityId);
      const { context, history } = await this.buildContextAndHistory(
        canvasContentItems,
        contextEntityIds,
      );

      // Process all steps in parallel instead of sequentially
      for (const rawStep of rawSteps) {
        const stepId = genPilotStepID();

        // *** NEW: Variable extraction logic (only for updating Canvas variables, does not affect actor agents) ***
        if (targetType === 'canvas') {
          this.variableExtractionService
            .extractVariables(
              user,
              rawStep.query, // Original query
              targetId, // Canvas ID
              {
                mode: 'direct',
                triggerType: 'pilot',
              },
            )
            .then(() => {
              this.logger.log(`Variable extraction for step ${rawStep.name} completed`);
            })
            .catch((error) => {
              this.logger.warn(`Variable extraction failed for step ${rawStep.name}:`, error);
            });
        }

        // const recommendedContext = await this.buildContextAndHistory(
        //   canvasContentItems,
        //   rawStep.contextItemIds,
        // );

        const resultId = genActionResultID();

        const actionResult = await this.prisma.actionResult.create({
          data: {
            uid: user.uid,
            resultId,
            title: rawStep.name,
            input: JSON.stringify(
              buildSubtaskSkillInput({
                userQuestion,
                query: rawStep?.query,
              }),
            ),
            status: 'waiting',
            targetId,
            targetType,
            context: JSON.stringify(context),
            history: JSON.stringify(history),
            modelName: chatModelId,
            tier: chatPi.tier,
            errors: '[]',
            pilotStepId: stepId,
            pilotSessionId: sessionId,
            runtimeConfig: '{}',
            providerItemId: chatPi.itemId,
          },
        });
        await this.prisma.pilotStep.create({
          data: {
            stepId,
            name: rawStep.name,
            sessionId,
            epoch: currentEpoch,
            entityId: actionResult.resultId,
            entityType: 'skillResponse',
            rawOutput: JSON.stringify(rawStep),
            status: 'executing',
            mode: 'subtask',
          },
        });

        const contextItems = convertResultContextToItems(context, history);

        if (targetType === 'canvas') {
          await this.canvasSyncService.addNodeToCanvas(
            user,
            targetId,
            {
              type: 'skillResponse',
              data: {
                title: rawStep.name,
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
            { autoLayout: true }, // Enable auto layout for Agent mode
          );
        }

        await this.skillService.sendInvokeSkillTask(user, {
          resultId,
          input: buildSubtaskSkillInput({
            userQuestion,
            query: rawStep?.query,
          }),
          target: {
            entityId: targetId,
            entityType: targetType as EntityType,
          },
          modelName: chatModelId,
          modelItemId: chatPi.itemId,
          context: context,
          resultHistory: history,
          toolsets,
        });
      }

      // Rotate the session status to waiting
      await this.prisma.pilotSession.update({
        where: { sessionId },
        data: {
          status: 'waiting',
        },
      });
    } catch (error) {
      this.logger.error(`Error running pilot for session ${sessionId}:`, error);

      // Update session status to failed when an error occurs
      try {
        await this.prisma.pilotSession.update({
          where: { sessionId },
          data: { status: 'failed' },
        });
        this.logger.log(`Pilot session ${sessionId} status set to failed due to error`);
      } catch (updateError) {
        this.logger.error(`Failed to update session ${sessionId} status to failed:`, updateError);
      }

      // Re-throw the original error to maintain the error handling chain
      throw error;
    }
  }

  /**
   * Run the pilot for a given session
   * @param user - The user to run the pilot for
   * @param sessionId - The ID of the session to run the pilot for
   */
  async runPilotSummary(
    user: User,
    sessionId: string,
    session?: PilotSession,
    _mode?: 'subtask' | 'summary',
  ) {
    try {
      const pilotSession =
        session ??
        (await this.prisma.pilotSession.findUnique({
          where: {
            sessionId,
            uid: user.uid,
          },
        }));

      if (!pilotSession) {
        throw new Error('Pilot session not found');
      }

      const { targetId, targetType, currentEpoch, maxEpoch } = pilotSession;
      const canvasContentItems: CanvasContentItem[] =
        await this.canvasService.getCanvasContentItems(user, targetId, true);

      if (currentEpoch >= maxEpoch) {
        this.logger.log(`Pilot session ${sessionId} finished due to max epoch`);

        if (pilotSession.status !== 'finish') {
          await this.prisma.pilotSession.update({
            where: { sessionId },
            data: { status: 'finish' },
          });
        }

        return;
      }

      this.logger.log(`Epoch (${currentEpoch}/${maxEpoch}) for session ${sessionId} started`);

      // Get user's output locale preference
      const userPo = await this.prisma.user.findUnique({
        select: { outputLocale: true },
        where: { uid: user.uid },
      });
      const locale = userPo?.outputLocale;

      const summaryTitle = this.getSummaryTitle(locale);

      const agentPi = await this.providerService.findProviderItemById(
        user,
        pilotSession.providerItemId,
      );
      if (!agentPi || agentPi.category !== 'llm' || !agentPi.enabled) {
        throw new ProviderItemNotFoundError(
          `provider item ${pilotSession.providerItemId} not valid for agent`,
        );
      }

      const chatPi = await this.providerService.findDefaultProviderItem(user, 'chat');
      if (!chatPi || chatPi.category !== 'llm' || !chatPi.enabled) {
        throw new ProviderItemNotFoundError(
          `provider item ${pilotSession.providerItemId} not valid`,
        );
      }
      const chatModelId = JSON.parse(chatPi.config).modelId;

      const { steps } = await this.getPilotSessionDetail(user, sessionId);

      // const recommendedContext = await this.buildContextAndHistory(
      //   canvasContentItems,
      //   steps.map(({ step }) => step.entityId),
      // );

      const stepId = genPilotStepID();
      const latestSubtaskSteps =
        steps?.filter(({ step }) => step.epoch === currentEpoch && step.mode === 'subtask') || [];

      const contextEntityIds = latestSubtaskSteps.map(({ step }) => step.entityId);

      const { context, history } = await this.buildContextAndHistory(
        canvasContentItems,
        contextEntityIds,
      );
      const resultId = genActionResultID();

      const input = buildSummarySkillInput({
        userQuestion: JSON.parse(pilotSession.input ?? '{}')?.query ?? '',
        currentEpoch,
        maxEpoch,
        subtaskTitles:
          latestSubtaskSteps?.map(({ actionResult }) => actionResult?.title)?.filter(Boolean) ?? [],
        locale,
      });

      // *** NEW: Variable extraction for Summary input (only updates variables, does not affect skill calls) ***
      if (targetType === 'canvas') {
        this.variableExtractionService
          .extractVariables(
            user,
            input.query, // Summary query
            targetId, // Canvas ID
            {
              mode: 'direct',
              triggerType: 'pilot',
            },
          )
          .then(() => {
            this.logger.log('Variable extraction for summary step completed');
          })
          .catch((error) => {
            this.logger.warn('Variable extraction failed for summary step:', error);
          });
      }

      const actionResult = await this.prisma.actionResult.create({
        data: {
          uid: user.uid,
          resultId,
          title: summaryTitle,
          input: JSON.stringify(input),
          status: 'waiting',
          targetId,
          targetType,
          context: JSON.stringify(context),
          history: JSON.stringify(history),
          modelName: chatModelId,
          tier: chatPi.tier,
          errors: '[]',
          pilotStepId: stepId,
          pilotSessionId: sessionId,
          runtimeConfig: '{}',
          tplConfig: '{}',
          providerItemId: chatPi.itemId,
        },
      });
      await this.prisma.pilotStep.create({
        data: {
          stepId,
          name: summaryTitle,
          sessionId,
          epoch: currentEpoch,
          entityId: actionResult.resultId,
          entityType: 'skillResponse',
          rawOutput: JSON.stringify({}),
          status: 'executing',
          mode: 'summary',
        },
      });

      const contextItems = convertResultContextToItems(context, history);

      if (targetType === 'canvas') {
        await this.canvasSyncService.addNodeToCanvas(
          user,
          targetId,
          {
            type: 'skillResponse',
            data: {
              title: summaryTitle,
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
          { autoLayout: true },
        );
      }

      await this.skillService.sendInvokeSkillTask(user, {
        resultId,
        input: input,
        target: {
          entityId: targetId,
          entityType: targetType as EntityType,
        },
        modelName: chatModelId,
        modelItemId: chatPi.itemId,
        context: context,
        resultHistory: history,
        toolsets: [],
      });

      // Rotate the session status to waiting
      await this.prisma.pilotSession.update({
        where: { sessionId },
        data: {
          status: 'waiting',
        },
      });
    } catch (error) {
      this.logger.error(`Error running pilot summary for session ${sessionId}:`, error);

      // Update session status to failed when an error occurs
      try {
        await this.prisma.pilotSession.update({
          where: { sessionId },
          data: { status: 'failed' },
        });
        this.logger.log(`Pilot session ${sessionId} status set to failed due to error in summary`);
      } catch (updateError) {
        this.logger.error(`Failed to update session ${sessionId} status to failed:`, updateError);
      }

      // Re-throw the original error to maintain the error handling chain
      throw error;
    }
  }

  /**
   * Whenever a step is updated, check if all steps in the same epoch are completed.
   * If so, we need to update the session status to completed.
   * If not, we need to continue waiting.
   */
  async syncPilotStep(user: User, stepId: string) {
    try {
      const step = await this.prisma.pilotStep.findUnique({
        where: { stepId },
      });

      if (!step) {
        this.logger.warn(`Pilot step ${stepId} not found`);
        return;
      }

      // Find all steps in the same epoch
      const epochSteps = await this.prisma.pilotStep.findMany({
        where: {
          sessionId: step.sessionId,
          epoch: step.epoch,
        },
      });
      const session = await this.prisma.pilotSession.findUnique({
        where: { sessionId: step.sessionId },
      });

      if (!session) {
        this.logger.warn(`Pilot session ${step.sessionId} not found`);
        return;
      }

      const epochSubtaskSteps = epochSteps.filter((step) => step.mode === 'subtask');
      const epochSummarySteps = epochSteps.filter((step) => step.mode === 'summary');

      const isAllSubtaskStepsFinished =
        epochSubtaskSteps.length > 0 &&
        epochSubtaskSteps.every((step) => step.status === 'finish' || step.status === 'failed');

      const isAllSummaryStepsFinished =
        epochSummarySteps.length > 0 &&
        epochSummarySteps.every((step) => step.status === 'finish' || step.status === 'failed');

      const reachedMaxEpoch = step.epoch > session.maxEpoch - 1;
      this.logger.log(
        `Epoch (${session.currentEpoch}/${session.maxEpoch}) for session ${step.sessionId}: ` +
          `steps are ${isAllSummaryStepsFinished ? 'finished' : 'not finished'}`,
      );

      if (isAllSubtaskStepsFinished && epochSummarySteps.length === 0) {
        await this.runPilotQueue.add(
          `run-pilot-${step.sessionId}-${session.currentEpoch}`,
          {
            user,
            sessionId: step.sessionId,
            mode: 'summary',
          },
          { removeOnComplete: true, removeOnFail: 100 },
        );
        return;
      }

      if (isAllSubtaskStepsFinished && isAllSummaryStepsFinished) {
        await this.prisma.pilotSession.update({
          where: { sessionId: step.sessionId },
          data: {
            status: reachedMaxEpoch ? 'finish' : 'executing',
            ...(!reachedMaxEpoch ? { currentEpoch: session.currentEpoch + 1 } : {}),
          },
        });

        if (!reachedMaxEpoch) {
          // Queue the next runPilot job instead of running it directly

          await this.runPilotQueue.add(
            `run-pilot-${step.sessionId}-${session.currentEpoch + 1}`,
            {
              user,
              sessionId: step.sessionId,
              mode: 'subtask',
            },
            { removeOnComplete: true, removeOnFail: 100 },
          );
        }
      }
    } catch (error) {
      this.logger.error(`Error syncing pilot step ${stepId}:`, error);

      // Try to get the step to identify the session
      try {
        const errorStep = await this.prisma.pilotStep.findUnique({
          where: { stepId },
          select: { sessionId: true },
        });

        if (errorStep?.sessionId) {
          // Update session status to failed when an error occurs in sync
          await this.prisma.pilotSession.update({
            where: { sessionId: errorStep.sessionId },
            data: { status: 'finish' },
          });
          this.logger.log(
            `Pilot session ${errorStep.sessionId} status set to failed due to sync error`,
          );
        }
      } catch (updateError) {
        this.logger.error(
          'Failed to update session status to failed during sync error:',
          updateError,
        );
      }

      // Re-throw the original error to maintain the error handling chain
      throw error;
    }
  }
}
