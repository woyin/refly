import type { WorkflowVariable } from '@refly/openapi-schema';

export interface MentionCommonData {
  type: 'var' | 'resource';
  id: string;
  name: string;
}

export interface MentionParseResult {
  variables: WorkflowVariable[];
}

/**
 * Process query with workflow variables using regex replacement
 * Similar to backend workflowVariableService.processQueryWithTypes
 * @param query - The original query string
 * @param options - Options for processing query
 * @returns Processed query string and resource variables
 */
export function processQueryWithMentions(
  query: string,
  options?: {
    replaceVars?: boolean;
    variables?: WorkflowVariable[];
  },
): { query: string; resourceVars: WorkflowVariable[] } {
  const { replaceVars = false, variables = [] } = options ?? {};

  if (!query) {
    return { query, resourceVars: [] };
  }

  let processedQuery = query;
  const resourceVars: WorkflowVariable[] = [];

  // Regex to match mentions like @{type=var,id=var-1,name=cv_folder_url}
  const mentionRegex = /@\{([^}]+)\}/g;

  processedQuery = processedQuery.replace(mentionRegex, (match, paramsStr) => {
    const params: Record<string, string> = {};
    for (const param of paramsStr.split(',')) {
      const [key, value] = param.split('=');
      if (key && value) {
        params[key.trim()] = value.trim();
      }
    }

    const { type, id, name } = params;

    if (type === 'var' && replaceVars && variables.length > 0) {
      // Find variable by id and replace with actual value
      const variable = variables.find((v) => 'variableId' in v && v.variableId === id);

      if (variable && 'value' in variable) {
        const values = variable.value;

        if (variable.variableType === 'resource') {
          // Mark for resource injection, replace with empty string
          resourceVars.push({ ...variable, value: values });
          return '';
        } else {
          // Extract text values from VariableValue array
          const textValues =
            values
              ?.filter((v) => v.type === 'text' && v.text)
              .map((v) => v.text)
              .filter(Boolean) ?? [];

          const stringValue = textValues.length > 0 ? textValues.join(', ') : '';
          return stringValue;
        }
      }

      // If variable not found or no value, replace with name
      return name ?? '';
    }

    if (type === 'resource') {
      // Replace resource mentions with the name
      return name ?? '';
    }

    if (type === 'var' && !replaceVars) {
      // When replaceVars is falsy, replace var mentions with @name format
      return `@${name}`;
    }

    // For other types or when replaceVars is false, keep the mention as is
    return match;
  });

  // Fallback: handle legacy @variableName format for backward compatibility
  if (variables.length > 0 && replaceVars) {
    for (const variable of variables) {
      // Handle CanvasRecordVariable (stepRecord/resultRecord)
      if (
        'source' in variable &&
        (variable.source === 'stepRecord' || variable.source === 'resultRecord')
      ) {
        // For canvas records, just remove the mention from query
        // Handle cases at the beginning of string
        processedQuery = processedQuery.replace(new RegExp(`^@${variable.name}(\\s|$)`, 'g'), '');
        // Handle cases in the middle with trailing space
        processedQuery = processedQuery.replace(new RegExp(`@${variable.name}\\s`, 'g'), '');
        // Handle cases at the end of string
        processedQuery = processedQuery.replace(new RegExp(`@${variable.name}$`, 'g'), '');
        continue;
      }

      // Handle WorkflowVariable
      if ('value' in variable) {
        const values = variable.value;

        if (variable.variableType === 'resource') {
          // Mark for resource injection, remove from query
          resourceVars.push({ ...variable, value: values });
          // Remove @name from query
          processedQuery = processedQuery.replace(
            new RegExp(`\\s*@${variable.name}\\s*`, 'g'),
            (_match) => '',
          );
        } else {
          // string/option: extract text values from VariableValue array
          const textValues =
            values
              ?.filter((v) => v.type === 'text' && v.text?.trim())
              .map((v) => v.text.trim())
              .filter(Boolean) ?? [];

          const stringValue = textValues.length > 0 ? textValues.join(', ') : '';
          processedQuery = processedQuery.replace(
            new RegExp(`@${variable.name}(\\s|$)`, 'g'),
            (_match, capturedSpace) => {
              if (!stringValue) return '';
              // If there was a space after the variable, preserve it
              // If the variable was at the end of string, don't add extra space
              return stringValue + (capturedSpace || '');
            },
          );
        }
      }
    }
  }

  return { query: processedQuery, resourceVars };
}
