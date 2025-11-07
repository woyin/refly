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
  skillResponses: CanvasNode[];
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
  const nodesText = buildNodesText(canvasData.skillResponses);

  // Filter variables to only include those actually used in canvas nodes
  const usedVariables = canvasData?.variables || [];
  const variablesText = buildVariablesText(usedVariables);

  const canvasContextText = buildCanvasContextText(canvasContext);
  const historicalContext = historicalData ? buildHistoricalContext(historicalData) : '';

  return `# AI Workflow APP Template Generation Expert

You are a professional workflow analysis expert responsible for generating user-friendly natural language templates for APP publishing. Your goal is to create intuitive, clear templates that help users understand and use the workflow effectively.

## Input Context

### Workflow Information
${canvasData.title ? `- Title: ${canvasData.title}` : ''}
${canvasData.description ? `- Description: ${canvasData.description}` : ''}

### Canvas Nodes and Prompts
${nodesText}

### Existing Variables (${usedVariables?.length || 0} total):
${variablesText}

### Workflow Context
${canvasContextText}

${historicalContext ? `### Historical Learning Context\n${historicalContext}` : ''}

## Core Requirements

### 1. Language Consistency (CRITICAL)
**Rule**: All output must match the language used in Canvas Nodes and Prompts.
- Chinese nodes → Chinese template
- English nodes → English template
- Mixed language → Follow primary language

### 2. Variable Integration (CRITICAL)
**Strict Rule**: The number of {{variable_name}} placeholders in template.content MUST exactly match the variables count above.

**ONE-TO-ONE MAPPING RULE (CRITICAL)**: Each variable must correspond to exactly ONE placeholder, and each placeholder must use a UNIQUE variable name. NO DUPLICATES allowed.

${usedVariables?.length ? `**Required**: Your template.content must contain exactly ${usedVariables.length} {{variable_name}} placeholder(s), each using a DIFFERENT variable name from the list above.` : '**Required**: Your template.content must contain ZERO {{variable_name}} placeholders.'}

**Mapping Rules**:
- ✅ Correct: ${usedVariables?.length || 0} variables = ${usedVariables?.length || 0} UNIQUE placeholders (one-to-one mapping)
- ❌ Wrong: ${usedVariables?.length || 0} variables ≠ any other number of placeholders
- ❌ Wrong: Repeating the same variable name multiple times (e.g., {{topic}} and {{topic}} again)
- ❌ Wrong: Using variable names that don't exist in the variables list above

**Example of Correct One-to-One Mapping**:
If variables are: [topic, style, format]
✅ Correct: "Create {{topic}} content in {{style}} with {{format}} format"
❌ Wrong: "Create {{topic}} content in {{topic}} style" (duplicate variable)
❌ Wrong: "Create {{topic}} content" (missing variables)

### 3. Natural Language Conversion
Transform technical descriptions into conversational, user-friendly language:
- Start with "I'll help you..." or "I'll create..."
- Explain benefits, not just features
- Use simple, everyday language
- Avoid technical jargon

### 4. Variable Types (when variables exist)
- **string**: {{topic}}, {{style}}, {{preference}}
- **resource**: {{upload_file}}, {{document}}, {{image}}
- **option**: {{format}}, {{mode}}, {{language}}

## Output Format

Return valid JSON only:

