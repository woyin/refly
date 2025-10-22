import { z } from 'zod/v3';
import type { ToolParams } from '@langchain/core/tools';
import {
  AgentBaseTool,
  AgentBaseToolset,
  type AgentToolConstructor,
  type ToolCallResult,
} from '../base';
import type { ToolsetDefinition } from '@refly/openapi-schema';
// Note: Avoid importing 'got-scraping' here to maintain compatibility with CJS runtime.
// 'got-scraping' is ESM-only and causes resolution errors under ts-node CJS.

// Constants derived from external Apify reference
const LIMIT = 100;

// Event types used by Apify webhooks (kept for parity with external reference)
const EVENT_TYPES: string[] = [
  'ACTOR.RUN.CREATED',
  'ACTOR.RUN.SUCCEEDED',
  'ACTOR.RUN.FAILED',
  'ACTOR.RUN.ABORTED',
  'ACTOR.RUN.TIMED_OUT',
  'ACTOR.RUN.RESURRECTED',
];

/**
 * Minimal Apify REST client to mirror external functionality.
 * Uses fetch() and supports query params via URLSearchParams.
 */
class ApifyClient {
  private readonly baseUrl = 'https://api.apify.com/v2';
  private readonly apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiToken}`,
      'x-apify-integration-platform': 'refly',
    };
  }

  private buildUrl(path: string, params?: Record<string, unknown>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    const query = new URLSearchParams();
    if (params && typeof params === 'object') {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        query.set(key, String(value));
      }
    }
    const qs = query.toString();
    return qs.length > 0 ? `${url.toString()}?${qs}` : url.toString();
  }

  private async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options?: { params?: Record<string, unknown>; body?: unknown },
  ): Promise<T> {
    const url = this.buildUrl(path, options?.params);
    const init: RequestInit = {
      method,
      headers: this.buildHeaders(),
    };
    if (options?.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }
    const res = await fetch(url, init);
    if (!res.ok) {
      let detail: any = undefined;
      try {
        detail = await res.json();
      } catch {
        // ignore
      }
      const message = detail?.error ?? detail?.message ?? `HTTP ${res.status}: ${res.statusText}`;
      throw new Error(message);
    }
    // Some Apify endpoints return raw bodies; default to JSON parsing
    try {
      return (await res.json()) as T;
    } catch {
      const text = await res.text();
      return text as unknown as T;
    }
  }

  // Webhooks
  createHook(body: unknown): Promise<any> {
    return this.request('POST', '/webhooks', { body });
  }

  deleteHook(hookId: string): Promise<any> {
    return this.request('DELETE', `/webhooks/${hookId}`);
  }

  // Actors
  runActor(actorId: string, body: unknown, params?: Record<string, unknown>): Promise<any> {
    return this.request('POST', `/acts/${actorId}/run-sync`, { body, params });
  }

  runActorAsynchronously(
    actorId: string,
    body: unknown,
    params?: Record<string, unknown>,
  ): Promise<any> {
    return this.request('POST', `/acts/${actorId}/runs`, { body, params });
  }

  getBuild(build: string): Promise<any> {
    return this.request('GET', `/actor-builds/${build}`);
  }

  listActors(params?: Record<string, unknown>): Promise<any> {
    return this.request('GET', '/store', { params });
  }

  listUserActors(params?: Record<string, unknown>): Promise<any> {
    return this.request('GET', '/acts', { params });
  }

  listTasks(params?: Record<string, unknown>): Promise<any> {
    return this.request('GET', '/actor-tasks', { params });
  }

  listBuilds(actorId: string, params?: Record<string, unknown>): Promise<any> {
    return this.request('GET', `/acts/${actorId}/builds`, { params });
  }

  // KV store
  setKeyValueStoreRecord(storeId: string, recordKey: string, body: unknown): Promise<any> {
    return this.request('PUT', `/key-value-stores/${storeId}/records/${recordKey}`, { body });
  }

  // Datasets
  listDatasets(params?: Record<string, unknown>): Promise<any> {
    return this.request('GET', '/datasets', { params });
  }

  listDatasetItems(datasetId: string, params?: Record<string, unknown>): Promise<any> {
    return this.request('GET', `/datasets/${datasetId}/items`, { params });
  }

  // Tasks
  runTaskSynchronously(taskId: string, params?: Record<string, unknown>): Promise<any> {
    return this.request('GET', `/actor-tasks/${taskId}/run-sync-get-dataset-items`, { params });
  }
}

// Utility compatible with external parseObject
const parseObject = (obj: unknown): unknown => {
  if (!obj) return undefined;
  if (Array.isArray(obj)) {
    return obj.map((item) => {
      if (typeof item === 'string') {
        try {
          return JSON.parse(item);
        } catch {
          return item;
        }
      }
      return item;
    });
  }
  if (typeof obj === 'string') {
    try {
      return JSON.parse(obj);
    } catch {
      return obj;
    }
  }
  return obj;
};

// Toolset definition
export const ApifyToolsetDefinition: ToolsetDefinition = {
  key: 'apify',
  domain: 'https://apify.com',
  labelDict: {
    en: 'Apify',
    'zh-CN': 'Apify',
  },
  descriptionDict: {
    en: 'Apify web automation and data extraction tools',
    'zh-CN': 'Apify 网络自动化与数据提取工具',
  },
  tools: [
    {
      name: 'getDatasetItems',
      descriptionDict: {
        en: 'Returns data stored in a dataset',
        'zh-CN': '获取指定数据集中的数据',
      },
    },
    {
      name: 'runActor',
      descriptionDict: { en: 'Run an Actor (sync or async)', 'zh-CN': '运行 Actor（同步或异步）' },
    },
    {
      name: 'runTaskSynchronously',
      descriptionDict: {
        en: 'Run a task and return dataset items',
        'zh-CN': '同步运行任务并返回数据集条目',
      },
    },
    {
      name: 'scrapeSingleUrl',
      descriptionDict: {
        en: 'Scrape a single URL and return HTML',
        'zh-CN': '抓取单个 URL 并返回 HTML 内容',
      },
    },
    {
      name: 'setKeyValueStoreRecord',
      descriptionDict: {
        en: 'Create or update a KV store record',
        'zh-CN': '创建或更新 KV 存储记录',
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

// getDatasetItems
export class ApifyGetDatasetItems extends AgentBaseTool<ApifyToolParams> {
  name = 'getDatasetItems';
  toolsetKey = ApifyToolsetDefinition.key;

  schema = z.object({
    datasetId: z.string().describe('The ID of the dataset to retrieve items within'),
    clean: z.boolean().optional().describe('Return only non-empty items and skip hidden fields'),
    fields: z.array(z.string()).optional().describe('Fields to pick'),
    omit: z.array(z.string()).optional().describe('Fields to omit'),
    flatten: z.array(z.string()).optional().describe('Fields to flatten'),
    maxResults: z
      .number()
      .int()
      .positive()
      .default(LIMIT)
      .describe('Max number of items to return'),
  });

  description = 'Returns data stored in a dataset';

  protected params: ApifyToolParams;

  constructor(params: ApifyToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new ApifyClient(this.params?.apiToken ?? '');
      const results: any[] = [];
      let offset = 0;
      let total = 0;
      const maxResults = input?.maxResults ?? LIMIT;
      do {
        const params: Record<string, unknown> = {
          limit: LIMIT,
          offset,
          clean: input?.clean,
          fields:
            Array.isArray(input?.fields) && input?.fields?.length
              ? input?.fields?.join(',')
              : undefined,
          omit:
            Array.isArray(input?.omit) && input?.omit?.length ? input?.omit?.join(',') : undefined,
          flatten:
            Array.isArray(input?.flatten) && input?.flatten?.length
              ? input?.flatten?.join(',')
              : undefined,
        };
        const items = await client.listDatasetItems(input.datasetId, params);
        const page = (Array.isArray(items) ? items : (items?.items ?? [])) as any[];
        if (Array.isArray(page) && page.length > 0) {
          results.push(...page);
        }
        if (results.length >= maxResults) break;
        total = page?.length ?? 0;
        offset += LIMIT;
      } while (total);

      if (results.length > maxResults) {
        results.length = maxResults;
      }

      return {
        status: 'success',
        data: results,
        summary:
          results.length > 0
            ? `Successfully retrieved ${results.length} item${results.length === 1 ? '' : 's'}`
            : 'No items found',
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error retrieving dataset items',
        summary:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while retrieving dataset items',
      };
    }
  }
}

// runActor
export class ApifyRunActor extends AgentBaseTool<ApifyToolParams> {
  name = 'runActor';
  toolsetKey = ApifyToolsetDefinition.key;

  schema = z.object({
    actorId: z.string().describe('Actor ID or a tilde-separated owner and name'),
    buildId: z.string().describe('Actor build ID or tag').optional(),
    runAsynchronously: z.boolean().describe('Whether to run asynchronously').default(false),
    outputRecordKey: z
      .string()
      .describe('Key of the record to return (async mode only)')
      .optional(),
    waitForFinish: z
      .string()
      .describe('Max seconds to wait for finish (sync mode), 0 by default, max 60')
      .optional(),
    timeout: z.string().describe('Timeout in seconds').optional(),
    memory: z.string().describe('Memory limit in MB').optional(),
    maxItems: z.string().describe('Maximum number of items for pay-per-result Actors').optional(),
    maxTotalChargeUsd: z.string().describe('Maximum cost for pay-per-event Actors').optional(),
    webhook: z.string().describe('Webhook URL to receive run events').optional(),
    eventTypes: z.array(z.string()).describe('Event types to send to the webhook').optional(),
    properties: z
      .record(z.any())
      .describe('Actor input object, if provided overrides dynamic mapping')
      .optional(),
    data: z
      .record(z.any())
      .describe('Actor input object, used when properties is not provided')
      .optional(),
  });

  description = 'Run an Actor (sync or async)';

  protected params: ApifyToolParams;

  constructor(params: ApifyToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new ApifyClient(this.params?.apiToken ?? '');
      const runAsync = input?.runAsynchronously ?? false;

      const payload = input?.properties
        ? parseObject(input.properties)
        : parseObject(input?.data ?? {});
      const params: Record<string, unknown> = {
        outputRecordKey: input?.outputRecordKey,
        timeout: input?.timeout,
        memory: input?.memory,
        maxItems: input?.maxItems,
        maxTotalChargeUsd: input?.maxTotalChargeUsd,
        waitForFinish: input?.waitForFinish,
        webhooks: input?.webhook
          ? Buffer.from(
              JSON.stringify([
                {
                  eventTypes:
                    Array.isArray(input?.eventTypes) && input?.eventTypes?.length
                      ? input.eventTypes
                      : EVENT_TYPES,
                  requestUrl: input.webhook,
                },
              ]),
            ).toString('base64')
          : undefined,
      };

      const response = runAsync
        ? await client.runActorAsynchronously(input.actorId, { data: payload }, params)
        : await client.runActor(input.actorId, { data: payload }, params);

      const summary = runAsync
        ? 'Successfully started Actor run'
        : `Successfully ran Actor with ID: ${input.actorId}`;

      return {
        status: 'success',
        data: response,
        summary,
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

// runTaskSynchronously
export class ApifyRunTaskSynchronously extends AgentBaseTool<ApifyToolParams> {
  name = 'runTaskSynchronously';
  toolsetKey = ApifyToolsetDefinition.key;

  schema = z.object({
    taskId: z.string().describe('The ID of the task to run'),
    timeout: z.number().int().describe('Timeout seconds').optional(),
    memory: z.number().int().describe('Memory MB').optional(),
    build: z.string().describe('Build tag or number').optional(),
    clean: z.boolean().describe('Return only non-empty items and skip hidden fields').optional(),
    fields: z.array(z.string()).describe('Fields to pick').optional(),
    omit: z.array(z.string()).describe('Fields to omit').optional(),
    flatten: z.array(z.string()).describe('Fields to flatten').optional(),
    maxResults: z.number().int().describe('Max number of items to return').optional(),
  });

  description = 'Run a specific task and return its dataset items';

  protected params: ApifyToolParams;

  constructor(params: ApifyToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new ApifyClient(this.params?.apiToken ?? '');
      const params: Record<string, unknown> = {
        timeout: input?.timeout,
        memory: input?.memory,
        build: input?.build,
        clean: input?.clean,
        fields:
          Array.isArray(input?.fields) && input?.fields?.length
            ? input?.fields?.join(',')
            : undefined,
        omit:
          Array.isArray(input?.omit) && input?.omit?.length ? input?.omit?.join(',') : undefined,
        flatten:
          Array.isArray(input?.flatten) && input?.flatten?.length
            ? input?.flatten?.join(',')
            : undefined,
        maxItems: input?.maxResults,
      };
      const response = await client.runTaskSynchronously(input.taskId, params);
      return {
        status: 'success',
        data: response,
        summary: `Successfully ran task with ID: ${input.taskId}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error running task synchronously',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while running task',
      };
    }
  }
}

