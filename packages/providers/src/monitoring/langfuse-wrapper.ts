import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Embeddings } from '@langchain/core/embeddings';

// Simple ID generation function
function createId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Lazy loaded monitoring components
let langfuseInstance: any = null;
let isMonitoringEnabled = false;

// Configuration interface
interface MonitoringConfig {
  publicKey?: string;
  secretKey?: string;
  baseUrl?: string;
  enabled?: boolean;
}

// Global configuration
let globalConfig: MonitoringConfig = {
  enabled: false
};

/**
 * Initialize monitoring with configuration
 */
export function initializeMonitoring(config: MonitoringConfig) {
  globalConfig = { ...config };
  isMonitoringEnabled = config.enabled && !!config.publicKey && !!config.secretKey;
  
  if (isMonitoringEnabled) {
    try {
      // Lazy load Langfuse to avoid dependency issues
      const { Langfuse } = require('langfuse');
      langfuseInstance = new Langfuse({
        publicKey: config.publicKey,
        secretKey: config.secretKey,
        baseUrl: config.baseUrl
      });
    } catch (error) {
      console.warn('[Providers Monitoring] Langfuse not available, monitoring disabled:', error.message);
      isMonitoringEnabled = false;
    }
  }
}

/**
 * Create a trace for monitoring operations
 */
function createTrace(userId?: string, metadata: Record<string, any> = {}) {
  if (!isMonitoringEnabled || !langfuseInstance) {
    return null;
  }

  try {
    const traceId = createId();
    const trace = langfuseInstance.trace({
      id: traceId,
      name: 'Model Operation',
      userId: userId || 'anonymous',
      metadata
    });

    return {
      createSpan: (spanOptions: { name: string; input?: any; metadata?: any }) => {
        const spanId = createId();
        const span = trace.span({
          id: spanId,
          name: spanOptions.name,
          input: spanOptions.input,
          metadata: spanOptions.metadata,
          startTime: new Date()
        });

        return {
          update: (data: { output?: any; statusMessage?: string; level?: string }) => {
            span.update({
              output: data.output,
              statusMessage: data.statusMessage,
              level: data.level || 'DEFAULT',
              endTime: new Date()
            });
          },
          error: (error: Error | string) => {
            span.update({
              statusMessage: typeof error === 'string' ? error : error.message,
              level: 'ERROR',
              endTime: new Date()
            });
          }
        };
      }
    };
  } catch (error) {
    console.error('[Providers Monitoring] Failed to create trace:', error);
    return null;
  }
}

/**
 * Wrap a chat model with monitoring capabilities
 */
export function wrapChatModelWithMonitoring(
  model: BaseChatModel,
  context: { userId?: string; modelId?: string; provider?: string } = {}
): BaseChatModel {
  if (!isMonitoringEnabled) {
    return model;
  }

  const trace = createTrace(context.userId, {
    type: 'llm',
    modelId: context.modelId,
    provider: context.provider
  });

  if (!trace) {
    return model;
  }

  // Wrap invoke method
  const originalInvoke = model.invoke.bind(model);
  model.invoke = async (input, options) => {
    const span = trace.createSpan({
      name: 'llm_invoke',
      input: { messages: input },
      metadata: { 
        operation: 'invoke',
        modelId: context.modelId,
        provider: context.provider
      }
    });

    try {
      const result = await originalInvoke(input, options);
      span.update({
        output: { content: result.content },
        level: 'DEFAULT'
      });
      return result;
    } catch (error) {
      span.error(error);
      throw error;
    }
  };

  // Wrap stream method if available
  if (model.stream) {
    const originalStream = model.stream.bind(model);
    model.stream = async (input, options) => {
      const span = trace.createSpan({
        name: 'llm_stream',
        input: { messages: input },
        metadata: { 
          operation: 'stream',
          modelId: context.modelId,
          provider: context.provider
        }
      });

      try {
        const stream = await originalStream(input, options);
        
        // Create a new readable stream that logs the output
        const monitoredStream = new ReadableStream({
          async start(controller) {
            const chunks = [];
            try {
              for await (const chunk of stream) {
                chunks.push(chunk);
                controller.enqueue(chunk);
              }
              
              // Log the complete output
              const fullContent = chunks.map(c => c.content).join('');
              span.update({
                output: { content: fullContent, chunkCount: chunks.length },
                level: 'DEFAULT'
              });
              
              controller.close();
            } catch (error) {
              span.error(error);
              controller.error(error);
            }
          }
        });

        return monitoredStream as any;
      } catch (error) {
        span.error(error);
        throw error;
      }
    };
  }

  return model;
}

/**
 * Wrap embeddings with monitoring capabilities
 */
export function wrapEmbeddingsWithMonitoring(
  embeddings: Embeddings,
  context: { userId?: string; modelId?: string; provider?: string } = {}
): Embeddings {
  if (!isMonitoringEnabled) {
    return embeddings;
  }

  const trace = createTrace(context.userId, {
    type: 'embeddings',
    modelId: context.modelId,
    provider: context.provider
  });

  if (!trace) {
    return embeddings;
  }

  // Wrap embedDocuments method
  const originalEmbedDocuments = embeddings.embedDocuments.bind(embeddings);
  embeddings.embedDocuments = async (documents: string[]) => {
    const span = trace.createSpan({
      name: 'embed_documents',
      input: { documentCount: documents.length },
      metadata: { 
        operation: 'embedDocuments',
        modelId: context.modelId,
        provider: context.provider
      }
    });

    try {
      const result = await originalEmbedDocuments(documents);
      span.update({
        output: { 
          vectorCount: result.length,
          dimensions: result[0]?.length || 0
        },
        level: 'DEFAULT'
      });
      return result;
    } catch (error) {
      span.error(error);
      throw error;
    }
  };

  // Wrap embedQuery method
  const originalEmbedQuery = embeddings.embedQuery.bind(embeddings);
  embeddings.embedQuery = async (query: string) => {
    const span = trace.createSpan({
      name: 'embed_query',
      input: { query: query.substring(0, 100) + (query.length > 100 ? '...' : '') },
      metadata: { 
        operation: 'embedQuery',
        modelId: context.modelId,
        provider: context.provider
      }
    });

    try {
      const result = await originalEmbedQuery(query);
      span.update({
        output: { 
          dimensions: result.length
        },
        level: 'DEFAULT'
      });
      return result;
    } catch (error) {
      span.error(error);
      throw error;
    }
  };

  return embeddings;
}

/**
 * Shutdown monitoring
 */
export async function shutdownMonitoring(): Promise<void> {
  if (langfuseInstance) {
    try {
      await langfuseInstance.shutdownAsync();
    } catch (error) {
      console.error('[Providers Monitoring] Error shutting down:', error);
    }
  }
} 