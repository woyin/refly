import { Injectable, Logger } from '@nestjs/common';
import { throttle } from 'lodash';
import { User, UpsertDocumentRequest, CodeArtifactType } from '@refly/openapi-schema';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { PrismaService } from '../common/prisma.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { CollabService } from '../collab/collab.service';
import { CanvasService } from '../canvas/canvas.service';
import { CollabContext } from '../collab/collab.dto';
import { ProviderService } from '../provider/provider.service';
import { CodeArtifactService } from '../code-artifact/code-artifact.service';
import { Document as DocumentPO } from '../../generated/client';
import {
  getArtifactContentAndAttributes,
  incrementalMarkdownUpdate,
  safeParseJSON,
} from '@refly/utils';
import { SkillRunnableConfig } from '@refly/skill-template/src/base';
import {
  SkillPromptModule,
  buildFinalRequestMessages,
  generateDocPromptModule,
  codeArtifactsPromptModule,
} from '@refly/skill-template';

@Injectable()
export class InternalToolService {
  private readonly logger = new Logger(InternalToolService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledgeService: KnowledgeService,
    private readonly providerService: ProviderService,
    private readonly collabService: CollabService,
    private readonly canvasService: CanvasService,
    private readonly codeArtifactService: CodeArtifactService,
  ) {}

