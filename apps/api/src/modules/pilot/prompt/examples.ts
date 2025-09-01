/**
 * This file contains example workflows that demonstrate proper tool sequencing
 * based on the requirements for the Pilot workflow system:
 *
 * 1. Research stage (early): MUST use toolsets with web_search, library_search, and information gathering tools
 * 2. Analysis stage (middle): MUST use toolsets with analytical and processing capabilities
 * 3. Synthesis stage (optional): MUST use toolsets with organizational and planning tools
 * 4. Creation stage (final): MUST ONLY use toolsets with generation tools (generate_doc, generate_code_artifact, generate_media) in the final 1-2 steps after sufficient context gathering
 *
 * The workflow MUST follow the correct sequence: research → analysis → synthesis → creation
 * Creation toolsets MUST ONLY be used in the final 1-2 steps
 * Creation toolsets MUST almost always reference previous context items (only in extremely rare cases can they generate without context dependency)
 * All code artifacts for visualizations MUST produce self-contained single-page HTML files
 */

import { type PilotStepRawOutput } from './schema';

/**
 * Builds example user questions for various research scenarios
 */
export function exampleUserQuestions() {
  return {
    marketResearch:
      'I need to research the current state of the electric vehicle market, focusing on major players, technology trends, and consumer adoption barriers.',
    climateImpacts:
      'I need to understand the impacts of global climate change on agriculture, economy, and population migration, and generate a comprehensive report.',
    renewableEnergy:
      'Research global renewable energy investment opportunities, especially focusing on growth projections, key companies, and technological advancements in solar, wind, and hydrogen sectors, and create a professional PowerPoint presentation for potential investors.',
    cityLivability:
      'I need to research the livability index of 50 major global cities, including factors like housing costs, environmental quality, transportation, safety, healthcare, and education, and create an interactive webpage that allows users to compare scores and rankings across different cities.',
  };
}

/**
 * Example 1: Market Research Workflow for Electric Vehicles
 * Demonstrates proper sequencing of tasks from research → analysis → creation
 * Note: Creation toolsets (with generate_doc, generate_code_artifact tools) are ONLY used in the final 1-2 steps
 * and MUST reference previous context items
 */
export function evMarketResearchExample(): PilotStepRawOutput[] {
  return [
    // RESEARCH STAGE - Begin with information gathering
    {
      name: 'Overview of global EV market',
      query:
        'Use web_search to find current state of global electric vehicle market 2023 statistics and trends',
      contextItemIds: [],
      workflowStage: 'research',
      priority: 1,
    },
    {
      name: 'Major EV manufacturers research',
      query:
        'Use web_search to research leading electric vehicle manufacturers and their market share comparison',
      contextItemIds: [],
      workflowStage: 'research',
      priority: 1,
    },
    {
      name: 'Current EV technology trends',
      query:
        'Use web_search to find latest electric vehicle technology trends including battery range and charging infrastructure',
      contextItemIds: ['ev-market-overview-node-id'],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Consumer adoption barriers',
      query:
        'Use web_search to research barriers to electric vehicle adoption and consumer concerns',
      contextItemIds: ['ev-market-overview-node-id'],
      workflowStage: 'research',
      priority: 2,
    },

    // ANALYSIS STAGE - Process and analyze the gathered information
    {
      name: 'EV market trends analysis',
      query:
        'Analyze the current trends and future trajectory of the electric vehicle market based on the research data collected',
      contextItemIds: [
        'ev-market-overview-node-id',
        'ev-manufacturers-node-id',
        'ev-tech-trends-node-id',
      ],
      workflowStage: 'analysis',
      priority: 3,
    },
    {
      name: 'EV adoption challenges analysis',
      query:
        'Analyze the main barriers to EV adoption and evaluate potential solutions based on research findings',
      contextItemIds: ['ev-market-overview-node-id', 'ev-consumer-barriers-node-id'],
      workflowStage: 'analysis',
      priority: 3,
    },

    // CREATION STAGE - ONLY in the final 1-2 steps and MUST reference previous context items
    {
      name: 'EV market comprehensive report',
      query:
        'Use generate_doc to create a comprehensive report on the EV market, including major players, technology trends, and consumer adoption barriers',
      contextItemIds: [
        'ev-market-overview-node-id',
        'ev-manufacturers-node-id',
        'ev-tech-trends-node-id',
        'ev-consumer-barriers-node-id',
        'ev-market-analysis-node-id',
        'ev-adoption-analysis-node-id',
      ],
      workflowStage: 'creation',
      priority: 4,
    },
    {
      name: 'EV market visualization',
      query:
        'Use generate_code_artifact to create a single-page HTML visualization dashboard showing EV market share by manufacturer and projected growth. Include interactive bar charts and trend lines with tooltips in a self-contained HTML file with all JavaScript, CSS, and data embedded directly in the file.',
      contextItemIds: [
        'ev-market-overview-node-id',
        'ev-manufacturers-node-id',
        'ev-market-analysis-node-id',
      ],
      workflowStage: 'creation',
      priority: 4,
    },
  ];
}

