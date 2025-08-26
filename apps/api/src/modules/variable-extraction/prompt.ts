import {
  WorkflowVariable,
  CanvasContext,
  HistoricalData,
} from 'src/modules/variable-extraction/variable-extraction.dto';

// Import examples for reference and testing
import { VARIABLE_EXTRACTION_EXAMPLES } from './examples';

/**
 * Unified intelligent prompt builder for variable extraction
 * Automatically adapts based on context complexity and historical data
 * Use cases: all variable extraction scenarios, automatically selects optimal strategy
 */
export function buildUnifiedPrompt(
  userPrompt: string,
  existingVariables: WorkflowVariable[],
  canvasContext: CanvasContext,
  historicalData?: HistoricalData,
): string {
  const existingVarsText = buildExistingVariablesText(existingVariables);
  const canvasContextText = buildCanvasContextText(canvasContext);
  const historicalContext = historicalData ? buildHistoricalContext(historicalData) : '';

  return `# AI Workflow Variable Intelligent Extraction Expert

You are a professional workflow analysis expert responsible for intelligently extracting parameterizable variables from users' natural language input to build efficient workflow templates.

## Core Tasks
1. **Precise Identification**: Analyze user input, identify all variable parameters
2. **Intelligent Classification**: Categorize parameters into string/resource/option three types
3. **Variable Reuse**: Detect and reuse existing variables, avoid duplicate creation
4. **Template Generation**: Generate processedPrompt template with placeholders

## Input Context

### User Original Input
\`\`\`
${userPrompt}
\`\`\`

### Existing Variable Library
${existingVarsText}

### Workflow Context
${canvasContextText}

${historicalContext ? `### Historical Learning Context\n${historicalContext}` : ''}

## Variable Type Definitions

### 1. string (Text Variable)
- **Purpose**: Pure text content, configuration parameters, description information
- **Examples**: Topic, title, requirements, style, language, etc.
- **Naming**: topic, title, style, language, requirement

### 2. resource (Resource Variable) 
- **Purpose**: Files, documents, images that users need to upload
- **Examples**: Resume files, reference documents, image materials, etc.
- **Naming**: resume_file, reference_doc, source_image

### 3. option (Option Variable)
- **Purpose**: Predefined selection items, enumeration values
- **Examples**: Format selection, mode selection, level selection, etc.
- **Naming**: output_format, processing_mode, difficulty_level

## Intelligent Analysis Process

### Step 1: Intent Understanding
- Analyze user's core goals and expected output
- Identify task type and complexity level

### Step 2: Entity Extraction
- Scan specific values and concepts in user input
- Determine which content can be parameterized
- Distinguish between fixed content and variable content

### Step 3: Variable Classification
- string: Text content that users can directly input
- resource: Files or external resources that need to be uploaded
- option: Options in limited selection sets

### Step 4: Reuse Detection
- Semantic similarity matching (threshold 0.8+)
- Pronoun detection ("this", "above", "just now")
- Context association analysis

### Step 5: Variable Naming
- Use English snake_case format
- Names should be self-explanatory and concise
- Avoid conflicts with existing variable names

### Step 6: Template Construction
- Replace extracted variable values with {{variable_name}} placeholders
- Maintain original semantic and structural integrity
- Ensure template readability and practicality

## Output Format Requirements

**Must** return standard JSON format, no format errors allowed:

\`\`\`json
{
  "analysis": {
    "userIntent": "Concise description of user intent",
    "extractionConfidence": 0.95,
    "complexityScore": 3,
    "extractedEntityCount": 5,
    "variableTypeDistribution": {
      "string": 3,
      "resource": 1, 
      "option": 1
    }
  },
  "variables": [
    {
      "name": "variable_name",
      "value": ["Specific extracted value or empty string"],
      "description": "Variable purpose description",
      "variableType": "string",
      "source": "startNode",
      "extractionReason": "Why extract this variable",
      "confidence": 0.92
    }
  ],
  "reusedVariables": [
    {
      "detectedText": "Text fragment reused in original text",
      "reusedVariableName": "Reused variable name",
      "confidence": 0.89,
      "reason": "Specific reason for reuse"
    }
  ],
  "processedPrompt": "Template string after variable replacement, using {{variable_name}} format",
  "originalPrompt": "Original user input"
}
\`\`\`

## Quality Standards
- Variable names: Clear, consistent, self-explanatory
- Variable types: Accurate classification, conforming to three type definitions
- Reuse detection: High accuracy, reduce redundant variables
- Processed template: Maintain original meaning, correct placeholder replacement

${VARIABLE_EXTRACTION_EXAMPLES}

## Key Learning Points from Examples

1. **Variable Naming**: Use descriptive English names in snake_case format (e.g., departure_city, daily_routes)
2. **Type Classification**: 
   - string: Most common for text content, preferences, descriptions
   - resource: For files, data sources, uploads
   - option: For limited choices, style preferences
3. **Template Construction**: Replace specific values with {{variable_name}} placeholders while maintaining semantic meaning
4. **Context Preservation**: Keep the original intent and structure of the user's request`;
}

