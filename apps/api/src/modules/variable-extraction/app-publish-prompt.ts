import {
  WorkflowVariable,
  CanvasContext,
  HistoricalData,
} from 'src/modules/variable-extraction/variable-extraction.dto';

/**
 * APP发布模板生成专用prompt
 * 基于Canvas所有原始prompt和变量生成用户友好的自然语言模板
 * 用于APP发布流程，让用户能够理解和使用工作流
 */
export function buildAppPublishPrompt(
  canvasData: {
    nodes: any[];
    variables: WorkflowVariable[];
    title?: string;
    description?: string;
  },
  canvasContext: CanvasContext,
  historicalData?: HistoricalData,
): string {
  const nodesText = buildNodesText(canvasData.nodes);
  const variablesText = buildVariablesText(canvasData.variables);
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

### 1. Natural Language Conversion
- Convert technical workflow descriptions into user-friendly language
- Use clear, actionable language that explains what the workflow does
- Focus on user benefits and outcomes

### 2. Variable Integration
- Replace specific values with {{variable_name}} placeholders
- Ensure all variables are properly represented
- Maintain semantic meaning while making it parameterizable

### 3. Template Structure
- Start with a clear description of what the workflow accomplishes
- Explain what inputs are needed (variables)
- Describe the expected output or result
- Use conversational, helpful tone

### 4. Variable Type Handling
- **string**: Use descriptive placeholders like "{{topic}}" or "{{style}}"
- **resource**: Use file-related placeholders like "{{upload_file}}" or "{{document}}"
- **option**: Use selection-related placeholders like "{{format}}" or "{{mode}}"

### 5. Quality Standards
- Templates should be self-explanatory
- Variables should have clear, descriptive names
- Maintain workflow functionality while improving usability
- Ensure consistency with existing variable names

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

## Example Template Transformation

**Before (Technical)**: "Analyze resume with target job description, rewrite content, optimize format for ATS"

**After (User-friendly)**: "I'll help you create a professional resume optimized for your target job. Please provide your {{original_resume}} and the {{target_job_description}}, and I'll rewrite it in {{preferred_language}} with {{output_format}} formatting to ensure it passes ATS screening."

## Key Principles
1. **Clarity**: Users should immediately understand what the workflow does
2. **Simplicity**: Avoid technical jargon, use everyday language
3. **Completeness**: Include all necessary variables and context
4. **Actionability**: Users should know exactly what to provide and expect
5. **Professionalism**: Maintain a helpful, trustworthy tone`;
}

/**
 * Build nodes text - format canvas nodes into readable description
 */
function buildNodesText(nodes: any[]): string {
  if (!nodes?.length) {
    return '- No workflow nodes found';
  }

  return nodes
    .map((node, index) => {
      const nodeType = node.type || 'unknown';
      const nodeTitle = node.data?.title || node.title || `Node ${index + 1}`;
      const nodeContent = node.data?.content || node.content || '';

      let description = `- ${nodeTitle} (${nodeType})`;
      if (nodeContent && typeof nodeContent === 'string' && nodeContent.length > 0) {
        const truncatedContent =
          nodeContent.length > 100 ? `${nodeContent.substring(0, 100)}...` : nodeContent;
        description += `\n  Content: ${truncatedContent}`;
      }

      return description;
    })
    .join('\n');
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
      const value = Array.isArray(v.value) ? v.value.join(', ') : v.value;
      return `- ${v.name} (${v.variableType}): ${v.description || 'No description'} [Current: ${value || 'Empty'}]`;
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
