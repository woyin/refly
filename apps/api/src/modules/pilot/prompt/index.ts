import { CanvasContentItem } from '../../canvas/canvas.dto';
import { GenericToolset, PilotSession, PilotStep } from '@refly/openapi-schema';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { pilotStepSchema } from './schema';
import { buildFormattedExamples } from './examples';
import {
  formatCanvasContent,
  formatTodoMd,
  formatCanvasIntoMermaidFlowchart,
  formatToolsets,
} from './formatter';

/**
 * Determines the recommended workflow stage based on the current epoch
 * @param currentEpoch Current epoch number (0-based)
 * @param totalEpochs Total number of epochs (0-based)
 * @returns The recommended workflow stage for the current epoch
 */
export function getRecommendedStageForEpoch(currentEpoch: number, totalEpochs: number): string {
  // Normalize to handle edge cases
  const normalizedCurrentEpoch = Math.max(0, currentEpoch);
  const normalizedTotalEpochs = Math.max(1, totalEpochs);

  // Calculate progress as a percentage
  const progress = normalizedCurrentEpoch / normalizedTotalEpochs;
  const span = 1 / normalizedTotalEpochs;

  // Assign stages based on progress
  if (progress < span) {
    return 'research';
  } else if (progress < span * 2) {
    return 'analysis';
  } else if (progress < span * 3) {
    return 'synthesis';
  } else {
    return 'creation';
  }
}

/**
 * Generates guidance for the current epoch stage with intelligent tool selection
 * @param stage The current workflow stage
 * @returns Guidance text for the prompt
 */