/**
 * Example 2: Web Research and Comprehensive Analysis on Climate Change Impacts
 * Shows how to structure a complex research workflow with proper tool sequencing
 * Note: Creation toolsets are ONLY used in the final 1-2 steps
 * and MUST reference previous context items
 */
export function climateChangeResearchExample(): PilotStepRawOutput[] {
  return [
    // RESEARCH STAGE - Begin with information gathering from various sources
    {
      name: 'Overview of climate change',
      query: 'Use web_search to find latest data on global climate change trends and projections',
      contextItemIds: [],
      workflowStage: 'research',
      priority: 1,
    },
    {
      name: 'Climate impact on agriculture',
      query:
        'Use web_search to research impacts of climate change on global agriculture and food security',
      contextItemIds: [],
      workflowStage: 'research',
      priority: 1,
    },
    {
      name: 'Economic impacts of climate change',
      query: 'Use web_search to find economic impacts of climate change by region and industry',
      contextItemIds: ['climate-overview-node-id'],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Climate-induced migration patterns',
      query:
        'Use web_search to research climate change population displacement and migration patterns',
      contextItemIds: ['climate-overview-node-id'],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Climate policy research',
      query: 'Use web_search to find global climate policy frameworks and mitigation strategies',
      contextItemIds: ['climate-overview-node-id'],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Climate case studies collection',
      query: 'Use web_search to find case studies of climate change impacts in vulnerable regions',
      contextItemIds: [
        'climate-agriculture-node-id',
        'climate-economic-node-id',
        'climate-migration-node-id',
      ],
      workflowStage: 'research',
      priority: 3,
    },

    // ANALYSIS STAGE - Process and synthesize the research data
    {
      name: 'Climate research synthesis',
      query: 'Synthesize key findings from all climate research into main themes and connections',
      contextItemIds: [
        'climate-overview-node-id',
        'climate-agriculture-node-id',
        'climate-economic-node-id',
        'climate-migration-node-id',
        'climate-policy-node-id',
        'climate-cases-node-id',
      ],
      workflowStage: 'analysis',
      priority: 3,
    },
    {
      name: 'Future climate scenarios analysis',
      query:
        'Analyze potential future climate scenarios and their projected impacts based on current research data',
      contextItemIds: [
        'climate-overview-node-id',
        'climate-policy-node-id',
        'climate-synthesis-node-id',
      ],
      workflowStage: 'analysis',
      priority: 3,
    },

    // CREATION STAGE - ONLY in the final 1-2 steps and MUST reference previous context items
    {
      name: 'Climate change comprehensive report',
      query:
        'Use generate_doc to create a comprehensive report on climate change impacts on agriculture, economy, and population migration',
      contextItemIds: ['climate-synthesis-node-id', 'climate-scenarios-node-id'],
      workflowStage: 'creation',
      priority: 4,
    },
    {
      name: 'Climate impacts visualization',
      query:
        'Use generate_code_artifact to create a single-page HTML dashboard visualization showing climate change impacts across sectors and regions. Include an interactive heatmap, line charts for trends, and a choropleth map, all in one self-contained HTML file with all data and JavaScript embedded directly in the file.',
      contextItemIds: ['climate-synthesis-node-id'],
      workflowStage: 'creation',
      priority: 4,
    },
  ];
}

