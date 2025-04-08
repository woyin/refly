import { Runnable } from '@langchain/core/runnables';
import { ToolParams } from '@langchain/core/tools';
import { BaseMessage } from '@langchain/core/messages';
import { SkillEngine } from './engine';
import { StructuredTool } from '@langchain/core/tools';
import { StateGraphArgs } from '@langchain/langgraph';
import { RunnableConfig } from '@langchain/core/runnables';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import {
  SkillContext,
  SkillInput,
  SkillTemplateConfigDefinition,
  SkillInvocationConfig,
  SkillMeta,
  User,
  SkillEvent,
  SkillRuntimeConfig,
  SkillTemplateConfig,
  Icon,
  Artifact,
  ActionStepMeta,
  ModelInfo,
  Project,
} from '@refly-packages/openapi-schema';
import { EventEmitter } from 'node:stream';

export abstract class BaseSkill extends StructuredTool {
  /**
   * Skill template icon
   */
  icon: Icon = { type: 'emoji', value: '🔧' };
  /**
   * Skill placeholder
   */
  placeholder = '🔧';
  /**
   * Skill template config schema
   */
  abstract configSchema: SkillTemplateConfigDefinition;
  /**
   * Skill invocation config
   */
  abstract invocationConfig: SkillInvocationConfig;
  /**
   * Langgraph state definition
   */
  abstract graphState: StateGraphArgs<BaseSkillState>['channels'];

  constructor(
    public engine: SkillEngine,
    protected params?: BaseToolParams,
  ) {
    super(params);
  }

  /**
   * Convert this skill to a LangChain runnable.
   */
  abstract toRunnable(): Runnable;

  /**
   * Emit a skill event.
   */
  emitEvent(data: Partial<SkillEvent>, config: SkillRunnableConfig) {
    const { emitter } = config?.configurable || {};

    if (!emitter) {
      return;
    }

    const eventData: SkillEvent = {
      event: data.event,
      step: config.metadata?.step,
      ...data,
    };

    if (!eventData.event) {
      if (eventData.log) {
        eventData.event = 'log';
      } else if (eventData.tokenUsage) {
        eventData.event = 'token_usage';
      } else if (eventData.structuredData) {
        eventData.event = 'structured_data';
      } else if (eventData.artifact) {
        eventData.event = 'artifact';
      }
    }

    emitter.emit(eventData.event, eventData);
  }

  /**
   * Emit large data in chunks with delay to prevent overwhelming the event system
   * @param data The data to emit
   * @param config The skill runnable config
   * @param options Options for chunking and delay
   */
  async emitLargeDataEvent<T>(
    data: {
      event?: string;
      data: T[];
      buildEventData: (
        chunk: T[],
        meta: { isPartial: boolean; chunkIndex: number; totalChunks: number },
      ) => Partial<SkillEvent>;
    },
    config: SkillRunnableConfig,
    options: {
      maxChunkSize?: number;
      delayBetweenChunks?: number;
    } = {},
  ): Promise<void> {
    const { maxChunkSize = 500, delayBetweenChunks = 10 } = options;

    // If no data or emitter, return early
    if (!data.data?.length || !config?.configurable?.emitter) {
      return;
    }

    // Split data into chunks based on size
    const chunks: T[][] = [];
    let currentChunk: T[] = [];
    let currentSize = 0;

    for (const item of data.data) {
      const itemSize = JSON.stringify(item).length;

      if (currentSize + itemSize > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentSize = 0;
      }

      currentChunk.push(item);
      currentSize += itemSize;
    }

    // Push the last chunk if not empty
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    // Emit chunks with delay
    const emitPromises = chunks.map(
      (chunk, i) =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            const eventData = data.buildEventData(chunk, {
              isPartial: i < chunks.length - 1,
              chunkIndex: i,
              totalChunks: chunks.length,
            });
            this.emitEvent(eventData, config);
            resolve();
          }, i * delayBetweenChunks);
        }),
    );

    await Promise.all(emitPromises);
  }

  async _call(
    input: typeof this.graphState,
    _runManager?: CallbackManagerForToolRun,
    config?: SkillRunnableConfig,
  ): Promise<string> {
    if (!config) {
      throw new Error('skill config is required');
    }

    // Configure the engine with the current skill config.
    this.engine.configure(config);

    // Ensure currentSkill is not empty.
    config.configurable.currentSkill ??= {
      name: this.name,
      icon: this.icon,
    };

    const response = await this.toRunnable().invoke(input, {
      ...config,
      metadata: {
        ...config.metadata,
        ...config.configurable.currentSkill,
        resultId: config.configurable.resultId,
      },
    });

    return response;
  }
}

export interface BaseToolParams extends ToolParams {
  engine: SkillEngine;
}

export interface BaseSkillState extends SkillInput {
  messages: BaseMessage[];
}

export const baseStateGraphArgs = {
  messages: {
    reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
    default: () => [],
  },
  query: {
    reducer: (left: string, right: string) => (right ? right : left || ''),
    default: () => '',
  },
  images: {
    reducer: (x: string[], y: string[]) => x.concat(y),
    default: () => [],
  },
  locale: {
    reducer: (left?: string, right?: string) => (right ? right : left || 'en'),
    default: () => 'en',
  },
};

export interface SkillEventMap {
  start: [data: SkillEvent];
  end: [data: SkillEvent];
  log: [data: SkillEvent];
  stream: [data: SkillEvent];
  create_node: [data: SkillEvent];
  artifact: [data: SkillEvent];
  structured_data: [data: SkillEvent];
  token_usage: [data: SkillEvent];
  error: [data: SkillEvent];
}

export interface SkillRunnableMeta extends Record<string, unknown>, SkillMeta {
  step?: ActionStepMeta;
  artifact?: Artifact;
  suppressOutput?: boolean;
}

export interface SkillRunnableConfig extends RunnableConfig {
  configurable?: SkillContext & {
    user: User;
    resultId?: string;
    canvasId?: string;
    locale?: string;
    uiLocale?: string;
    modelInfo?: ModelInfo;
    project?: Project;
    currentSkill?: SkillMeta;
    currentStep?: ActionStepMeta;
    chatHistory?: BaseMessage[];
    tplConfig?: SkillTemplateConfig;
    runtimeConfig?: SkillRuntimeConfig;
    emitter?: EventEmitter<SkillEventMap>;
  };
  metadata?: SkillRunnableMeta;
}