export function generateStageGuidance(stage: string): string {
  switch (stage) {
    case 'research':
      return `
## CURRENT EPOCH STAGE: RESEARCH (Early Stage)
In this early stage, focus exclusively on gathering information using appropriate tools:

### Recommended Tool Categories:
- **Information Gathering Tools**: web_search, library_search, scrape, search, crawl
- **Basic Analysis Tools**: Use tools with analysis capabilities for initial information processing
- **DO NOT** use creation/generation tools yet (generate_doc, generate_media, generate_code_artifact)

### Tool Selection Strategy:
- **web_search**: For current information, news, trends, and general web content
- **library_search**: For searching internal knowledge base and existing documents
- **scrape/crawl tools**: For extracting content from specific websites or domains
- **search tools**: For comprehensive web searches with full content extraction

### Query Format Requirements:
- ALL queries MUST explicitly mention which tool to use
- Examples:
  * "Use web_search to find latest electric vehicle market statistics"
  * "Use library_search to locate internal documents about renewable energy policies"
  * "Use scrape tool to extract information from Tesla's investor relations page"
  * "Use search tool to gather comprehensive data on climate change impacts"

### Guidelines:
- Focus on broad information gathering about the topic
- Collect diverse perspectives and factual information
- Explore different aspects of the question systematically
- ALL steps in this epoch should have workflowStage="research"
- Select tools based on the specific information source needed
- EVERY query must start with "Use [tool_name] to..."`;

    case 'analysis':
      return `
## CURRENT EPOCH STAGE: ANALYSIS (Middle Stage)
In this middle stage, focus on analyzing the information collected using analytical tools:

### Recommended Tool Categories:
- **Analysis Tools**: Tools with analytical and reasoning capabilities
- **Data Processing Tools**: Tools that can process and structure information
- **Comparison Tools**: Tools that can compare and contrast different data sources

### Tool Selection Strategy:
- Build upon research collected in previous epochs
- Use tools that can identify patterns, contradictions, and insights
- Select tools that can evaluate quality and reliability of information
- Choose tools that can compare different perspectives and approaches

### Query Format Requirements:
- Queries MUST explicitly name the analysis-capable tool
- Examples:
  * "Use [analysis_tool] to analyze the web search results and identify key market trends and patterns"
  * "Use [processing_tool] to process the scraped data and evaluate competitive positioning and opportunities"
  * "Use [comparison_tool] to compare findings from multiple research sources and surface contradictions and insights"
  * "Use [evaluation_tool] to assess the quality and reliability of collected information sources"

### Guidelines:
- Identify patterns, contradictions, and insights from gathered data
- Evaluate the quality and reliability of information
- Compare different perspectives and approaches
- Synthesize preliminary findings
- MOST steps in this epoch should have workflowStage="analysis"
- NO creation tools allowed yet`;

    case 'synthesis':
      return `
## CURRENT EPOCH STAGE: SYNTHESIS (Late Middle Stage)
In this late middle stage, focus on organizing and planning outputs using synthesis-capable tools:

### Recommended Tool Categories:
- **Synthesis Tools**: Tools capable of organizing and structuring information
- **Planning Tools**: Tools that can help plan deliverable structures
- **Organization Tools**: Tools that can create frameworks and outlines

### Tool Selection Strategy:
- Organize information into coherent frameworks
- Identify the most important findings and insights
- Plan the structure of final deliverables
- Draft outlines for documents or applications

### Query Format Requirements:
- Queries MUST explicitly name the synthesis/organization tool
- Examples:
  * "Use [synthesis_tool] to create a detailed outline for the final report based on analysis findings"
  * "Use [organization_tool] to organize research findings into coherent themes and frameworks"
  * "Use [planning_tool] to plan the structure of final deliverables"
  * "Use [design_tool] to draft interface requirements for the visualization dashboard"

### Guidelines:
- Organize information into coherent frameworks
- Identify the most important findings and insights
- Plan the structure of final deliverables
- Draft outlines for documents or code
- MOST steps should have workflowStage="synthesis"
- LIMITED creation steps allowed (max 1)`;

    case 'creation':
      return `
## CURRENT EPOCH STAGE: CREATION (Final Stage)
In this final stage, focus on creating comprehensive outputs using creation tools:

### Available Creation Tool Categories:
- **Document Generation**: generate_doc, create_document tools
- **Code Generation**: generate_code_artifact, code creation tools
- **Media Generation**: generate_media tools (unified multimedia generator)
- **Specialized Creation**: Domain-specific creation tools

### Intelligent Tool Selection for Creation:

#### Media Content Detection and Tool Selection:
When users request multimedia content, select the appropriate generate_media tool:

**Media Type Detection Rules**:
- **Image Content** (use generate_media with mediaType: image):
  - Keywords: "图片", "图像", "照片", "插图", "设计", "海报", "标志", "图标", "示意图", "画", "绘制", "图表"
  - English: "image", "picture", "photo", "illustration", "design", "poster", "logo", "icon", "diagram", "draw", "chart", "graphic", "visual", "artwork", "banner"
  
- **Video Content** (use generate_media with mediaType: video):
  - Keywords: "视频", "动画", "短片", "演示", "录像", "影片", "动态", "片段", "电影"
  - English: "video", "animation", "demo", "demonstration", "movie", "clip", "footage", "commercial", "trailer", "motion", "animated", "film"
  
- **Audio Content** (use generate_media with mediaType: audio):
  - Keywords: "音频", "音乐", "声音", "语音", "音效", "背景音", "播客", "配音", "歌曲", "录音"
  - English: "audio", "music", "sound", "voice", "speech", "podcast", "narration", "song", "recording", "sound effect", "jingle", "soundtrack", "background music"

#### Query Format Requirements for Creation:
- ALL creation queries MUST explicitly specify the tool and parameters
- Examples:
  * "Use generate_doc to create a comprehensive market analysis report with executive summary, findings, and recommendations"
  * "Use generate_code_artifact to create an interactive HTML dashboard with embedded charts and data visualization"
  * "Use generate_media with mediaType: image to create an infographic summarizing key research findings"
  * "Use generate_media with mediaType: video to create a presentation video explaining the analysis results"

#### Creation Tool Selection Logic:
1. **Analyze user intent** for content type (document, code, media)
2. **Select appropriate creation tool** based on detected content type
3. **Format queries correctly** with required parameters (e.g., mediaType for media generation)
4. **Reference context** from previous research and analysis steps

### Important Rules:
- MUST reference previous research context in contextItemIds
- Each creation step should build upon information gathered in previous stages
- Use specific, descriptive queries that include requirements and specifications
- ALL creation steps should have workflowStage="creation"
- Creation tools should ONLY be used in the final 1-2 steps
- MUST reference previous context items in almost all cases
- EVERY query must explicitly state "Use [tool_name] to..."`;

    default:
      return `
## CURRENT EPOCH STAGE: RESEARCH (Default Stage)
Focus on gathering information using appropriate research tools:

### Tool Selection:
- Use information gathering tools (web_search, library_search, etc.)
- Select tools based on the specific information source needed
- DO NOT use creation tools yet
- ALL steps in this epoch should have workflowStage="research"

### Query Format Requirements:
- ALL queries MUST explicitly mention which tool to use
- Examples:
  * "Use web_search to find latest information about [topic]"
  * "Use library_search to locate internal documents about [topic]"
  * "Use scrape tool to extract information from [specific website]"`;
  }
}

