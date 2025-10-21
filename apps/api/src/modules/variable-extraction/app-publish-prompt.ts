import {
  WorkflowVariable,
  CanvasContext,
  HistoricalData,
  CanvasContentItem,
} from './variable-extraction.dto';

// Import examples for reference and testing
import { APP_PUBLISH_EXAMPLES } from './examples';

// Define proper types for canvas data
interface CanvasNode {
  id: string;
  type: string;
  title?: string;
  data?: {
    title?: string;
    content?: string;
  };
  content?: string;
  input?: {
    originalQuery?: string;
    query?: string;
    [key: string]: any;
  };
}

interface CanvasDataInput {
  nodes: CanvasNode[];
  contentItems: CanvasContentItem[];
  variables: WorkflowVariable[];
  title?: string;
  description?: string;
}

/**
 * APP publishing template generation dedicated prompt
 * Generates user-friendly natural language templates based on all original Canvas prompts and variables
 * Used for APP publishing workflow to help users understand and use the workflow
 */
export function buildAppPublishPrompt(
  canvasData: CanvasDataInput,
  canvasContext: CanvasContext,
  historicalData?: HistoricalData,
): string {
  const nodesText = buildNodesText(canvasData.contentItems);

  // Filter variables to only include those actually used in canvas nodes
  const usedVariables = filterUsedVariables(canvasData.variables, canvasData.contentItems);
  const variablesText = buildVariablesText(usedVariables);

  const canvasContextText = buildCanvasContextText(canvasContext);
  const historicalContext = historicalData ? buildHistoricalContext(historicalData) : '';

  return `# AI Workflow APP Template Generation Expert

You are a professional workflow analysis expert responsible for generating user-friendly natural language templates for APP publishing. Your goal is to create intuitive, clear templates that help users understand and use the workflow effectively.

## Core Tasks
1. **Template Generation**: Create natural language templates based on all original prompts and variables
2. **User Experience**: Make templates intuitive and easy to understand
3. **Variable Integration**: Properly integrate all workflow variables into the template
4. **Context Preservation**: Maintain the original workflow intent and functionality

## Input Context

### Workflow Information
${canvasData.title ? `- Title: ${canvasData.title}` : ''}
${canvasData.description ? `- Description: ${canvasData.description}` : ''}

### Canvas Nodes and Prompts
${nodesText}

### Existing Variables
${variablesText}

### Workflow Context
${canvasContextText}

${historicalContext ? `### Historical Learning Context\n${historicalContext}` : ''}

## Template Generation Guidelines

### 1. Language Consistency (CRITICAL)
- **MUST maintain the same language as used in Canvas Nodes and Prompts**
- If Canvas Nodes contain Chinese text, generate templates in Chinese
- If Canvas Nodes contain English text, generate templates in English
- If Canvas Nodes contain mixed languages, follow the primary language pattern
- **Language Detection**: Analyze the Canvas Nodes content to determine the user's preferred language
- **Consistency Requirement**: All template fields (title, description, content) must use the same language as the Canvas Nodes

### 2. Natural Language Conversion
- Convert technical workflow descriptions into user-friendly language
- Use clear, actionable language that explains what the workflow does
- Focus on user benefits and outcomes
- **Maintain language consistency with Canvas Nodes**

### 3. Variable Integration
- **CRITICAL**: Only include variables that are actually used in Canvas Nodes and Prompts
- Replace specific values with {{variable_name}} placeholders
- Ensure all variables are properly represented in the template
- Maintain semantic meaning while making it parameterizable
- **Variable Usage Validation**: Only variables that appear in {{variable_name}} format within the Canvas Nodes should be included in the template

### 4. Template Structure
- Start with a clear description of what the workflow accomplishes
- Explain what inputs are needed (variables)
- Describe the expected output or result
- Use conversational, helpful tone
- **Maintain language consistency with Canvas Nodes**

### 5. Variable Type Handling
- **string**: Use descriptive placeholders like "{{topic}}" or "{{style}}"
- **resource**: Use file-related placeholders like "{{upload_file}}" or "{{document}}"
- **option**: Use selection-related placeholders like "{{format}}" or "{{mode}}"

### 6. Quality Standards
- Templates should be self-explanatory
- Variables should have clear, descriptive names
- Maintain workflow functionality while improving usability
- Ensure consistency with existing variable names
- **Language consistency is mandatory - all output must match Canvas Nodes language**

## Output Format Requirements

**Must** return standard JSON format:

\`\`\`json
{
  "analysis": {
    "userIntent": "Clear description of what this workflow accomplishes",
    "workflowComplexity": "simple|medium|complex",
    "estimatedExecutionTime": "Estimated time for workflow completion",
    "primarySkills": ["Skill1", "Skill2"],
    "targetAudience": "Who this workflow is designed for"
  },
  "template": {
    "title": "User-friendly workflow title",
    "description": "Clear description of what the workflow does",
    "content": "Natural language template with {{variable_name}} placeholders",
    "usageInstructions": "Brief instructions on how to use the template",
    "exampleInputs": {
      "variable_name": "Example value or description"
    }
  },
  "variables": [
    {
      "name": "variable_name",
      "description": "Clear description of what this variable represents",
      "variableType": "string|resource|option",
      "required": true,
      "defaultValue": "Default value if applicable",
      "uiHint": "Suggested UI component type"
    }
  ],
  "metadata": {
    "templateVersion": 1,
    "generatedAt": "2024-01-01T00:00:00Z",
    "workflowType": "Type of workflow",
    "skillTags": ["tag1", "tag2"]
  }
}
\`\`\`

## Key Principles
1. **Language Consistency**: **CRITICAL** - All template fields must use the same language as Canvas Nodes
2. **Clarity**: Users should immediately understand what the workflow does
3. **Simplicity**: Avoid technical jargon, use everyday language
4. **Completeness**: Include all necessary variables and context
5. **Actionability**: Users should know exactly what to provide and expect
6. **Professionalism**: Maintain a helpful, trustworthy tone
7. **Variable Usage Validation**: Only include variables that are actually referenced in Canvas Nodes with {{variable_name}} format

## Critical Focus: Workflow Publishing Template String

The **"content"** field in the template object is the most important output - this is the **workflow publishing template string** that will be used by users. It must:

- **Language Consistency**: **CRITICAL** - Must use the same language as Canvas Nodes
- **Be Natural and Conversational**: Sound like a helpful assistant explaining what they'll do
- **Include Only Used Variables**: Only variables that are actually referenced in Canvas Nodes with {{variable_name}} format should be included
- **Maintain Original Intent**: Preserve the user's original goal and requirements
- **Be Self-Contained**: Users should understand the complete workflow from this single template
- **Use Proper Variable Format**: All placeholders must use {{variable_name}} format exactly
- **Variable Usage Validation**: If Canvas Nodes don't contain any {{variable_name}} references, the template should not include any variable placeholders

### Template String Examples:

**Before (Technical)**: "Analyze resume with target job description, rewrite content, optimize format for ATS"

**After (User-friendly)**: "I'll help you create a professional resume optimized for your target job. Please provide your {{original_resume}} and the {{target_job_description}}, and I'll rewrite it in {{preferred_language}} with {{output_format}} formatting to ensure it passes ATS screening."

**Before (Technical)**: "Generate travel itinerary based on destination, dates, and preferences"

**After (User-friendly)**: "I'll create a personalized travel plan for your trip to {{destination}} from {{departure_city}} during {{dates}}. I'll arrange {{accommodation}} accommodations and {{food}} dining options, maintaining a {{pace}} pace with {{daily_routes}} for your {{goal}}."

**Example with No Variables Used**: If Canvas Nodes contain no {{variable_name}} references, the template should be:
"I'll help you create a comprehensive travel itinerary based on your preferences and requirements. I'll analyze your destination, dates, and specific needs to provide a detailed plan with accommodations, dining options, and daily activities."

${APP_PUBLISH_EXAMPLES}

## Key Learning Points from Examples

1. **Template String Structure**: 
   - Start with "I'll help you..." or "I'll create..." to establish the assistant role
   - Use natural language that flows conversationally
   - Include all variables with {{variable_name}} placeholders
   - End with clear expectations of what will be delivered

2. **Variable Integration**:
   - **CRITICAL**: Only include variables that are actually referenced in Canvas Nodes with {{variable_name}} format
   - Replace specific values with descriptive placeholders
   - Maintain the original semantic meaning
   - Ensure all used variables are represented
   - Use consistent naming conventions
   - **No Variables Case**: If no variables are used in Canvas Nodes, create a template without any {{variable_name}} placeholders

3. **User Experience Focus**:
   - Templates should be immediately understandable
   - Avoid technical jargon
   - Focus on benefits and outcomes
   - Provide clear guidance on what users need to provide

4. **Quality Assurance**:
   - Every template string must be complete and self-contained
   - Only variables that are actually used in Canvas Nodes should be included
   - Templates should maintain the original workflow intent
   - Language should be professional yet approachable
   - **Language Consistency**: **CRITICAL** - All template fields must match the language used in Canvas Nodes
   - **Variable Usage Validation**: Verify that all {{variable_name}} placeholders in the template correspond to variables actually referenced in Canvas Nodes`;
}

