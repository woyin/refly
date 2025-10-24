import { z } from 'zod/v3';
import { AgentBaseTool, ToolCallResult, AgentBaseToolset, AgentToolConstructor } from '../base';
import { ToolsetDefinition } from '@refly/openapi-schema';
import { JinaClient } from './client';
import { ToolParams } from '@langchain/core/tools';

export const JinaToolsetDefinition: ToolsetDefinition = {
  key: 'jina',
  domain: 'https://jina.ai',
  labelDict: {
    en: 'Jina',
    'zh-CN': 'Jina',
  },
  descriptionDict: {
    en: 'Jina is a powerful tool that can read the content of a URL',
    'zh-CN': 'Jina 是一个强大的工具，可以读取 URL 的内容',
  },
  tools: [
    {
      name: 'read',
      descriptionDict: {
        en: 'Read the content of a URL',
        'zh-CN': '读取 URL 的内容',
      },
    },
    {
      name: 'serp',
      descriptionDict: {
        en: 'Search the web for a query',
        'zh-CN': '搜索网络以获取查询结果',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'credentials',
      credentialItems: [
        {
          key: 'apiKey',
          inputMode: 'text',
          inputProps: {
            passwordType: true,
          },
          labelDict: {
            en: 'API Key',
            'zh-CN': 'API 密钥',
          },
          descriptionDict: {
            en: 'The API key for Jina',
            'zh-CN': 'Jina  的 API 密钥',
          },
          required: true,
        },
      ],
    },
  ],
  configItems: [],
};

interface JinaToolParams extends ToolParams {
  apiKey: string;
}

export class JinaRead extends AgentBaseTool<JinaToolParams> {
  name = 'read';
  toolsetKey = JinaToolsetDefinition.key;

  schema = z.object({
    url: z.string().describe('The URL to read'),
    returnFormat: z
      .enum(['markdown', 'html', 'text', 'screenshot', 'pageshot'])
      .describe('Output formats to return')
      .default('markdown'),
  });

  description = 'Read the content of a URL';

  protected params: JinaToolParams;

  constructor(params: JinaToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new JinaClient({ apiKey: this.params.apiKey });
      const response = await client.read(input.url, input.returnFormat);

      // Calculate credit cost based on tokens used: 7 credits per million tokens, minimum 1 credit
      const tokens = response.data?.usage?.tokens ?? 0;
      const creditCost = Math.max(1, Math.ceil((tokens / 1_000_000) * 7));

      return {
        status: 'success',
        data: response.data,
        summary: `Successfully read the content of ${input.url}`,
        creditCost,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error reading URL',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while reading URL',
      };
    }
  }
}

export class JinaSerp extends AgentBaseTool<JinaToolParams> {
  name = 'serp';
  toolsetKey = JinaToolsetDefinition.key;

  schema = z.object({
    query: z.string().describe('The query to search for'),
    readFullContent: z
      .boolean()
      .describe(
        'Whether to read the full content of the search results, default is false, try to choose false if possible',
      )
      .default(false),
    site: z.string().describe('The site to search for').optional(),
    offset: z.number().describe('The offset to search for').default(1),
  });

  description = 'Search the web for a query';

  protected params: JinaToolParams;

  constructor(params: JinaToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new JinaClient({ apiKey: this.params.apiKey });
      const response = await client.serp(
        input.query,
        input.readFullContent,
        input.site,
        input.offset,
      );

      // Calculate total tokens from all search results and determine credit cost
      // Each search result has usage.tokens, sum them all up
      const totalTokens =
        response.data?.reduce((sum: number, result: any) => {
          return sum + (result?.usage?.tokens ?? 0);
        }, 0) ?? 0;

      // Calculate credit cost based on tokens used: 7 credits per million tokens, minimum 1 credit
      const creditCost = Math.max(1, Math.ceil((totalTokens / 1_000_000) * 7));

      return {
        status: 'success',
        data: response.data,
        summary: `Successfully searched the web for ${input.query}`,
        creditCost,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error searching the web',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while searching the web',
      };
    }
  }
}
export class JinaToolset extends AgentBaseToolset<JinaToolParams> {
  toolsetKey = JinaToolsetDefinition.key;
  tools = [JinaRead, JinaSerp] satisfies readonly AgentToolConstructor<JinaToolParams>[];
}