/**
 * Generates a detailed schema guide with intelligent tool selection examples
 */
export function generateSchemaInstructions(): string {
  // Convert Zod schema to JSON Schema for better documentation
  const jsonSchema = zodToJsonSchema(pilotStepSchema, { target: 'openApi3' });

  return `Please generate a structured JSON array of task steps with intelligent tool selection following this schema:

Each step should have:
1. "name": A clear, concise title for the step
2. "query": The specific question or prompt to send to the selected tools - MUST explicitly reference which tools to use
3. "contextItemIds": Array of IDs for relevant canvas items that provide context for this step
4. "workflowStage": The stage of the workflow this step belongs to (one of: "research", "analysis", "synthesis", "creation")

#### CRITICAL: Tool-Specific Query Format Requirements:

**Research Stage Queries** - MUST explicitly mention tools:
- "Use web_search to find current electric vehicle market statistics and trends"
- "Use library_search to find internal documents about renewable energy policies"
- "Use scrape tool to extract content from the Tesla investor relations page"
- "Use search tool to find comprehensive information about climate change impacts on agriculture"

**Analysis Stage Queries** - MUST explicitly name an analysis-capable tool:
- "Use [analysis_tool] to analyze the collected market data and identify key trends and patterns"
- "Use [processing_tool] to process the research findings and evaluate investment opportunities and risks"
- "Use [comparison_tool] to compare and contrast different renewable energy technologies based on gathered data"

**Creation Stage Queries** - MUST explicitly specify the generation tool and parameters:
- "Use generate_doc to create a comprehensive market analysis report based on research findings"
- "Use generate_code_artifact to create an interactive HTML dashboard with embedded charts and data visualization"
- "Use generate_media with mediaType: image to create an infographic summarizing key findings"
- "Use generate_media with mediaType: video to create a presentation video explaining the research results"

#### Tool Selection Strategy:
1. **Analyze the task requirements** - What type of information or output is needed?
2. **Identify the appropriate tool category** - Information gathering, analysis, or creation?
3. **Select toolsets** that contain the required tool types
4. **Craft queries that explicitly mention the specific tools to use**
5. **Reference context** when building on previous steps

#### Media Generation Tool Selection:
For multimedia content requests, use generate_media tools with proper mediaType specification:
- **Image Content**: "Use generate_media with mediaType: image to create [specific image description]"
- **Video Content**: "Use generate_media with mediaType: video to create [specific video description]"
- **Audio Content**: "Use generate_media with mediaType: audio to create [specific audio description]"

### Query Formatting Examples by Tool Type:

**Information Gathering Tools:**
- web_search: "Use web_search to research the latest developments in artificial intelligence regulation"
- library_search: "Use library_search to find existing documents about company sustainability practices"
- scrape: "Use scrape tool to extract detailed information from the Apple financial reports page"
- search: "Use search tool to find comprehensive information about global renewable energy investments"
- crawl: "Use crawl tool to gather all available content from the Tesla sustainability website"

**Creation Tools:**
- generate_doc: "Use generate_doc to create a professional research report titled 'Global EV Market Analysis' with executive summary, findings, and recommendations"
- generate_code_artifact: "Use generate_code_artifact to create an interactive HTML visualization showing market share data with charts and filtering capabilities"
- generate_media: "Use generate_media with mediaType: image to create an infographic showing the top 10 renewable energy companies by market cap"

### Workflow Optimization:
- **Simple Requests**: Can use 1-2 steps with direct tool selection
- **Complex Requests**: Follow standard research → analysis → creation workflow
- **Context Dependencies**: Creation tasks should reference previous context items
- **Priority Assignment**: Use priority 1 for critical tasks, 2-3 for supporting tasks

JSON Schema Definition:
\`\`\`json
${JSON.stringify(jsonSchema, null, 2)}
\`\`\`

IMPORTANT:
- Each step query MUST explicitly mention which tool(s) to use from the available toolsets
- Make queries specific about the tool usage and expected output format
- Ensure each step has a clear purpose that contributes to the main objective
- Creation tasks MUST ONLY be used in the final 1-2 steps
- For simple requests, direct generation without context is acceptable
- For complex requests, creation tasks MUST reference previous context items
- Select toolsets based on the specific capabilities needed for each step
- Ensure your response is a valid JSON array of steps that follow the schema exactly
`;
}

