import {
  ChatOpenAI,
  ChatOpenAICallOptions,
  ChatOpenAICompletions,
  ChatOpenAIFields,
  OpenAIClient,
} from '@langchain/openai';

class EnhanceChatOpenAICompletions extends ChatOpenAICompletions {
  protected override _convertCompletionsDeltaToBaseMessageChunk(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delta: Record<string, any>,
    rawResponse: OpenAIClient.ChatCompletionChunk,
    defaultRole?: 'function' | 'user' | 'system' | 'developer' | 'assistant' | 'tool',
  ) {
    const messageChunk = super._convertCompletionsDeltaToBaseMessageChunk(
      delta,
      rawResponse,
      defaultRole,
    );
    messageChunk.additional_kwargs.reasoning_content = delta.reasoning;
    return messageChunk;
  }

  protected override _convertCompletionsMessageToBaseMessage(
    message: OpenAIClient.ChatCompletionMessage,
    rawResponse: OpenAIClient.ChatCompletion,
  ) {
    const langChainMessage = super._convertCompletionsMessageToBaseMessage(message, rawResponse);
    langChainMessage.additional_kwargs.reasoning_content =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (message as any).reasoning_content;
    return langChainMessage;
  }
}

export class EnhancedChatOpenAI extends ChatOpenAI<ChatOpenAICallOptions> {
  static lc_name() {
    return 'ChatOpenAI';
  }

  _llmType() {
    return 'openai';
  }

  lc_serializable = true;

  lc_namespace = ['langchain', 'chat_models', 'deepseek'];

  constructor(fields?: Partial<ChatOpenAIFields>) {
    super({
      ...fields,
      completions: new EnhanceChatOpenAICompletions(fields),
    });
  }
}