/**
 * Extract variable references from originalQuery string
 * Handles patterns like @{type=var,id=var-xxx,name=xxx}
 */
function extractVariableReferences(originalQuery: string): string[] {
  if (!originalQuery || typeof originalQuery !== 'string') {
    return [];
  }

  // Match pattern: @{type=var,id=var-xxx,name=xxx}
  const variablePattern = /@\{type=var,id=([^,]+),name=([^}]+)\}/g;
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  match = variablePattern.exec(originalQuery);
  while (match !== null) {
    const variableName = match[2]; // Extract the name part
    if (variableName && !matches.includes(variableName)) {
      matches.push(variableName);
    }
    match = variablePattern.exec(originalQuery);
  }

  return matches;
}

/**
 * Build nodes text - format canvas nodes into readable description
 */
function buildNodesText(contentItems: CanvasContentItem[]): string {
  if (!contentItems?.length) {
    return '- No workflow nodes found';
  }

  return contentItems
    .map((node, index) => {
      const nodeType = node.type || 'unknown';
      const nodeTitle = node?.title || node.title || `Node ${index + 1}`;
      const nodeContent = node?.content || node.content || '';
      const originalQuery = node.input?.originalQuery || '';

      let description = `- ${nodeTitle} (${nodeType})`;
      if (nodeContent && typeof nodeContent === 'string' && nodeContent.length > 0) {
        const truncatedContent =
          nodeContent.length > 100 ? `${nodeContent.substring(0, 100)}...` : nodeContent;
        description += `\n  Content: ${truncatedContent}`;
      }

      // Add originalQuery information if available
      if (originalQuery && typeof originalQuery === 'string' && originalQuery.length > 0) {
        const truncatedQuery =
          originalQuery.length > 100 ? `${originalQuery.substring(0, 100)}...` : originalQuery;
        description += `\n  Original Query: ${truncatedQuery}`;
      }

      return description;
    })
    .join('\n');
}