// scrapeSingleUrl
export class ApifyScrapeSingleUrl extends AgentBaseTool<ApifyToolParams> {
  name = 'scrapeSingleUrl';
  toolsetKey = ApifyToolsetDefinition.key;

  schema = z.object({
    url: z.string().describe('The URL of the web page to scrape'),
  });

  description = 'Execute a simple scraper on a specific website and return HTML';

  // No custom constructor required

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      // Use built-in fetch to avoid ESM-only dependency issues in CJS runtime
      const res = await fetch(input.url, {
        // Provide basic headers to mimic a regular browser visit
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
        },
      });
      const body = await res.text();
      return {
        status: 'success',
        data: body,
        summary: `Successfully scraped content from ${input.url}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error scraping URL',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while scraping URL',
      };
    }
  }
}

// setKeyValueStoreRecord
export class ApifySetKeyValueStoreRecord extends AgentBaseTool<ApifyToolParams> {
  name = 'setKeyValueStoreRecord';
  toolsetKey = ApifyToolsetDefinition.key;

  schema = z.object({
    keyValueStoreId: z.string().describe('The ID of the key-value store'),
    key: z.string().describe('The key of the record'),
    value: z.record(z.any()).describe('The value of the record'),
  });

  description = 'Create or update a record in the key-value store';

  protected params: ApifyToolParams;

  constructor(params: ApifyToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      const client = new ApifyClient(this.params?.apiToken ?? '');
      const response = await client.setKeyValueStoreRecord(input.keyValueStoreId, input.key, {
        data: parseObject(input.value),
      });
      return {
        status: 'success',
        data: response,
        summary: `Successfully set the record with key '${input.key}'`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error setting key-value store record',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while setting record',
      };
    }
  }
}

export class ApifyToolset extends AgentBaseToolset<ApifyToolParams> {
  toolsetKey = ApifyToolsetDefinition.key;
  tools = [
    ApifyGetDatasetItems,
    ApifyRunActor,
    ApifyRunTaskSynchronously,
    ApifyScrapeSingleUrl,
    ApifySetKeyValueStoreRecord,
  ] satisfies readonly AgentToolConstructor<ApifyToolParams>[];
}
