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

**Language Determination Rule (CRITICAL)**:
The output language MUST be determined based on the following sections in priority order:
1. **Workflow Information** (Title and Description) - PRIMARY source
2. **Canvas Nodes and Prompts** - PRIMARY source
3. **Workflow Context** - SECONDARY source

**IMPORTANT**: Variables section language should be IGNORED when determining output language. Variable names and descriptions may be in different languages, but this does NOT affect the template language.

**Language Mapping Rules**:
- If Workflow Information, Canvas Nodes, or Workflow Context are in Chinese → Generate Chinese template
- If Workflow Information, Canvas Nodes, or Workflow Context are in English → Generate English template
- If mixed languages exist → Follow the primary language (the language used in most of the content)
- **DO NOT** use Variables section language as a reference for template language

**Examples**:
- ✅ Correct: Workflow Info in Chinese, Variables in English → Generate Chinese template
- ✅ Correct: Canvas Nodes in English, Variables in Chinese → Generate English template
- ❌ Wrong: Using Variables language to determine template language

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

### 3. Natural Language Conversion (CRITICAL)
Transform technical descriptions into conversational, user-friendly language:
- Start with "I'll help you..." or "I'll create..."
- Explain benefits, not just features
- Use simple, everyday language
- Avoid technical jargon

**Variable Context Integration (CRITICAL)**:
- **Variable names carry important meaning** - treat them as descriptive information, not just placeholders
- When referencing variables, provide clear context about their role
- Example: Instead of "generate {{mecha}}" → use "generate {{mecha}}-style" or "generate content with {{mecha}} theme"
- Make it crystal clear what each variable represents in the workflow
- Help users understand what value they should provide for each variable

**Natural Flow Requirements**:
- **NEVER use stiff transitional phrases** that create awkward interruptions
  * Chinese: Avoid "虽然...但是...", "即使...", "尽管..."
  * English: Avoid "Although...", "Even though...", "Despite..."
- **Seamlessly integrate all variables** into a natural, flowing narrative
- If a variable seems unrelated, either:
  * Omit it gracefully (if truly irrelevant to the workflow)
  * Find a natural way to incorporate it without forced transitions
- The template should sound like a native speaker explaining the workflow naturally
- **AVOID** explanations that highlight irrelevance
  * Examples to avoid: "Although you provided X, it won't be used..." or "Even though you filled in Y, this workflow doesn't use it..."

**Clean Output Requirements (CRITICAL)**:
- **NEVER include unnecessary punctuation** like Chinese quotation marks (""), English quotes (""), or other decorative symbols
- Keep the text clean and professional
- Use natural language without artificial formatting symbols
- Examples:
  * ❌ BAD (Chinese): "最终生成一个"机甲"的图片" (has decorative quotes)
  * ✅ GOOD (Chinese): "最终生成一个机甲风格的图片" (clean, clear)
  * ❌ BAD (English): Create a "special" {{style}} image (has decorative quotes)
  * ✅ GOOD (English): Create a {{style}}-style image (clean, clear)

**BAD Examples (NEVER do this)**:
❌ Chinese: "我将为您生成一个以{{topic}}为主题的内容。虽然我知道你填写了{{weather}}，但本次生成与天气无关。"
   (Problem: Mentions irrelevant variable with stiff transition)
❌ English: "I'll create {{content}} for you. Even though you provided {{unrelated_var}}, it won't be used in this workflow."
   (Problem: Highlights irrelevance instead of omitting gracefully)

**GOOD Examples (Natural flow with clear context)**:
✅ Chinese: "我将为您生成一个以{{topic}}为主题的{{style}}风格内容，并按照{{format}}格式输出。"
   (All variables integrated naturally with clear context)
✅ English: "I'll help you create {{content_type}} content focused on {{topic}} with your preferred {{style}} approach."
   (Conversational tone with variable context)