/**
 * Build existing variable text - internal utility function
 * Purpose: format existing variables into readable text description
 */
function buildExistingVariablesText(existingVariables: WorkflowVariable[]): string {
  if (existingVariables.length === 0) {
    return '- No existing variables';
  }

  return existingVariables
    .map((v) => {
      const value = Array.isArray(v.value) ? v.value.join(', ') : v.value;
      return `- ${v.name} (${v.variableType}): ${v.description} [Current value: ${value || 'Empty'}]`;
    })
    .join('\n');
}

/**
 * Build canvas context text - internal utility function
 * Purpose: format canvas context information into structured text description
 */
function buildCanvasContextText(canvasContext: CanvasContext): string {
  const {
    nodeCount = 0,
    complexity = 0,
    resourceCount = 0,
    workflowType = 'Generic Workflow',
    primarySkills = ['Content Generation'],
    lastExtractionTime,
    recentVariablePatterns = [],
  } = canvasContext;

  let contextText = `- Canvas Nodes: ${nodeCount}
- Workflow Type: ${workflowType}
- Primary Skills: ${Array.isArray(primarySkills) ? primarySkills.join(', ') : primarySkills}
- Complexity Score: ${complexity}/100
- Resource Count: ${resourceCount}
`;

  if (lastExtractionTime) {
    contextText += `\n- Last Extraction Time: ${new Date(lastExtractionTime).toLocaleString()}`;
  }

  if (recentVariablePatterns.length > 0) {
    contextText += `\n- Recent Variable Patterns: ${recentVariablePatterns.slice(0, 5).join(', ')}`;
  }

  return contextText;
}

/**
 * Build historical context - internal utility function
 * Purpose: analyze historical data and generate structured historical learning context
 */
function buildHistoricalContext(historicalData: HistoricalData): string {
  if (
    !historicalData ||
    !historicalData.extractionHistory ||
    historicalData.extractionHistory.length === 0
  ) {
    return 'No historical extraction records, standard extraction strategy will be used';
  }

  const recentExtractions = historicalData.extractionHistory.slice(0, 5);
  const variableTypes = new Map<string, number>();
  const commonPatterns = new Set<string>();
  const successRates = new Map<string, number>();

  for (const record of recentExtractions) {
    try {
      const variables = JSON.parse(record.extractedVariables);
      for (const variable of variables) {
        // Count variable type distribution
        const type = variable.variableType || 'unknown';
        variableTypes.set(type, (variableTypes.get(type) || 0) + 1);

        // Collect common patterns
        if (variable.description) {
          commonPatterns.add(variable.description);
        }
      }

      // Count success rate
      const status = record.status || 'unknown';
      successRates.set(status, (successRates.get(status) || 0) + 1);
    } catch {
      // Ignore records with parsing errors
    }
  }

  // Build historical context description
  const typeDistribution = Array.from(variableTypes.entries())
    .map(([type, count]) => `${type}: ${count}`)
    .join(', ');

  const patternList = Array.from(commonPatterns).slice(0, 3).join('、');

  const successRate = successRates.get('applied') || 0;
  const totalRecords = recentExtractions.length;
  const successPercentage = totalRecords > 0 ? Math.round((successRate / totalRecords) * 100) : 0;

  return `Based on ${historicalData.extractionHistory.length} historical extraction experiences:
- Variable type distribution: ${typeDistribution}
- Common patterns: ${patternList || 'No specific patterns'}
- Last extraction time: ${recentExtractions[0]?.createdAt?.toLocaleDateString() || 'Unknown'}
- Historical success rate: ${successPercentage}% (${successRate}/${totalRecords})
- Recent extraction records: ${recentExtractions.length} records`;
}

// Legacy function for backward compatibility
export function buildVariableExtractionPrompt(
  userPrompt: string,
  existingVariables: WorkflowVariable[],
  canvasContext: CanvasContext,
): string {
  return buildUnifiedPrompt(userPrompt, existingVariables, canvasContext);
}