/**
 * Builds few-shot examples for research step decomposition
 */
export function buildResearchStepExamples(): string {
  return buildFormattedExamples();
}

/**
 * Generates the tool-specific query requirements section
 */
function generateToolQueryRequirements() {
  return `## CRITICAL: Tool-Specific Query Requirements

Every step query MUST explicitly mention which specific tools to use from the available toolsets above. This is essential for proper tool selection and execution.

### Query Format Requirements by Stage:

**Research Stage (Early Epochs):**
- Queries MUST start with or include explicit tool mentions
- Examples:
  * "Use web_search to find current market data on electric vehicles"
  * "Use library_search to locate internal documents about renewable energy"
  * "Use scrape tool to extract information from the Tesla investor page"
  * "Use search tool to gather comprehensive data on climate change impacts"

**Analysis Stage (Mid Epochs):**
- Queries MUST explicitly name an analysis-capable tool
- Examples:
  * "Use [analysis_tool] to analyze the web search results and identify key market trends"
  * "Use [processing_tool] to process the scraped data and evaluate competitive positioning"
  * "Use [comparison_tool] to compare findings from multiple sources and identify patterns"

**Creation Stage (Final Epochs):**
- Queries MUST explicitly specify the generation tool and parameters
- Examples:
  * "Use generate_doc to create a market analysis report with findings from previous research"
  * "Use generate_code_artifact to build an interactive HTML dashboard showing the collected data"
  * "Use generate_media with mediaType: image to create an infographic of key statistics"`;
}

/**
 * Generates the intelligent tool selection guidelines section
 */
function generateToolSelectionGuidelines() {
  return `## Intelligent Tool Selection Guidelines

### Stage-Based Tool Selection Strategy:

1. **Research and Information Gathering (Early Stages - MUST USE FIRST)**
   - **Information Gathering**: Select toolsets with web_search, library_search, scrape, search tools
   - **Knowledge Base Access**: Use library_search for internal documents and resources
   - **Web Content**: Use web_search, scrape, crawl tools for external information
   - **Specialized Search**: Use domain-specific search tools when available

2. **Analysis and Processing (Mid Stages - ONLY AFTER RESEARCH)**
   - **Data Analysis**: Select toolsets with analytical and reasoning capabilities
   - **Information Processing**: Use tools that can structure and organize information
   - **Pattern Recognition**: Choose tools that can identify insights and connections

3. **Creation and Output Generation (Final Stages - ONLY AT THE END)**
   - **Document Creation**: Use generate_doc, create_document tools
   - **Code Generation**: Use generate_code_artifact tools
   - **Media Generation**: Use generate_media tools with proper mediaType specification
   - **Specialized Creation**: Use domain-specific creation tools when needed

### CRITICAL Tool Selection Rules - STRICTLY FOLLOW THESE:
- First 60% of steps MUST select research/information gathering tools
- The first 2-3 steps MUST select web_search or library_search tools
- Next 20% should select analysis and processing tools
- Last 20% can select creation tools ONLY after sufficient research and analysis
- NEVER select creation tools (generate_doc, generate_code_artifact, generate_media) in the first 60% of steps
- MUST ONLY select creation tools in the final 1-2 steps
- Creation tools MUST almost always reference previous context items
- Tool selection must follow the strict sequence: Research Tools → Analysis Tools → Creation Tools
- ALL QUERIES MUST EXPLICITLY MENTION WHICH TOOLS TO USE`;
}

/**
 * Generates the step generation guidelines section
 */