/**
 * Filter variables to only include those actually used in canvas nodes
 */
function filterUsedVariables(
  variables: WorkflowVariable[],
  contentItems: CanvasContentItem[],
): WorkflowVariable[] {
  if (!variables?.length || !contentItems?.length) {
    return variables || [];
  }

  // Extract all variable references from all nodes' originalQuery fields
  const usedVariableNames = new Set<string>();

  for (const node of contentItems) {
    const originalQuery = node.input?.originalQuery || '';
    if (originalQuery) {
      const variableRefs = extractVariableReferences(originalQuery);
      for (const name of variableRefs) {
        usedVariableNames.add(name);
      }
    }
  }

  // Filter variables to only include those that are actually used
  return variables.filter((variable) => usedVariableNames.has(variable.name));
}

/**
 * Build variables text - format existing variables into readable description
 */
function buildVariablesText(variables: WorkflowVariable[]): string {
  if (!variables?.length) {
    return '- No existing variables';
  }

  return variables
    .map((v) => {
      // Handle new VariableValue structure - display ALL values, not just the first one
      let valueText = 'Empty';
      if (v.value && Array.isArray(v.value) && v.value.length > 0) {
        const valueTexts: string[] = [];

        for (const valueItem of v.value) {
          if (valueItem.type === 'text' && valueItem.text) {
            valueTexts.push(valueItem.text);
          } else if (valueItem.type === 'resource' && valueItem.resource) {
            valueTexts.push(`${valueItem.resource.name} (${valueItem.resource.fileType})`);
          }
        }

        valueText = valueTexts.length > 0 ? valueTexts.join(', ') : 'Empty';
      }

      return `- ${v.name} (${v.variableType}): ${v.description || 'No description'} [Current values: ${valueText}]`;
    })
    .join('\n');
}

/**
 * Build canvas context text - format canvas context information
 */
function buildCanvasContextText(canvasContext: CanvasContext): string {
  const {
    nodeCount = 0,
    complexity = 0,
    resourceCount = 0,
    workflowType = 'Generic Workflow',
    primarySkills = ['Content Generation'],
  } = canvasContext;

  return `- Canvas Nodes: ${nodeCount}
- Workflow Type: ${workflowType}
- Primary Skills: ${Array.isArray(primarySkills) ? primarySkills.join(', ') : primarySkills}
- Complexity Score: ${complexity}/100
- Resource Count: ${resourceCount}`;
}

/**
 * Build historical context - analyze historical data for learning
 */
function buildHistoricalContext(historicalData: HistoricalData): string {
  if (!historicalData?.extractionHistory?.length) {
    return 'No historical extraction records available';
  }

  const recentExtractions = historicalData.extractionHistory.slice(0, 3);
  const successCount = recentExtractions.filter((r) => r.status === 'applied').length;
  const successRate = Math.round((successCount / recentExtractions.length) * 100);

  return `Based on ${recentExtractions.length} recent extractions:
- Historical success rate: ${successRate}%
- Recent patterns: ${historicalData.canvasPatterns?.slice(0, 3).join(', ') || 'None'}`;
}
