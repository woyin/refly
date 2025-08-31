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

You are a professional workflow analysis expert specialized in intelligently extracting parameterizable variables from users' natural language input to build efficient, reusable workflow templates.

## Mission Statement
Transform user prompts into structured variable templates while maintaining semantic integrity and enforcing strict quantity controls for optimal workflow efficiency.

## Core Tasks
1. **Precise Identification**: Analyze user input, identify ONLY core variable parameters that significantly impact workflow outcomes
2. **Quantity Control**: Strictly limit each variable type to maximum 10 variables (string ≤ 10, resource ≤ 10, option ≤ 10)
3. **Intelligent Classification**: Categorize parameters into string/resource/option three types
4. **Variable Reuse**: Mandatory check and reuse existing variables before creating new ones
5. **Template Generation**: Generate processedPrompt template with {{variable_name}} placeholders

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

## Variable Type Definitions & Quantity Limits

### CRITICAL RULE: Variable Quantity Control
- **Maximum Limits**: Each variable type should NOT exceed 10 variables
  - string variables: Maximum 10
  - resource variables: Maximum 10  
  - option variables: Maximum 10
- **Quality over Quantity**: Extract only core, essential variables
- **Reuse First**: Always prioritize reusing existing variables over creating new ones
- **Focus on Impact**: Only extract variables that significantly affect workflow outcomes

### 1. string (Text Variable)
- **Purpose**: Pure text content, configuration parameters, description information
- **Examples**: Topic, title, requirements, style, language, etc.
- **Naming**: topic, title, style, language, requirement
- **Limit**: Maximum 10 string variables per extraction

### 2. resource (Resource Variable) 
- **Purpose**: Files, documents, images that users need to upload
- **Examples**: Resume files, reference documents, image materials, etc.
- **Naming**: resume_file, reference_doc, source_image
- **Limit**: Maximum 10 resource variables per extraction

### 3. option (Option Variable)
- **Purpose**: Predefined selection items, enumeration values
- **Examples**: Format selection, mode selection, level selection, etc.
- **Naming**: output_format, processing_mode, difficulty_level
- **Limit**: Maximum 10 option variables per extraction

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

### Step 4: Reuse Detection & Quantity Control
- **Mandatory Reuse Check**: Before creating any new variable, check existing variables for reuse possibilities
- Semantic similarity matching (threshold 0.8+)
- Pronoun detection ("this", "above", "just now")  
- Context association analysis
- **Quantity Validation**: Ensure each variable type stays within 10-variable limit
- **Prioritization**: If approaching limits, prioritize most impactful variables

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
    },
    "quantityValidation": {
      "stringWithinLimit": true,
      "resourceWithinLimit": true,
      "optionWithinLimit": true,
      "totalVariablesCount": 5
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

## Quality Standards & Validation Checklist

### Variable Quantity Control ✓
- [ ] String variables ≤ 10
- [ ] Resource variables ≤ 10  
- [ ] Option variables ≤ 10
- [ ] Total variables count verified and justified

### Variable Quality ✓
- [ ] Variable names: Clear, consistent, self-explanatory (snake_case format)
- [ ] Variable types: Accurate classification, conforming to three type definitions
- [ ] Reuse detection: High accuracy, reduce redundant variables
- [ ] Core focus: Only essential variables that significantly impact workflow

### Template Quality ✓
- [ ] Processed template: Maintain original meaning, correct placeholder replacement
- [ ] All variables properly referenced in template with {{variable_name}} format
- [ ] Template readability and semantic integrity preserved

### Extraction Validation ✓
- [ ] Each extracted variable has clear justification for its necessity
- [ ] Existing variables checked for reuse before creating new ones
- [ ] Variable descriptions are precise and actionable

${VARIABLE_EXTRACTION_EXAMPLES}

## Key Learning Points from Examples

1. **Quantity Control**: Notice how examples typically extract 4-8 variables per scenario, staying well within the 10-variable limit per type
2. **Variable Naming**: Use descriptive English names in snake_case format (e.g., departure_city, daily_routes, target_date, email_to)
3. **Type Classification**: 
   - string: Most common for text content, preferences, descriptions (e.g., destination, dates, goal)
   - resource: For files, data sources, uploads (e.g., data_file, resume_file)
   - option: For limited choices, style preferences (e.g., tone, style)
4. **Template Construction**: Replace specific values with {{variable_name}} placeholders while maintaining semantic meaning
5. **Context Preservation**: Keep the original intent and structure of the user's request
6. **Reuse Strategy**: Look for opportunities to reuse variables across different contexts (e.g., "destination" can be reused for different travel scenarios)
7. **Core Focus**: Extract only variables that have significant impact on the workflow outcome, avoid over-parameterization

## Final Validation Reminder
Before submitting extraction results, verify:
- ✅ Each variable type count ≤ 10 (MANDATORY LIMIT)
- ✅ Existing variables checked for reuse (MANDATORY CHECK)
- ✅ Only core, impactful variables extracted (QUALITY OVER QUANTITY)
- ✅ All variables properly integrated into processedPrompt template
- ✅ JSON format is valid and complete
- ✅ quantityValidation fields accurately reflect variable counts

## Extraction Success Criteria
A successful extraction MUST:
1. Stay within quantity limits (≤10 per variable type)
2. Reuse existing variables when semantically appropriate
3. Focus on workflow-critical variables only
4. Maintain original user intent in processedPrompt
5. Provide clear, actionable variable descriptions
6. Return valid JSON with all required fields

Remember: QUALITY and REUSE over creating new variables. Less is often more in variable extraction.`;
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