function generateStepGuidelines(maxStepsPerEpoch: number, hasContext = true) {
  const contextGuidelines = hasContext
    ? '4. Reference relevant context items from the canvas when appropriate\n   - Use the exact context IDs (e.g., "quantum-intro-123") from the Canvas Content section\n   - Include multiple context IDs when a step builds on multiple sources'
    : '4. Use empty arrays for contextItemIds since no context is available yet';

  const creationRules = hasContext
    ? '8. Creation toolsets MUST ONLY be selected in the final 1-2 steps and MUST reference previous context items'
    : '8. Creation toolsets MUST ONLY be selected in the final 1-2 steps';

  return `## Step Generation Guidelines
1. Break down the task into logical, sequential steps
2. **Intelligently select toolsets** based on the specific capabilities needed for each step
3. **Craft queries that explicitly mention which tools to use** from the selected toolsets
${contextGuidelines}
5. Assign the appropriate workflowStage value to each step (research, analysis, synthesis, creation)
6. Generate exactly ${maxStepsPerEpoch} task steps to efficiently address the user's request
7. REQUIRED: First step MUST select toolsets with web_search or library_search capabilities
${creationRules}
9. **EVERY query must explicitly state which tool(s) to use**`;
}

/**
 * Generates the common prompt structure with shared sections
 */
function generateCommonPromptStructure(params: {
  userQuestion: string;
  session: PilotSession;
  steps: PilotStep[];
  availableToolsets: GenericToolset[];
  contentItems: CanvasContentItem[];
  maxStepsPerEpoch: number;
  locale?: string;
  isMainPrompt?: boolean;
}): string {
  const {
    session,
    steps,
    availableToolsets,
    maxStepsPerEpoch,
    contentItems,
    locale,
    userQuestion,
  } = params;

  const combinedContent = formatCanvasContent(contentItems);
  const todoMd = formatTodoMd(session, steps);
  const canvasVisual = formatCanvasIntoMermaidFlowchart(contentItems);
  const formattedToolsets = formatToolsets(availableToolsets);

  // Calculate the current epoch based on the session's metadata or default to 0
  const currentEpoch = session?.currentEpoch ?? 0;
  const totalEpochs = session?.maxEpoch ?? 3;

  // Determine recommended stage for current epoch
  const recommendedStage = getRecommendedStageForEpoch(currentEpoch, totalEpochs);

  // Generate stage-specific guidance
  const stageGuidance = generateStageGuidance(recommendedStage);

  // Generate locale-specific instructions
  const localeInstructions = locale
    ? `\n## Output Language Instructions\nPlease generate all step names, queries, and any text content in ${locale}. The research plan should be tailored for ${locale} language output.\n`
    : '';

  return `You are an expert task decomposition agent in a multi-agent system. Your role is to break down complex user requests into clear, actionable steps with intelligent tool selection for actor agents to execute.

## Your Task
Analyze the user's question and available canvas content, then generate a structured task plan with specific steps that intelligently select the most appropriate tools for each sub-task.
${localeInstructions}
${stageGuidance}

## Available Toolsets and Tools

${formattedToolsets}

${generateToolQueryRequirements()}

${generateToolSelectionGuidelines()}

${generateStepGuidelines(maxStepsPerEpoch, true)}

  ## Schema Instructions:

  ${generateSchemaInstructions()}

## Examples with expected outputs:

${buildResearchStepExamples()}

## Current Todo List:
${todoMd}

## Canvas Content:
${combinedContent}

## Canvas Structure:
${canvasVisual}

## User Question: 

"${userQuestion}"

Remember: You are a planner agent delegating sub-tasks to actor agents. Select tools intelligently based on each step's requirements, ensure proper workflow sequencing, and ALWAYS specify which tools to use in each query.
`;
}

/**
 * Generates the main planning prompt with canvas content and available toolsets
 */
export function generatePlanningPrompt(params: {
  userQuestion: string;
  session: PilotSession;
  steps: PilotStep[];
  availableToolsets: GenericToolset[];
  contentItems: CanvasContentItem[];
  maxStepsPerEpoch: number;
  locale?: string;
}): string {
  return generateCommonPromptStructure({ ...params, isMainPrompt: true });
}

/**
 * Generates the fallback prompt for manual JSON parsing
 */
export function generateFallbackPrompt(params: {
  userQuestion: string;
  session: PilotSession;
  steps: PilotStep[];
  contentItems: CanvasContentItem[];
  availableToolsets: GenericToolset[];
  maxStepsPerEpoch: number;
  locale?: string;
}): string {
  const prompt = generateCommonPromptStructure(params);

  return `${prompt}

Respond ONLY with a valid JSON array wrapped in \`\`\`json and \`\`\` tags.`;
}
