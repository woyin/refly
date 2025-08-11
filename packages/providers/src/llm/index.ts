import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { LLMModelConfig } from '@refly/openapi-schema';
import { EnhancedChatOpenAI } from './openai';
import { ChatOllama } from '@langchain/ollama';
import { ChatFireworks } from '@langchain/community/chat_models/fireworks';
import { BaseProvider } from '../types';
import { AzureChatOpenAI, AzureOpenAIInput, OpenAIBaseInput } from '@langchain/openai';
import { wrapChatModelWithMonitoring } from '../monitoring/langfuse-wrapper';

export const getChatModel = (
  provider: BaseProvider,
  config: LLMModelConfig,
  params?: Partial<OpenAIBaseInput> | Partial<AzureOpenAIInput>,
  context?: { userId?: string },
): BaseChatModel => {
  let model: BaseChatModel;
  const extraParams = provider.extraParams ? JSON.parse(provider.extraParams) : {};

  const commonParams = {
    ...extraParams,
    ...params,
    ...(config?.disallowTemperature ? { temperature: undefined } : {}),
  };

  switch (provider?.providerKey) {
    case 'openai':
      model = new EnhancedChatOpenAI({
        model: config.modelId,
        apiKey: provider.apiKey,
        configuration: {
          baseURL: provider.baseUrl,
        },
        include_reasoning: config?.capabilities?.reasoning,
        ...commonParams,
      });
      break;
    case 'ollama':
      model = new ChatOllama({
        model: config.modelId,
        baseUrl: provider.baseUrl?.replace(/\/v1\/?$/, ''),
        ...commonParams,
      });
      break;
    case 'fireworks':
      model = new ChatFireworks({
        model: config.modelId,
        apiKey: provider.apiKey,
        ...commonParams,
      });
      break;
    case 'azure':
      model = new AzureChatOpenAI({
        model: config.modelId,
        azureOpenAIApiKey: provider.apiKey,
        reasoningEffort: config?.capabilities?.reasoning ? 'medium' : undefined,
        ...commonParams,
      });
      break;
    default:
      throw new Error(`Unsupported provider: ${provider?.providerKey}`);
  }

  // Automatically wrap with monitoring
  return wrapChatModelWithMonitoring(model, {
    userId: context?.userId,
    modelId: config.modelId,
    provider: provider.providerKey,
  });
};

export { BaseChatModel };
