import { z } from 'zod/v3';
import {
  AgentBaseTool,
  AgentBaseToolset,
  type AgentToolConstructor,
  type ToolCallResult,
} from '../base';
import { ToolsetDefinition } from '@refly/openapi-schema';
// Use package subpath export; requires tsconfig moduleResolution: node16/nodenext/bundler
import { Sandbox } from 'novita-sandbox/code-interpreter';

/**
 * Toolset definition for PPIO Sandbox (code-interpreter).
 * Provides sandbox lifecycle, file I/O, command execution, code execution, and listing.
 */
export const PPIOToolsetDefinition: ToolsetDefinition = {
  key: 'ppio',
  domain: 'https://ppio.cn',
  labelDict: {
    en: 'PPIO Sandbox',
    'zh-CN': 'PPIO 沙箱',
  },
  descriptionDict: {
    en: 'Secure, isolated sandbox for running multi-language code with file and command access.',
    'zh-CN': '安全隔离的沙箱，支持多语言代码运行与文件/命令操作。',
  },
  tools: [
    { name: 'create', descriptionDict: { en: 'Create a sandbox', 'zh-CN': '创建沙箱' } },
    { name: 'connect', descriptionDict: { en: 'Connect to a sandbox', 'zh-CN': '连接沙箱' } },
    { name: 'isRunning', descriptionDict: { en: 'Check running state', 'zh-CN': '检查运行状态' } },
    { name: 'getInfo', descriptionDict: { en: 'Get sandbox info', 'zh-CN': '获取沙箱信息' } },
    { name: 'setTimeout', descriptionDict: { en: 'Update timeout', 'zh-CN': '更新超时时间' } },
    { name: 'kill', descriptionDict: { en: 'Kill sandbox', 'zh-CN': '关闭沙箱' } },
    { name: 'filesRead', descriptionDict: { en: 'Read file', 'zh-CN': '读取文件' } },
    { name: 'filesWrite', descriptionDict: { en: 'Write single file', 'zh-CN': '写入单个文件' } },
    {
      name: 'filesWriteMany',
      descriptionDict: { en: 'Write multiple files', 'zh-CN': '写入多个文件' },
    },
    { name: 'commandsRun', descriptionDict: { en: 'Run shell command', 'zh-CN': '执行命令' } },
    { name: 'runCode', descriptionDict: { en: 'Run code', 'zh-CN': '运行代码' } },
    { name: 'list', descriptionDict: { en: 'List sandboxes', 'zh-CN': '列出沙箱' } },
  ],
  requiresAuth: true,
  authPatterns: [
    {
      type: 'credentials',
      credentialItems: [
        {
          key: 'apiKey',
          inputMode: 'text',
          inputProps: { passwordType: true },
          labelDict: { en: 'API Key', 'zh-CN': 'API 密钥' },
          descriptionDict: {
            en: 'PPIO API key (NOVITA_API_KEY)',
            'zh-CN': 'PPIO 的 API 密钥（NOVITA_API_KEY）',
          },
          required: true,
        },
      ],
    },
  ],
  configItems: [],
};

interface PPIOToolParams {
  apiKey: string;
}

function ensureApiKey(apiKey: string): void {
  // Set env var expected by SDK; avoids passing credentials in every call
  if (!process.env.NOVITA_API_KEY || process.env.NOVITA_API_KEY !== apiKey) {
    process.env.NOVITA_API_KEY = apiKey ?? '';
  }
}

/**
 * create
 */
export class PPIOCreate extends AgentBaseTool<PPIOToolParams> {
  name = 'create';
  toolsetKey = PPIOToolsetDefinition.key;

  schema = z.object({
    timeoutMs: z.number().describe('Timeout in milliseconds').default(300000),
  });

  description = 'Create a PPIO sandbox';
  protected params: PPIOToolParams;

  constructor(params: PPIOToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      ensureApiKey(this.params?.apiKey ?? '');
      const sandbox = await Sandbox.create({ timeoutMs: input?.timeoutMs ?? 300000 });
      const info = await sandbox?.getInfo?.();
      return {
        status: 'success',
        data: {
          sandboxId: info?.sandboxId ?? undefined,
          info: info ?? {},
        },
        summary: 'Sandbox created successfully',
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to create sandbox',
        summary: error instanceof Error ? error.message : 'Unknown error during sandbox creation',
      };
    }
  }
}

/**
 * connect
 */
export class PPIOConnect extends AgentBaseTool<PPIOToolParams> {
  name = 'connect';
  toolsetKey = PPIOToolsetDefinition.key;

  schema = z.object({ sandboxId: z.string().describe('Existing sandbox id to connect') });

  description = 'Connect to an existing PPIO sandbox';
  protected params: PPIOToolParams;

  constructor(params: PPIOToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      ensureApiKey(this.params?.apiKey ?? '');
      const sbx = await Sandbox.connect(input?.sandboxId ?? '');
      const info = await sbx?.getInfo?.();
      return {
        status: 'success',
        data: { sandboxId: input?.sandboxId, info: info ?? {} },
        summary: 'Connected to sandbox successfully',
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to connect sandbox',
        summary: error instanceof Error ? error.message : 'Unknown error during sandbox connect',
      };
    }
  }
}