\`\`\`json
{
  "template": {
    "title": "Clear, action-oriented workflow title",
    "description": "Brief description of workflow purpose and benefits",
    "content": "Natural language template ${usedVariables?.length ? `with exactly ${usedVariables.length} {{variable_name}} placeholder(s)` : 'without any {{variable_name}} placeholders'}",
    "usageInstructions": "How to use this template in 1-2 sentences"
  }
}
\`\`\`

## Examples

### Example 1: With Variables (4 variables)
**Input**: Resume optimization workflow with 4 variables
**Output template.content**: "I'll help you create a professional resume optimized for your target job. Please provide your {{original_resume}} and the {{target_job_description}}, and I'll rewrite it in {{preferred_language}} with {{output_format}} formatting to ensure it passes ATS screening."
✅ Correct: 4 variables = 4 placeholders

### Example 2: Without Variables (0 variables)
**Input**: Travel planning workflow with 0 variables
**Output template.content**: "I'll help you create a comprehensive travel itinerary based on your preferences and requirements. I'll analyze your destination, dates, and specific needs to provide a detailed plan with accommodations, dining options, and daily activities."
✅ Correct: 0 variables = 0 placeholders

### Example 3: ERROR Case - Missing Placeholders (AVOID)
**Input**: 2 variables provided (topic, style)
**Output template.content**: "I'll create content for you."
❌ Wrong: 2 variables but 0 placeholders in template

### Example 4: ERROR Case - Duplicate Variables (AVOID)
**Input**: 3 variables provided (topic, style, format)
**Output template.content**: "I'll create {{topic}} content in {{topic}} style with {{format}} format."
❌ Wrong: Variable "topic" appears twice - violates one-to-one mapping rule
✅ Correct: "I'll create {{topic}} content in {{style}} style with {{format}} format."

${APP_PUBLISH_EXAMPLES}

## Validation Checklist

Before returning your response, verify:
- [ ] Language matches Canvas Nodes language
- [ ] template.content placeholder count = variables count (${usedVariables?.length || 0})
- [ ] **ONE-TO-ONE MAPPING**: Each variable appears exactly ONCE in template.content (no duplicates)
- [ ] **UNIQUE VARIABLES**: All placeholders use DIFFERENT variable names (no repeated variable names)
- [ ] All variable names in placeholders match existing variable names exactly
- [ ] Template is conversational and user-friendly
- [ ] JSON is valid and complete

## Critical Reminder
**The template.content field is the MOST IMPORTANT output.** It must:
1. Use the same language as Canvas Nodes
2. Contain exactly ${usedVariables?.length || 0} {{variable_name}} placeholder(s)
3. **ONE-TO-ONE MAPPING**: Each variable must appear exactly ONCE - NO DUPLICATES
4. **UNIQUE VARIABLES**: All ${usedVariables?.length || 0} placeholders must use DIFFERENT variable names
5. Sound natural and conversational
6. Be self-contained and clear

Generate your response now.`;
}

/**
 * Extract variable references from originalQuery string
 * Handles patterns like @{type=var,id=var-xxx,name=xxx}
 */
function extractVariableReferences(originalQuery: string): string[] {
  if (!originalQuery || typeof originalQuery !== 'string') {
    return [];
  }

  // Match pattern: @{type=var,id=var-xxx,name=xxx} or @{type=resource,id=r-xxx,name=xxx}
  const variablePattern = /@\{type=(?:var|resource),id=([^,]+),name=([^}]+)\}/g;
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
function buildNodesText(skillResponses: CanvasNode[]): string {
  if (!skillResponses?.length) {
    return '- No workflow nodes found';
  }

  return skillResponses
    .map((node, index) => {
      const nodeType = node.type || 'unknown';
      const nodeTitle = node?.title || node.data.title || `Node ${index + 1}`;

      const description = `- ${nodeTitle} (${nodeType})`;

      return description;
    })
    .join('\n');
}

/**
 * Filter variables to only include those actually used in canvas nodes
 */
export function filterUsedVariables(
  variables: WorkflowVariable[],
  skillResponses: CanvasNode[],
): WorkflowVariable[] {
  if (!variables?.length || !skillResponses?.length) {
    return variables || [];
  }

  // Extract all variable references from all nodes' originalQuery fields
  const usedVariableNames = new Set<string>();

  for (const node of skillResponses) {
    const originalQuery = (node.data as any).metadata?.structuredData?.query || '';
    if (originalQuery) {
      const variableRefs = extractVariableReferences(originalQuery);
      for (const name of variableRefs) {
        usedVariableNames.add(name);
      }
    }
  }

  // Filter variables to only include those that are actually used
  return variables.filter((variable) => {
    // Check if variable name is used
    if (usedVariableNames.has(variable.name)) {
      return true;
    }

    // Check if any resource name in variable values is used
    if (variable.value && Array.isArray(variable.value)) {
      for (const valueItem of variable.value) {
        if (valueItem.type === 'resource' && valueItem.resource?.name) {
          if (usedVariableNames.has(valueItem.resource.name)) {
            return true;
          }
        }
      }
    }

    return false;
  });
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
    .join(`
      `);
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
