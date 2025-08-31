import { z } from 'zod/v3';
import { RunnableConfig } from '@langchain/core/runnables';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { ToolsetDefinition, User } from '@refly/openapi-schema';
import { ReflyService } from './interface';

export const BuiltinToolsetDefinition: ToolsetDefinition = {
  key: 'builtin',
  domain: 'https://refly.ai',
  labelDict: {
    en: 'Builtin',
    'zh-CN': '内建',
  },
  descriptionDict: {
    en: 'Builtin tools that provide access to Refly internal services.',
    'zh-CN': '内建工具，提供对 Refly 内部服务的访问。',
  },
  tools: [
    {
      name: 'library_search',
      descriptionDict: {
        en: 'Search within Refly knowledge base, documents, and resources.',
        'zh-CN': '在 Refly 知识库、文档和资源中搜索。',
      },
    },
    {
      name: 'web_search',
      descriptionDict: {
        en: 'Search the web for current information and news.',
        'zh-CN': '在网络上搜索最新信息和新闻。',
      },
    },
    {
      name: 'create_document',
      descriptionDict: {
        en: 'Create a new document in the knowledge base.',
        'zh-CN': '在知识库中创建新文档。',
      },
    },
    {
      name: 'list_documents',
      descriptionDict: {
        en: 'List available documents for the user.',
        'zh-CN': '列出用户可用的文档。',
      },
    },
    {
      name: 'generate_media',
      descriptionDict: {
        en: 'Generate images, audio, or video content using AI.',
        'zh-CN': '使用 AI 生成图像、音频或视频内容。',
      },
    },
    {
      name: 'generate_doc',
      descriptionDict: {
        en: 'Generate a new document using AI based on a title and configuration.',
        'zh-CN': '基于标题和配置使用 AI 生成新文档。',
      },
    },
    {
      name: 'generate_code_artifact',
      descriptionDict: {
        en: 'Generate a new code artifact using AI based on title, type, and configuration.',
        'zh-CN': '基于标题、类型和配置使用 AI 生成新的代码工件。',
      },
    },
    {
      name: 'send_email',
      descriptionDict: {
        en: 'Send an email to a specified recipient with subject and HTML content.',
        'zh-CN': '向指定收件人发送带有主题和HTML内容的电子邮件。',
      },
    },
    {
      name: 'get_time',
      descriptionDict: {
        en: 'Get the current date and time information.',
        'zh-CN': '获取当前日期和时间信息。',
      },
    },
  ],
};

interface BuiltinToolParams {
  user: User;
  reflyService: ReflyService;
}

export class BuiltinLibrarySearch extends AgentBaseTool<BuiltinToolParams> {
  name = 'library_search';
  toolsetKey = BuiltinToolsetDefinition.key;

  schema = z.object({
    query: z.string().describe('The search query to execute'),
    domains: z
      .array(z.enum(['resource', 'document', 'canvas']))
      .describe('Search domains to include')
      .default(['resource', 'document']),
    mode: z.enum(['keyword', 'vector', 'hybrid']).describe('Search mode').default('vector'),
    limit: z.number().describe('Maximum number of results to return').default(10),
    projectId: z.string().optional().describe('Optional project ID to scope the search'),
  });

  description = 'Search within Refly knowledge base, documents, and resources.';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const result = await reflyService.librarySearch(
        user,
        {
          query: input.query,
          domains: input.domains,
          mode: input.mode,
          limit: input.limit,
          projectId: input.projectId,
        },
        { enableReranker: true },
      );

      return {
        status: 'success',
        data: result,
        summary: `Successfully performed library search for query: "${input.query}" with ${result.data?.length ?? 0} results`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error performing library search',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while performing library search',
      };
    }
  }
}

export class BuiltinWebSearch extends AgentBaseTool<BuiltinToolParams> {
  name = 'web_search';
  toolsetKey = BuiltinToolsetDefinition.key;

  schema = z.object({
    query: z.string().describe('The search query to execute'),
    num_results: z.number().describe('Number of results to return').default(5),
  });
  description = 'Search the web for current information.';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const result = await reflyService.webSearch(user, {
        q: input.query,
        limit: input.num_results,
      });

      return {
        status: 'success',
        data: result,
        summary: `Successfully performed web search for query: "${input.query}" with ${result.data?.length ?? 0} results`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error performing web search',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while performing web search',
      };
    }
  }
}

export class BuiltinCreateDocument extends AgentBaseTool<BuiltinToolParams> {
  name = 'create_document';
  toolsetKey = BuiltinToolsetDefinition.key;

  schema = z.object({
    title: z.string().describe('Title of the document to create'),
    initialContent: z.string().describe('Initial content of the document'),
  });

