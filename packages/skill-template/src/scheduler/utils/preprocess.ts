import { Source } from '@refly/openapi-schema';
import { SkillRunnableConfig } from '../../base';
import { processQuery } from './queryProcessor';
import { prepareContext } from './context';
import { SkillEngine } from '../../engine';

export interface PreprocessResult {
  optimizedQuery: string;
  rewrittenQueries: string[];
  context: string;
  sources?: Source[];
  usedChatHistory?: any[];
}

export const preprocess = async (
  query: string,
  config: SkillRunnableConfig,
  engine: SkillEngine,
): Promise<PreprocessResult> => {
  const { context } = config.configurable;

  // Use shared query processor
  const { optimizedQuery, usedChatHistory, hasContext, remainingTokens, rewrittenQueries } =
    await processQuery(query, config);

  const needPrepareContext = hasContext && remainingTokens > 0;

  const result = {
    optimizedQuery,
    rewrittenQueries,
    context: '',
    sources: [],
    usedChatHistory,
  };

  if (needPrepareContext) {
    const preparedRes = await prepareContext(query, context, {
      maxTokens: remainingTokens,
      engine,
    });

    result.context = preparedRes.contextStr;

    return result;
  }

  return result;
};
