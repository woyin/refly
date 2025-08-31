import { WorkflowVariable, CanvasContext, HistoricalData } from './variable-extraction.dto';

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
  const historicalContextText = buildHistoricalContextText(historicalData);

  return `# AI Workflow Variable Intelligent Extraction Expert

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

### Canvas Context
${canvasContextText}

### Existing Variables
${existingVarsText}

### Historical Context
${historicalContextText}

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
    "userIntent": "Brief description of what the user wants to accomplish",
    "extractionConfidence": 0.85,
    "complexityScore": 0.6,
    "extractedEntityCount": 3,
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
      "name": "project_name",
      "value": [
        {
          "type": "text",
          "text": "Marketing Campaign"
        }
      ],
      "description": "Name of the marketing project",
      "variableType": "string",
      "source": "startNode",
      "extractionReason": "User specified project name in prompt",
      "confidence": 0.9
    }
  ],
  "reusedVariables": [
    {
      "detectedText": "existing project template",
      "reusedVariableName": "project_template",
      "confidence": 0.8,
      "reason": "User mentioned using existing template"
    }
  ],
  "processedPrompt": "Create a {{project_name}} using the {{project_template}}",
  "originalPrompt": "Original user input"
}
\`\`\`

## Variable Value Structure

Each variable must have a \`value\` array containing \`VariableValue\` objects:

- **For string variables**: Use \`{"type": "text", "text": "actual value"}\`
- **For resource variables**: Use \`{"type": "resource", "resource": {"name": "file_name", "fileType": "document", "storageKey": ""}}\`
- **For option variables**: Use \`{"type": "text", "text": "selected_option"}\`

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

      return `- ${v.name} (${v.variableType}): ${v.description} [Current values: ${valueText}]`;
    })
    .join('\n');
}

/**
 * Build canvas context text - internal utility function
 * Purpose: format canvas context into readable text description
 */
function buildCanvasContextText(canvasContext: CanvasContext): string {
  const parts: string[] = [];

  if (canvasContext.nodeCount > 0) {
    parts.push(`${canvasContext.nodeCount} nodes`);
  }

  if (canvasContext.complexity > 0) {
    const complexityLevel =
      canvasContext.complexity < 30
        ? 'simple'
        : canvasContext.complexity < 70
          ? 'medium'
          : 'complex';
    parts.push(`complexity: ${complexityLevel} (${canvasContext.complexity})`);
  }

  if (canvasContext.resourceCount > 0) {
    parts.push(`${canvasContext.resourceCount} resources`);
  }

  if (canvasContext.workflowType) {
    parts.push(`workflow type: ${canvasContext.workflowType}`);
  }

  if (canvasContext.primarySkills?.length > 0) {
    parts.push(`primary skills: ${canvasContext.primarySkills.join(', ')}`);
  }

  if (parts.length === 0) {
    return '- Basic canvas context';
  }

  return parts.join(', ');
}

/**
 * Build historical context text - internal utility function
 * Purpose: format historical data into readable text description
 */
function buildHistoricalContextText(historicalData?: HistoricalData): string {
  if (!historicalData) {
    return '- No historical data available';
  }

  const parts: string[] = [];

  if (historicalData.extractionHistory?.length > 0) {
    parts.push(`${historicalData.extractionHistory.length} previous extractions`);
  }

  if (historicalData.canvasPatterns?.length > 0) {
    parts.push(`${historicalData.canvasPatterns.length} variable patterns`);
  }

  if (parts.length === 0) {
    return '- Limited historical context';
  }

  return parts.join(', ');
}

// Legacy function for backward compatibility
export function buildVariableExtractionPrompt(
  userPrompt: string,
  existingVariables: WorkflowVariable[],
  canvasContext: CanvasContext,
): string {
  return buildUnifiedPrompt(userPrompt, existingVariables, canvasContext);
}