✅ Chinese: "我将为您生成一个{{骆驼}}风格的儿童绘本图片"
   (Variable name provides clear style context)
✅ English: "I'll generate a {{mecha}}-style children's book illustration showcasing mechanical aesthetics"
   (Variable integrated with descriptive context)

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
- [ ] **LANGUAGE DETERMINATION**: Language matches Workflow Information, Canvas Nodes, or Workflow Context (NOT Variables)
  * Language determined from: Workflow Info → Canvas Nodes → Workflow Context (in priority order)
  * Variables section language is IGNORED for language determination
  * Chinese content in primary sources → Chinese output
  * English content in primary sources → English output
- [ ] template.content placeholder count = variables count (${usedVariables?.length || 0})
- [ ] **ONE-TO-ONE MAPPING**: Each variable appears exactly ONCE in template.content (no duplicates)
- [ ] **UNIQUE VARIABLES**: All placeholders use DIFFERENT variable names (no repeated variable names)
- [ ] All variable names in placeholders match existing variable names exactly
- [ ] **VARIABLE CONTEXT**: Each variable is referenced with clear context about its role
  * Good: "{{mecha}}-style image" or "{{topic}}-focused content"
  * Bad: just "{{mecha}} image" or "{{topic}} content"
- [ ] **CLEAN OUTPUT**: No unnecessary punctuation marks like "" or "" around variables or regular text
- [ ] Template is conversational and user-friendly (sounds like natural speech)
- [ ] **NATURAL FLOW**: No stiff transitional phrases
  * Chinese: No "虽然...但是...", "即使...", "尽管..."
  * English: No "Although...", "Even though...", "Despite..."
- [ ] **NO IRRELEVANCE EXPLANATIONS**: Never mention that certain variables are irrelevant or won't be used
- [ ] All variables are seamlessly integrated into a natural, flowing narrative
- [ ] JSON is valid and complete

## Critical Reminder

**The template.content field is the MOST IMPORTANT output.** It must satisfy ALL of the following requirements:

### Mandatory Requirements (Must ALL be met):
1. **Language Consistency**: Match the language from Workflow Information, Canvas Nodes, or Workflow Context
   - Determine language from: Workflow Info → Canvas Nodes → Workflow Context (priority order)
   - **CRITICAL**: IGNORE Variables section language when determining output language
   - Variables may be in different languages, but template language follows primary sources only
2. **Exact Variable Count**: Contain exactly ${usedVariables?.length || 0} {{variable_name}} placeholder(s)
3. **ONE-TO-ONE MAPPING**: Each variable appears exactly ONCE - NO DUPLICATES
4. **UNIQUE VARIABLES**: All ${usedVariables?.length || 0} placeholders use DIFFERENT variable names
5. **Variable Context**: Provide clear context for each variable
   - Good: "{{mecha}}-style image", "{{topic}}-focused content"
   - Bad: "{{mecha}} image", "{{topic}} content"
6. **Clean Output**: NEVER use unnecessary punctuation
   - No Chinese quotation marks: "" or ""
   - No decorative English quotes: "" (only use for actual quotations if needed)
   - No other decorative symbols
7. **Natural Flow**: Sound natural and conversational
   - NO stiff transitions (no "虽然...但是...", "Although...", etc.)
   - NO irrelevance explanations (never mention unused variables)
8. **Seamless Integration**: All variables flow naturally in the narrative
9. **Self-Contained**: The template should be clear and complete on its own

### Quality Guidelines:
- **Native Speaker Test**: Template should sound like a native speaker naturally explaining the workflow, not like a forced enumeration of variables
- **Meaningful Names**: Variable names carry semantic meaning - use them to help users understand what information they need to provide
- **Professional Tone**: Maintain a helpful, friendly, yet professional tone
- **User-Centric**: Focus on what the user will get, not just what the workflow does

### Output Format:
- Return ONLY valid JSON
- No additional text before or after the JSON
- Ensure all JSON syntax is correct

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