/**
 * Example 3: Deep Research and Presentation Creation for Renewable Energy Investment
 * Demonstrates thorough research before creating investment presentation
 * Note: Creation toolsets are ONLY used in the final 1-2 steps
 * and MUST reference previous context items
 */
export function renewableEnergyExample(): PilotStepRawOutput[] {
  return [
    // RESEARCH STAGE - Comprehensive research on multiple sectors
    {
      name: 'Renewable energy market overview',
      query:
        'Use web_search to find global renewable energy market overview and investment trends 2023',
      contextItemIds: [],
      workflowStage: 'research',
      priority: 1,
    },
    {
      name: 'Solar energy investment research',
      query:
        'Use web_search to research solar energy industry investment opportunities and key companies',
      contextItemIds: [],
      workflowStage: 'research',
      priority: 1,
    },
    {
      name: 'Wind energy investment research',
      query:
        'Use web_search to research wind energy industry investment opportunities and key companies',
      contextItemIds: [],
      workflowStage: 'research',
      priority: 1,
    },
    {
      name: 'Hydrogen energy investment research',
      query:
        'Use web_search to research hydrogen energy industry investment opportunities and key companies',
      contextItemIds: [],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Renewable technology advancements',
      query: 'Use web_search to find latest technological advancements in renewable energy sectors',
      contextItemIds: [
        'renewable-solar-node-id',
        'renewable-wind-node-id',
        'renewable-hydrogen-node-id',
      ],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Renewable energy policies research',
      query:
        'Use web_search to find global renewable energy policies, subsidies, and incentives by region',
      contextItemIds: ['renewable-market-node-id'],
      workflowStage: 'research',
      priority: 2,
    },

    // ANALYSIS STAGE - In-depth analysis of research findings
    {
      name: 'Renewable investment risk analysis',
      query:
        'Analyze the risks and challenges associated with different renewable energy investments based on collected research',
      contextItemIds: [
        'renewable-market-node-id',
        'renewable-solar-node-id',
        'renewable-wind-node-id',
        'renewable-hydrogen-node-id',
      ],
      workflowStage: 'analysis',
      priority: 3,
    },
    {
      name: 'Renewable ROI comparison',
      query:
        'Compare projected returns on investment for different renewable energy sectors based on research data',
      contextItemIds: [
        'renewable-solar-node-id',
        'renewable-wind-node-id',
        'renewable-hydrogen-node-id',
        'renewable-risk-node-id',
      ],
      workflowStage: 'analysis',
      priority: 3,
    },
    {
      name: 'Investment strategy recommendations',
      query:
        'Formulate strategic recommendations for investing in renewable energy based on analysis findings',
      contextItemIds: [
        'renewable-market-node-id',
        'renewable-risk-node-id',
        'renewable-roi-node-id',
        'renewable-policy-node-id',
      ],
      workflowStage: 'analysis',
      priority: 3,
    },

    // SYNTHESIS STAGE - Organize information for presentation
    {
      name: 'Presentation outline creation',
      query:
        'Create a detailed outline for a professional renewable energy investment presentation based on research and analysis',
      contextItemIds: [
        'renewable-market-node-id',
        'renewable-solar-node-id',
        'renewable-wind-node-id',
        'renewable-hydrogen-node-id',
        'renewable-strategy-node-id',
      ],
      workflowStage: 'synthesis',
      priority: 4,
    },

    // CREATION STAGE - ONLY in the final 1-2 steps and MUST reference previous context items
    {
      name: 'Renewable investment data visualizations',
      query:
        'Use generate_code_artifact to create a single-page HTML dashboard comparing renewable energy sectors, returns, and growth projections. Include stacked bar charts, ROI comparison charts, and trend lines all integrated in one page.',
      contextItemIds: ['renewable-market-node-id', 'renewable-roi-node-id'],
      workflowStage: 'creation',
      priority: 4,
    },
    {
      name: 'Professional investment presentation',
      query:
        'Use generate_code_artifact to create a single-page HTML presentation for potential renewable energy investors. Build a complete slideshow interface with all slides embedded, charts, and interactive elements in one self-contained HTML file. Include all JavaScript, CSS, and data directly in the file.',
      contextItemIds: [
        'renewable-outline-node-id',
        'renewable-strategy-node-id',
        'renewable-tech-node-id',
        'renewable-visualizations-node-id',
      ],
      workflowStage: 'creation',
      priority: 5,
    },
  ];
}