  description = 'Create a new document in the knowledge base.';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    _: any,
    config: RunnableConfig,
  ): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const document = await reflyService.createDocument(user, {
        title: input.title,
        initialContent: input.initialContent,
        resultId: config.configurable?.resultId,
      });

      return {
        status: 'success',
        data: document,
        summary: `Successfully created document: "${input.title}" with ID: ${document?.docId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error creating document',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while creating document',
      };
    }
  }
}

export class BuiltinListDocuments extends AgentBaseTool<BuiltinToolParams> {
  name = 'list_documents';
  toolsetKey = BuiltinToolsetDefinition.key;

  schema = z.object({
    pageSize: z.number().describe('Maximum number of documents to return').default(20),
    page: z.number().describe('Page number (1-based)').default(1),
    projectId: z.string().optional().describe('Optional project ID to filter documents'),
    canvasId: z.string().optional().describe('Optional canvas ID to filter documents'),
  });

  description = 'List available documents for the user.';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const documents = await reflyService.listDocuments(user, {
        pageSize: input.pageSize,
        page: input.page,
        projectId: input.projectId,
        canvasId: input.canvasId,
      });

      return {
        status: 'success',
        data: documents,
        summary: `Successfully listed ${documents?.length ?? 0} documents for user.`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error listing documents',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while listing documents',
      };
    }
  }
}

export class BuiltinGenerateMedia extends AgentBaseTool<BuiltinToolParams> {
  name = 'generate_media';
  toolsetKey = BuiltinToolsetDefinition.key;

  schema = z.object({
    mediaType: z.enum(['image', 'audio', 'video']).describe('Type of media to generate'),
    prompt: z.string().describe('Prompt describing the media to generate'),
    model: z.string().optional().describe('Optional model to use for generation'),
    provider: z.string().optional().describe('Optional provider to use for generation'),
    targetType: z
      .enum([
        'document',
        'resource',
        'canvas',
        'share',
        'user',
        'project',
        'skillResponse',
        'codeArtifact',
        'page',
        'mediaResult',
      ])
      .optional()
      .describe('Optional target entity type'),
    targetId: z.string().optional().describe('Optional target entity ID'),
  });

  description = 'Generate images, audio, or video content using AI.';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const result = await reflyService.generateMedia(user, {
        mediaType: input.mediaType,
        prompt: input.prompt,
        model: input.model,
        provider: input.provider,
        targetType: input.targetType,
        targetId: input.targetId,
        wait: true,
      });

      return {
        status: 'success',
        data: result,
        summary: `Successfully generated media: ${input.mediaType} with URL: ${result?.outputUrl}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error generating media',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while generating media',
      };
    }
  }
}

export class BuiltinGenerateDoc extends AgentBaseTool<BuiltinToolParams> {
  name = 'generate_doc';
  toolsetKey = BuiltinToolsetDefinition.key;

  schema = z.object({
    title: z.string().describe('Title of the document to generate'),
  });

  description = 'Generate a new document using AI based on a title.';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    _: any,
    config: RunnableConfig,
  ): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const result = await reflyService.generateDoc(user, input.title, config);

      return {
        status: 'success',
        data: result,
        summary: `Successfully generated document: "${input.title}" with ID: ${result.docId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error generating document',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while generating document',
      };
    }
  }
}

export class BuiltinGenerateCodeArtifact extends AgentBaseTool<BuiltinToolParams> {
  name = 'generate_code_artifact';
  toolsetKey = BuiltinToolsetDefinition.key;

  schema = z.object({
    title: z.string().describe('Title of the code artifact to generate'),
    type: z
      .enum([
        'application/refly.artifacts.react',
        'image/svg+xml',
        'application/refly.artifacts.mermaid',
        'text/markdown',
        'application/refly.artifacts.code',
        'text/html',
        'application/refly.artifacts.mindmap',
      ])
      .describe('Type of code artifact to generate'),
  });

  description = 'Generate a new code artifact using AI based on title and type.';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    _: any,
    config: RunnableConfig,
  ): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const result = await reflyService.generateCodeArtifact(user, input.title, input.type, config);

      return {
        status: 'success',
        data: result,
        summary: `Successfully generated code artifact: "${input.title}" with ID: ${result.artifactId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error generating code artifact',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while generating code artifact',
      };
    }
  }
}

export class BuiltinSendEmail extends AgentBaseTool<BuiltinToolParams> {
  name = 'send_email';
  toolsetKey = BuiltinToolsetDefinition.key;

  schema = z.object({
    subject: z.string().describe('The subject of the email'),
    html: z.string().describe('The HTML content of the email'),
    to: z
      .string()
      .describe(
        'The email address of the recipient. If not provided, the email will be sent to the user.',
      )
      .optional(),
  });

  description = 'Send an email to a specified recipient with subject and HTML content.';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      const result = await reflyService.sendEmail(user, {
        subject: input.subject,
        html: input.html,
        to: input.to,
      });

      return {
        status: 'success',
        data: result,
        summary: `Successfully sent email to ${input.to || 'user'} with subject: "${input.subject}"`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error sending email',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while sending email',
      };
    }
  }
}

export class BuiltinGetTime extends AgentBaseTool<BuiltinToolParams> {
  name = 'get_time';
  toolsetKey = BuiltinToolsetDefinition.key;

  schema = z.object({});

  description = 'Get the current date and time information in various formats.';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(_input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const now = new Date();
      const result = {
        currentTime: now.toISOString(),
        timestamp: now.getTime(),
        date: now.toDateString(),
        time: now.toTimeString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        utcOffset: now.getTimezoneOffset(),
      };

      return {
        status: 'success',
        data: result,
        summary: `Successfully retrieved current time: ${result.currentTime}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error getting time',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while getting time',
      };
    }
  }
}

export class BuiltinToolset extends AgentBaseToolset<BuiltinToolParams> {
  toolsetKey = BuiltinToolsetDefinition.key;
  tools = [
    BuiltinLibrarySearch,
    BuiltinWebSearch,
    BuiltinCreateDocument,
    BuiltinListDocuments,
    BuiltinGenerateMedia,
    BuiltinGenerateDoc,
    BuiltinGenerateCodeArtifact,
    BuiltinSendEmail,
    BuiltinGetTime,
  ] satisfies readonly AgentToolConstructor<BuiltinToolParams>[];
}
