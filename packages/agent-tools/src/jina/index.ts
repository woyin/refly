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
      return {
        status: 'success',
        data: response.data,
        summary: `Successfully read the content of ${input.url}`,
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

export class JinaToolset extends AgentBaseToolset<JinaToolParams> {
  toolsetKey = JinaToolsetDefinition.key;
  tools = [JinaRead] satisfies readonly AgentToolConstructor<JinaToolParams>[];
}