/**
 * Example 4: Interactive Data Visualization for Global City Livability
 * Shows proper sequencing from research to data processing to final interactive output
 * Note: Creation toolsets are ONLY used in the final 1-2 steps
 * and MUST reference previous context items
 */
export function cityLivabilityExample(): PilotStepRawOutput[] {
  return [
    // RESEARCH STAGE - Gather fundamental data
    {
      name: 'Major cities selection',
      query: 'Use web_search to find list of 50 major global cities by population and significance',
      contextItemIds: [],
      workflowStage: 'research',
      priority: 1,
    },
    {
      name: 'Livability metrics definition',
      query: 'Use web_search to find key metrics and weights for city livability assessment',
      contextItemIds: [],
      workflowStage: 'research',
      priority: 1,
    },
    {
      name: 'Housing cost data collection',
      query: 'Use web_search to find housing costs comparison across major global cities',
      contextItemIds: ['cities-list-node-id'],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Environmental quality data',
      query:
        'Use web_search to find environmental quality, air pollution, and water quality rankings for global cities',
      contextItemIds: ['cities-list-node-id'],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Transportation data collection',
      query:
        'Use web_search to find public transportation quality and convenience data in major global cities',
      contextItemIds: ['cities-list-node-id'],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Safety index research',
      query: 'Use web_search to find safety rankings and crime rates in major global cities',
      contextItemIds: ['cities-list-node-id'],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Healthcare quality research',
      query:
        'Use web_search to find healthcare quality and accessibility data in major global cities',
      contextItemIds: ['cities-list-node-id'],
      workflowStage: 'research',
      priority: 2,
    },
    {
      name: 'Education quality research',
      query: 'Use web_search to find education quality rankings for major global cities',
      contextItemIds: ['cities-list-node-id'],
      workflowStage: 'research',
      priority: 2,
    },

    // ANALYSIS STAGE - Process and analyze the collected data
    {
      name: 'Data standardization plan',
      query:
        'Develop approach for standardizing different metrics across cities into comparable scores based on collected data',
      contextItemIds: [
        'livability-metrics-node-id',
        'housing-data-node-id',
        'environment-data-node-id',
        'transport-data-node-id',
        'safety-data-node-id',
        'healthcare-data-node-id',
        'education-data-node-id',
      ],
      workflowStage: 'analysis',
      priority: 3,
    },
    {
      name: 'Livability score calculation',
      query:
        'Define algorithm for calculating comprehensive livability scores based on weighted factors from research data',
      contextItemIds: ['livability-metrics-node-id', 'standardization-node-id'],
      workflowStage: 'analysis',
      priority: 3,
    },
    {
      name: 'City data analysis',
      query:
        'Analyze patterns and insights from city data, identifying key trends and correlations in livability factors',
      contextItemIds: [
        'housing-data-node-id',
        'environment-data-node-id',
        'transport-data-node-id',
        'safety-data-node-id',
        'healthcare-data-node-id',
        'education-data-node-id',
      ],
      workflowStage: 'analysis',
      priority: 3,
    },

    // SYNTHESIS STAGE - Design planning before implementation
    {
      name: 'Visualization interface design',
      query:
        'Design interface requirements for interactive city livability visualization based on analysis results',
      contextItemIds: ['livability-score-node-id', 'city-analysis-node-id'],
      workflowStage: 'synthesis',
      priority: 4,
    },

    // CREATION STAGE - ONLY in the final 1-2 steps and MUST reference previous context items
    {
      name: 'City livability data dashboard',
      query:
        'Use generate_code_artifact to create a single-page HTML dashboard with built-in data processing for the city livability data. Include the data transformation logic directly in the HTML file with all normalization and scoring calculations.',
      contextItemIds: ['standardization-node-id', 'livability-score-node-id'],
      workflowStage: 'creation',
      priority: 4,
    },
    {
      name: 'Interactive city map visualization',
      query:
        'Use generate_code_artifact to create a single-page HTML map visualization showing cities colored by livability score. Include the complete interactive map with all necessary data embedded in the HTML file.',
      contextItemIds: [
        'cities-list-node-id',
        'livability-score-node-id',
        'interface-design-node-id',
      ],
      workflowStage: 'creation',
      priority: 5,
    },
    {
      name: 'City comparison tool',
      query:
        'Use generate_code_artifact to create a single-page HTML tool that allows users to compare selected cities across different metrics. Include all data and interactive elements in a self-contained HTML file.',
      contextItemIds: ['interface-design-node-id', 'data-processing-node-id'],
      workflowStage: 'creation',
      priority: 5,
    },
    {
      name: 'Complete livability web application',
      query:
        'Use generate_code_artifact to create a comprehensive single-page HTML application that integrates all city livability visualizations, comparison tools, and data. Include all functionality in one self-contained HTML file with embedded data and scripts.',
      contextItemIds: ['city-map-node-id', 'comparison-tool-node-id', 'interface-design-node-id'],
      workflowStage: 'creation',
      priority: 5,
    },
  ];
}