  /**
   * Generate a document based on user query with LLM streaming
   */
  async generateDoc(
    user: User,
    title: string,
    // outline: string,
    config: SkillRunnableConfig,
  ): Promise<{ docId: string }> {
    const { resultId } = config.configurable;

    this.logger.log(
      `Starting document generation for user ${user.uid} with title: ${title} and resultId: ${resultId}`,
    );

    try {
      const actionResult = await this.prisma.actionResult.findFirst({
        where: {
          resultId,
        },
        orderBy: {
          version: 'desc',
        },
        take: 1,
      });

      if (!actionResult) {
        throw new Error('Action result not found');
      }

      const { targetId, targetType, projectId, input, title, providerItemId } = actionResult;

      const canvasId: string | null = targetType === 'canvas' ? targetId : null;

      // Create document
      const documentRequest: UpsertDocumentRequest = {
        title,
        initialContent: '',
        projectId,
        canvasId,
      };

      const document = await this.knowledgeService.createDocument(user, documentRequest);

      // Add node to canvas if canvasId is provided
      if (canvasId) {
        await this.canvasService.addNodeToCanvas(
          user,
          canvasId,
          {
            type: 'document',
            data: {
              title: document.title,
              entityId: document.docId,
              metadata: {
                status: 'finish',
              },
            },
          },
          [{ type: 'skillResponse', entityId: resultId }],
        );
      }

      // Stream LLM response
      const chatModel = await this.providerService.prepareChatModel(user, providerItemId);

      const { requestMessages } = await this.commonPreprocess(
        safeParseJSON(input).query ?? title,
        config,
        generateDocPromptModule,
      );

      await this.streamLLMResponse(chatModel, requestMessages, document);

      return {
        docId: document.docId,
      };
    } catch (error) {
      this.logger.error(`Document generation failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async generateCodeArtifact(
    user: User,
    title: string,
    type: CodeArtifactType,
    config: SkillRunnableConfig,
  ): Promise<{ artifactId: string }> {
    const { resultId } = config.configurable;

    this.logger.log(
      `Starting code artifact generation for user ${user.uid} with title: ${title} and resultId: ${resultId}`,
    );

    try {
      const actionResult = await this.prisma.actionResult.findFirst({
        where: {
          resultId,
        },
        orderBy: {
          version: 'desc',
        },
        take: 1,
      });

      if (!actionResult) {
        throw new Error('Action result not found');
      }

      const { targetId, targetType, input, providerItemId } = actionResult;

      const canvasId: string | null = targetType === 'canvas' ? targetId : null;

      // Create code artifact
      const codeArtifact = await this.codeArtifactService.createCodeArtifact(user, {
        title,
        type,
        language: 'text',
        content: '',
        canvasId,
      });

      // Add node to canvas if canvasId is provided
      if (canvasId) {
        await this.canvasService.addNodeToCanvas(
          user,
          canvasId,
          {
            type: 'codeArtifact',
            data: {
              title: codeArtifact.title,
              entityId: codeArtifact.artifactId,
              metadata: {
                status: 'generating',
              },
            },
          },
          [{ type: 'skillResponse', entityId: resultId }],
        );
      }

      // Stream LLM response
      const chatModel = await this.providerService.prepareChatModel(user, providerItemId);

      const { requestMessages } = await this.commonPreprocess(
        safeParseJSON(input).query ?? title,
        config,
        codeArtifactsPromptModule,
      );

      await this.streamLLMResponseForCodeArtifact(
        chatModel,
        requestMessages,
        codeArtifact,
        resultId,
        user,
      );

      return {
        artifactId: codeArtifact.artifactId,
      };
    } catch (error) {
      this.logger.error(`Code artifact generation failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async commonPreprocess(
    query: string,
    config: SkillRunnableConfig,
    module: SkillPromptModule,
  ): Promise<{
    optimizedQuery: string;
    requestMessages: any[];
    context: string;
    sources: any[];
    usedChatHistory: any[];
    rewrittenQueries: any[];
  }> {
    // Handle case where preprocessResult might not exist
    const preprocessResult = (config as any).preprocessResult || {};
    const {
      optimizedQuery = '',
      rewrittenQueries = [],
      context = '',
      sources = [],
      usedChatHistory = [],
    } = preprocessResult;
    const { locale = 'en', modelConfigMap, project } = config.configurable;
    const modelInfo = modelConfigMap?.chat;

    // Extract customInstructions from project if available
    const customInstructions = project?.customInstructions;

    const requestMessages = buildFinalRequestMessages({
      module,
      locale,
      chatHistory: usedChatHistory,
      messages: [],
      context,
      images: [],
      originalQuery: query,
      optimizedQuery,
      rewrittenQueries,
      modelInfo,
      customInstructions,
    });

    return { optimizedQuery, requestMessages, context, sources, usedChatHistory, rewrittenQueries };
  }

  /**
   * Stream LLM response and update document content
   */
  private async streamLLMResponse(
    model: BaseChatModel,
    messages: any[],
    doc: DocumentPO,
  ): Promise<void> {
    // Open direct connection to document for real-time updates
    const collabContext: CollabContext = {
      user: { uid: doc.uid } as User,
      entity: doc,
      entityType: 'document',
    };

    const connection = await this.collabService.openDirectConnection(doc.docId, collabContext);

    const throttledMarkdownUpdate = throttle(
      (content: string) => {
        incrementalMarkdownUpdate(connection.document, content);
      },
      20,
      {
        leading: true,
        trailing: true,
      },
    );

    let accumulatedContent = '';

    try {
      // Stream the LLM response
      const stream = await model.stream(messages);

      for await (const chunk of stream) {
        if (chunk.content) {
          const content = chunk.content.toString();
          accumulatedContent += content;
          throttledMarkdownUpdate(accumulatedContent);
        }
      }
    } finally {
      // Clean up connection
      if (connection) {
        connection.disconnect();
      }
    }
  }

  /**
   * Stream LLM response and update code artifact content
   */
  private async streamLLMResponseForCodeArtifact(
    model: BaseChatModel,
    messages: any[],
    codeArtifact: any,
    resultId: string,
    user: User,
  ): Promise<void> {
    const throttledCodeArtifactUpdate = throttle(
      async (content: string) => {
        // Extract code content and attributes from content string
        const {
          content: codeContent,
          language,
          type,
          title,
        } = getArtifactContentAndAttributes(content);

        await this.codeArtifactService.updateCodeArtifact(user, {
          artifactId: codeArtifact.artifactId,
          title: title ?? codeArtifact.title,
          type: type ?? codeArtifact.type,
          language: language ?? codeArtifact.language,
          content: codeContent,
          createIfNotExists: false,
          resultId,
          resultVersion: codeArtifact.version,
        });
      },
      1000,
      { leading: true, trailing: true },
    );

    let accumulatedContent = '';

    try {
      // Stream the LLM response
      const stream = await model.stream(messages);

      for await (const chunk of stream) {
        if (chunk.content) {
          const content = chunk.content.toString();
          accumulatedContent += content;
          throttledCodeArtifactUpdate(accumulatedContent);
        }
      }
    } finally {
      // Final update to ensure all content is saved
      if (accumulatedContent) {
        throttledCodeArtifactUpdate.flush();
      }
    }
  }
}
