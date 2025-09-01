import type { WorkflowVariable } from '@refly/openapi-schema';
import type { MentionVariable } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/types';

/**
 * Process query with workflow variables using regex replacement
 * Similar to backend workflowVariableService.processQueryWithTypes
 * @param query - The original query string
 * @param variables - Array of workflow variables
 * @returns Processed query string and resource variables
 */
export function processQueryWithVariables(
  query: string,
  variables: MentionVariable[] = [],
): { query: string; resourceVars: WorkflowVariable[] } {
  if (!query || !variables?.length) {
    return { query, resourceVars: [] };
  }

  let processedQuery = query;
  const resourceVars: WorkflowVariable[] = [];

  for (const variable of variables) {
    // Handle CanvasRecordVariable (stepRecord/resultRecord)
    if (
      'source' in variable &&
      (variable.source === 'stepRecord' || variable.source === 'resultRecord')
    ) {
      // For canvas records, just remove the mention from query
      processedQuery = processedQuery.replace(new RegExp(`@${variable.name}\\s`, 'g'), '');
      continue;
    }

    // Handle WorkflowVariable
    if ('value' in variable) {
      const values = variable.value;

      if (variable.variableType === 'resource') {
        // Mark for resource injection, remove from query
        resourceVars.push({ ...variable, value: values });
        // Remove @name from query
        processedQuery = processedQuery.replace(new RegExp(`@${variable.name}\\s`, 'g'), '');
      } else {
        // string/option: extract text values from VariableValue array
        const textValues =
          values
            ?.filter((v) => v.type === 'text' && v.text)
            .map((v) => v.text)
            .filter(Boolean) ?? [];

        const stringValue = textValues.length > 0 ? textValues.join(', ') : '';
        processedQuery = processedQuery.replace(
          new RegExp(`@${variable.name}\\s`, 'g'),
          `${stringValue} `,
        );
      }
    }
  }

  return { query: processedQuery, resourceVars };
}

/**
 * Extract variables from query using regex
 * @param query - The query string to extract variables from
 * @returns Array of variable names found in the query
 */
export function extractVariablesFromQuery(query: string): string[] {
  if (!query) return [];

  const variableRegex = /@(\w+)\s/g;
  const variables: string[] = [];
  let match: RegExpExecArray | null;

  for (;;) {
    match = variableRegex.exec(query);
    if (match === null) break;
    const variableName = match[1];
    if (!variables.includes(variableName)) {
      variables.push(variableName);
    }
  }

  return variables;
}

/**
 * Validate if all variables in query are available in variables array
 * @param query - The query string
 * @param variables - Available variables
 * @returns Array of missing variable names
 */
export function findMissingVariables(query: string, variables: MentionVariable[]): string[] {
  const queryVariables = extractVariablesFromQuery(query);
  const availableVariableNames = variables.map((v) => v.name);

  return queryVariables.filter((variableName) => !availableVariableNames.includes(variableName));
}