/**
 * Builds formatted examples showing proper tool sequencing for LLM consumption
 * Includes examples for all workflow stages with clear labeling
 */
export function buildFormattedExamples(): string {
  // Get the full workflow examples
  const evMarketSteps = evMarketResearchExample();
  const climateChangeSteps = climateChangeResearchExample();
  const renewableEnergySteps = renewableEnergyExample();
  const cityLivabilitySteps = cityLivabilityExample();

  // Filter steps based on stage type
  const getStageSteps = (steps: PilotStepRawOutput[], targetStage: string) => {
    return steps.filter((step) => step.workflowStage === targetStage);
  };

  // Get examples for each stage
  const researchSteps = getStageSteps(evMarketSteps, 'research').slice(0, 3);
  const analysisSteps = getStageSteps(climateChangeSteps, 'analysis').slice(0, 3);
  const synthesisSteps = getStageSteps(renewableEnergySteps, 'synthesis').slice(0, 2);
  const creationSteps = getStageSteps(cityLivabilitySteps, 'creation').slice(0, 3);

  return `
## Proper Tool Selection and Sequencing Based on Epoch Progress

Task decomposition projects are divided into epochs (iterations), with each epoch representing progress through the workflow:

1. **Early Epochs (0-40% Progress)**
   - Stage: RESEARCH
   - Tool Selection: Select toolsets with web_search, library_search, and information gathering tools
   - Query Format: ALL queries MUST start with "Use [tool_name] to..."
   - Focus: Collecting foundational information and diverse perspectives

2. **Middle Epochs (40-70% Progress)**
   - Stage: ANALYSIS
   - Tool Selection: Select toolsets with analytical and processing capabilities
   - Query Format: Reference analytical processing of gathered data
   - Focus: Analyzing gathered information, identifying patterns and insights

3. **Late Middle Epochs (70-85% Progress)**
   - Stage: SYNTHESIS
   - Tool Selection: Select toolsets with organizational and planning tools
   - Query Format: Focus on organization and planning activities
   - Focus: Organizing findings and planning final deliverables

4. **Final Epochs (85-100% Progress)**
   - Stage: CREATION
   - Tool Selection: Select toolsets with generation tools (generate_doc, generate_code_artifact, generate_media)
   - Query Format: MUST explicitly specify "Use [tool_name] to..." with parameters
   - Focus: Creating polished deliverables based on all previous work

IMPORTANT: Always follow the sequence appropriate for the current epoch. Each epoch should primarily contain steps from its corresponding stage, but can include a few steps from adjacent stages as needed for smooth transition.

CRITICAL RULES FOR TOOL USAGE IN QUERIES:
- ALL queries MUST explicitly mention which specific tool to use
- Research queries MUST start with "Use web_search to..." or "Use library_search to..."
- Creation queries MUST specify "Use generate_doc to...", "Use generate_code_artifact to...", "Use generate_media with mediaType: [type] to..."
- Toolsets with generation tools (generate_doc, generate_code_artifact, generate_media) MUST ONLY be selected in the final 1-2 steps of the workflow
- These toolsets MUST reference previous context items in almost all cases
- Only in extremely rare cases can they generate without context dependency
- Never select these toolsets until sufficient research and analysis has been completed

## Research Stage Examples (Early Epochs)
User Question: "${exampleUserQuestions().marketResearch}"

Canvas Content:
### Canvas Item 1 (ID: ev-market-overview-node-id, Type: document)
**Document Title:** Overview of Electric Vehicle Market
**Document Preview:**
This document provides a basic overview of the current state of the electric vehicle market, including trends and major players.
**Context ID:** ev-market-overview-node-id

Examples of good research steps with explicit tool usage in queries:
${JSON.stringify(researchSteps, null, 2)}

Note: Every research query explicitly mentions which tool to use (web_search, library_search, scrape, etc.)

## Analysis Stage Examples (Middle Epochs)
User Question: "${exampleUserQuestions().climateImpacts}"

Canvas Content:
### Canvas Item 1 (ID: climate-overview-node-id, Type: document)
**Document Title:** Introduction to Climate Change
**Document Preview:**
This document provides an overview of global climate change science and observed impacts on different systems.
**Context ID:** climate-overview-node-id

### Canvas Item 2 (ID: climate-agriculture-node-id, Type: skillResponse)
**Question:** How does climate change affect agriculture?
**Answer:**
Climate change affects agriculture through changing precipitation patterns, temperature increases, extreme weather events, and shifting growing seasons.
**Context ID:** climate-agriculture-node-id

Examples of good analysis steps that process collected data:
${JSON.stringify(analysisSteps, null, 2)}

Note: Analysis queries focus on processing and analyzing the data collected in research stages.

## Synthesis Stage Examples (Late Middle Epochs)
User Question: "${exampleUserQuestions().renewableEnergy}"

Canvas Content:
### Canvas Item 1 (ID: renewable-market-node-id, Type: document)
**Document Title:** Global Renewable Energy Market Overview
**Document Preview:**
This document provides an overview of the current state of the global renewable energy market, including trends, major players, and investment opportunities.
**Context ID:** renewable-market-node-id

### Canvas Item 2 (ID: renewable-solar-node-id, Type: skillResponse)
**Question:** What are the key companies in solar energy?
**Answer:**
Major solar energy companies include First Solar, SunPower, JinkoSolar, Canadian Solar, and Tesla Solar with varying market shares and specializations.
**Context ID:** renewable-solar-node-id

Examples of good synthesis steps for organizing information:
${JSON.stringify(synthesisSteps, null, 2)}

Note: Synthesis queries focus on organizing and planning based on analysis results.

## Creation Stage Examples (Final Epochs)
User Question: "${exampleUserQuestions().cityLivability}"

Canvas Content:
### Canvas Item 1 (ID: cities-list-node-id, Type: document)
**Document Title:** Major Global Cities Overview
**Document Preview:**
This document provides information about 50 major global cities, including basic demographic and geographic data.
**Context ID:** cities-list-node-id

### Canvas Item 2 (ID: livability-metrics-node-id, Type: skillResponse)
**Question:** What metrics determine city livability?
**Answer:**
Key livability metrics include housing affordability, environmental quality, public transportation, safety, healthcare access, and education quality.
**Context ID:** livability-metrics-node-id

### Canvas Item 3 (ID: city-analysis-node-id, Type: skillResponse)
**Question:** What are the key patterns in city livability data?
**Answer:**
Analysis shows correlations between public transportation quality, environmental factors, and overall livability scores. Cities with strong public infrastructure tend to score higher overall.
**Context ID:** city-analysis-node-id

Examples of good creation steps with explicit tool specification:
${JSON.stringify(creationSteps, null, 2)}

CRITICAL: Every creation query explicitly specifies which generation tool to use (generate_doc, generate_code_artifact, generate_media) and references previous context items.`;
}

// Alias for backward compatibility
export function buildDetailedExamples(): string {
  return buildFormattedExamples();
}

/**
 * Builds examples relevant to the current research stage with intelligent tool selection
 */
export function buildResearchStepExamples(): string {
  return buildFormattedExamples();
}
