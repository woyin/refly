import { z } from 'zod/v3';
import { ApifyClient } from 'apify-client';
import type { ToolParams } from '@langchain/core/tools';
import {
  AgentBaseTool,
  AgentBaseToolset,
  type AgentToolConstructor,
  type ToolCallResult,
} from '../base';
import type { ToolsetDefinition } from '@refly/openapi-schema';

// Toolset definition
export const ApifyToolsetDefinition: ToolsetDefinition = {
  key: 'apify',
  domain: 'https://apify.com',
  labelDict: {
    en: 'Apify',
    'zh-CN': 'Apify',
  },
  descriptionDict: {
    en: 'Run Apify Actors for web automation and data extraction',
    'zh-CN': '运行 Apify Actors 进行网络自动化和数据提取',
  },
  tools: [
    {
      name: 'runActor',
      descriptionDict: {
        en: 'Run an Apify Actor with input data',
        'zh-CN': '使用输入数据运行 Apify Actor',
      },
    },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'credentials',
      credentialItems: [
        {
          key: 'apiToken',
          inputMode: 'text',
          inputProps: { passwordType: true },
          labelDict: { en: 'API Token', 'zh-CN': 'API 令牌' },
          descriptionDict: { en: 'Apify API token', 'zh-CN': 'Apify 的 API 令牌' },
          required: true,
        },
      ],
    },
  ],
  configItems: [],
};

interface ApifyToolParams extends ToolParams {
  apiToken: string;
}

// runActor
export class ApifyRunActor extends AgentBaseTool<ApifyToolParams> {
  name = 'runActor';
  toolsetKey = ApifyToolsetDefinition.key;

  schema = z.object({
    actorId: z.string().describe('The ID of the Apify Actor to run'),
    input: z.record(z.any()).describe('Input data for the Actor'),
  });

  description = 'Run an Apify Actor with input data';

  protected params: ApifyToolParams;

  constructor(params: ApifyToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new ApifyClient({
        token: this.params?.apiToken ?? '',
      });

      // Run the Actor and wait for it to finish
      const run = await client.actor(input.actorId).call(input.input);

      // Fetch and return Actor results from the run's dataset
      const { items } = await client.dataset(run.defaultDatasetId).listItems();

      return {
        status: 'success',
        data: {
          run,
          items,
          datasetUrl: `https://console.apify.com/storage/datasets/${run.defaultDatasetId}`,
        },
        summary: `Successfully ran Actor "${input.actorId}" and retrieved ${items.length} results`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error running Actor',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while running Actor',
      };
    }
  }
}

export class ApifyToolset extends AgentBaseToolset<ApifyToolParams> {
  toolsetKey = ApifyToolsetDefinition.key;
  tools = [ApifyRunActor] satisfies readonly AgentToolConstructor<ApifyToolParams>[];
}