/**
 * isRunning (derived from getInfo.state)
 */
export class PPIOIsRunning extends AgentBaseTool<PPIOToolParams> {
  name = 'isRunning';
  toolsetKey = PPIOToolsetDefinition.key;

  schema = z.object({ sandboxId: z.string().describe('Sandbox id') });

  description = 'Check if sandbox is running';
  protected params: PPIOToolParams;

  constructor(params: PPIOToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      ensureApiKey(this.params?.apiKey ?? '');
      const sbx = await Sandbox.connect(input?.sandboxId ?? '');
      const info = await sbx?.getInfo?.();
      const state = info?.state ?? '';
      return {
        status: 'success',
        data: { isRunning: String(state).toLowerCase() === 'running' },
        summary: 'Sandbox status fetched',
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to check sandbox status',
        summary: error instanceof Error ? error.message : 'Unknown error during isRunning',
      };
    }
  }
}

/**
 * getInfo
 */
export class PPIOGetInfo extends AgentBaseTool<PPIOToolParams> {
  name = 'getInfo';
  toolsetKey = PPIOToolsetDefinition.key;

  schema = z.object({ sandboxId: z.string().describe('Sandbox id') });

  description = 'Get sandbox information';
  protected params: PPIOToolParams;

  constructor(params: PPIOToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      ensureApiKey(this.params?.apiKey ?? '');
      const sbx = await Sandbox.connect(input?.sandboxId ?? '');
      const info = await sbx?.getInfo?.();
      return { status: 'success', data: info ?? {}, summary: 'Sandbox info fetched' };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to get sandbox info',
        summary: error instanceof Error ? error.message : 'Unknown error during getInfo',
      };
    }
  }
}

/**
 * setTimeout
 */
export class PPIOSetTimeout extends AgentBaseTool<PPIOToolParams> {
  name = 'setTimeout';
  toolsetKey = PPIOToolsetDefinition.key;

  schema = z.object({ sandboxId: z.string(), timeoutMs: z.number() });

  description = 'Set sandbox timeout (ms)';
  protected params: PPIOToolParams;

  constructor(params: PPIOToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      ensureApiKey(this.params?.apiKey ?? '');
      const sbx = await Sandbox.connect(input?.sandboxId ?? '');
      await sbx?.setTimeout?.(input?.timeoutMs ?? 0);
      return { status: 'success', data: { ok: true }, summary: 'Timeout updated' };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to set timeout',
        summary: error instanceof Error ? error.message : 'Unknown error during setTimeout',
      };
    }
  }
}

/**
 * kill
 */
export class PPIOKill extends AgentBaseTool<PPIOToolParams> {
  name = 'kill';
  toolsetKey = PPIOToolsetDefinition.key;

  schema = z.object({ sandboxId: z.string() });

  description = 'Kill a sandbox';
  protected params: PPIOToolParams;

  constructor(params: PPIOToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      ensureApiKey(this.params?.apiKey ?? '');
      const sbx = await Sandbox.connect(input?.sandboxId ?? '');
      await sbx?.kill?.();
      return { status: 'success', data: { killed: true }, summary: 'Sandbox killed' };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to kill sandbox',
        summary: error instanceof Error ? error.message : 'Unknown error during kill',
      };
    }
  }
}

/**
 * files.read
 */
export class PPIOFilesRead extends AgentBaseTool<PPIOToolParams> {
  name = 'filesRead';
  toolsetKey = PPIOToolsetDefinition.key;

  schema = z.object({ sandboxId: z.string(), path: z.string() });

  description = 'Read a file from sandbox';
  protected params: PPIOToolParams;

  constructor(params: PPIOToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      ensureApiKey(this.params?.apiKey ?? '');
      const sbx = await Sandbox.connect(input?.sandboxId ?? '');
      const content = await sbx?.files?.read?.(input?.path ?? '');
      return { status: 'success', data: { content: content ?? '' }, summary: 'File read' };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to read file',
        summary: error instanceof Error ? error.message : 'Unknown error during files.read',
      };
    }
  }
}

/**
 * files.write (single)
 */
export class PPIOFilesWrite extends AgentBaseTool<PPIOToolParams> {
  name = 'filesWrite';
  toolsetKey = PPIOToolsetDefinition.key;

  schema = z.object({ sandboxId: z.string(), path: z.string(), content: z.string() });

  description = 'Write a single file to sandbox';
  protected params: PPIOToolParams;

  constructor(params: PPIOToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      ensureApiKey(this.params?.apiKey ?? '');
      const sbx = await Sandbox.connect(input?.sandboxId ?? '');
      const res = await sbx?.files?.write?.(input?.path ?? '', input?.content ?? '');
      return { status: 'success', data: res ?? { written: true }, summary: 'File written' };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to write file',
        summary: error instanceof Error ? error.message : 'Unknown error during files.write',
      };
    }
  }
}

/**
 * files.write (multiple)
 */
