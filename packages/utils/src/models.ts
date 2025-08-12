import { TokenUsageItem } from '@refly/openapi-schema';

/**
 * Aggregate token usage items by model name
 */
export const aggregateTokenUsage = (usageItems: TokenUsageItem[]): TokenUsageItem[] => {
  const aggregatedUsage: Record<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      modelProvider: string;
    }
  > = {};

  for (const item of usageItems) {
    if (!item) continue;
    const key = item.modelName;
    if (!aggregatedUsage[key]) {
      aggregatedUsage[key] = { inputTokens: 0, outputTokens: 0, modelProvider: item.modelProvider };
    }
    aggregatedUsage[key].inputTokens += item.inputTokens;
    aggregatedUsage[key].outputTokens += item.outputTokens;
  }

  return Object.entries(aggregatedUsage).map(([key, value]) => {
    const modelName = key;
    return {
      modelName,
      modelProvider: value.modelProvider,
      inputTokens: value.inputTokens,
      outputTokens: value.outputTokens,
    };
  });
};