export class PPIOFilesWriteMany extends AgentBaseTool<PPIOToolParams> {
  name = 'filesWriteMany';
  toolsetKey = PPIOToolsetDefinition.key;

  schema = z.object({
    sandboxId: z.string(),
    files: z
      .array(z.object({ path: z.string(), data: z.string() }))
      .min(1)
      .describe('Files to write into sandbox'),
  });

  description = 'Write multiple files to sandbox';
  protected params: PPIOToolParams;

  constructor(params: PPIOToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      ensureApiKey(this.params?.apiKey ?? '');
      const sbx = await Sandbox.connect(input?.sandboxId ?? '');
      // Ensure strict element shape for SDK's WriteEntry[] typing
      const files: Array<{ path: string; data: string }> = Array.isArray(input?.files)
        ? (input.files as Array<{ path: string; data: string }>)
        : [];
      const res = await sbx?.files?.write?.(files as any);
      const items = Array.isArray(res) ? res : [];
      return { status: 'success', data: { items }, summary: 'Files written' };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to write files',
        summary: error instanceof Error ? error.message : 'Unknown error during files.write(many)',
      };
    }
  }
}

/**
 * commands.run
 */
export class PPIOCommandsRun extends AgentBaseTool<PPIOToolParams> {
  name = 'commandsRun';
  toolsetKey = PPIOToolsetDefinition.key;

  schema = z.object({ sandboxId: z.string(), command: z.string().describe('Command to run') });

  description = 'Run a shell command synchronously';
  protected params: PPIOToolParams;

  constructor(params: PPIOToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      ensureApiKey(this.params?.apiKey ?? '');
      const sbx = await Sandbox.connect(input?.sandboxId ?? '');
      const result = await sbx?.commands?.run?.(input?.command ?? '');
      return {
        status: 'success',
        data: {
          stdout: result?.stdout ?? '',
          stderr: result?.stderr ?? '',
          exitCode: result?.exitCode ?? 0,
        },
        summary: 'Command executed',
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to run command',
        summary: error instanceof Error ? error.message : 'Unknown error during commands.run',
      };
    }
  }
}

/**
 * runCode
 */
export class PPIORunCode extends AgentBaseTool<PPIOToolParams> {
  name = 'runCode';
  toolsetKey = PPIOToolsetDefinition.key;

  schema = z.object({
    sandboxId: z.string(),
    code: z.string(),
    language: z.enum(['python', 'ts', 'js', 'r', 'java', 'bash']).describe('Execution language'),
  });

  description = 'Run code in a specified language using sandbox.runCode';
  protected params: PPIOToolParams;

  constructor(params: PPIOToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      ensureApiKey(this.params?.apiKey ?? '');
      const sbx = await Sandbox.connect(input?.sandboxId ?? '');
      const res = await sbx.runCode(input?.code ?? '', { language: input?.language });
      return {
        status: 'success',
        data: { logs: res?.logs ?? {}, result: res?.text ?? res ?? {} },
        summary: 'Code executed',
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to run code',
        summary: error instanceof Error ? error.message : 'Unknown error during runCode',
      };
    }
  }
}

/**
 * list sandboxes (with optional query)
 */
export class PPIOList extends AgentBaseTool<PPIOToolParams> {
  name = 'list';
  toolsetKey = PPIOToolsetDefinition.key;

  schema = z.object({
    query: z.record(z.any()).optional().describe('Optional query, e.g., { state: ["running"] }'),
    pageLimit: z.number().describe('Max number of pages to fetch').default(1),
    itemLimit: z.number().describe('Max number of items to fetch').optional(),
  });

  description = 'List sandboxes with pagination';
  protected params: PPIOToolParams;

  constructor(params: PPIOToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      ensureApiKey(this.params?.apiKey ?? '');
      const paginator = Sandbox.list({ query: input?.query ?? undefined });
      const items: any[] = [];
      let pages = 0;
      while ((paginator?.hasNext ?? false) && pages < (input?.pageLimit ?? 1)) {
        const chunk = (await paginator?.nextItems?.()) ?? [];
        if (Array.isArray(chunk) && chunk?.length > 0) {
          const remaining = (input?.itemLimit ?? Number.MAX_SAFE_INTEGER) - items.length;
          if (remaining <= 0) break;
          items.push(...chunk.slice(0, remaining));
        }
        pages += 1;
      }
      return { status: 'success', data: { items }, summary: 'Sandboxes listed' };
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to list sandboxes',
        summary: error instanceof Error ? error.message : 'Unknown error during list',
      };
    }
  }
}

export class PPIOToolset extends AgentBaseToolset<PPIOToolParams> {
  toolsetKey = PPIOToolsetDefinition.key;
  tools = [
    PPIOCreate,
    PPIOConnect,
    PPIOIsRunning,
    PPIOGetInfo,
    PPIOSetTimeout,
    PPIOKill,
    PPIOFilesRead,
    PPIOFilesWrite,
    PPIOFilesWriteMany,
    PPIOCommandsRun,
    PPIORunCode,
    PPIOList,
  ] satisfies readonly AgentToolConstructor<PPIOToolParams>[];
}
