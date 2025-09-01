import { PilotSession, PilotStep, ToolsetDefinition, GenericToolset } from '@refly/openapi-schema';
import { CanvasContentItem } from '../../canvas/canvas.dto';
import { PilotStepRawOutput } from './schema';

/**
 * Formats the canvas content items into a detailed, structured string format
 */
export function formatCanvasContent(contentItems: CanvasContentItem[]): string {
  if (!contentItems?.length) {
    return '';
  }

  // Add an index to each item and format with detailed information
  return contentItems
    .map((item, index) => {
      const itemId = item?.id || 'unknown-id';
      const itemType = item?.type || 'unknown-type';
      const header = `## Canvas Item ${index + 1} (ID: ${itemId}, Type: ${itemType})`;

      if (itemType === 'skillResponse') {
        return `${header}\n**Question:** ${item?.title || 'No title'}\n**Answer:**\n${item?.content || 'No content'}\n**Context ID:** ${itemId}`;
      }

      if (itemType === 'document') {
        if (item?.title && item?.content) {
          return `${header}\n**Document Title:** ${item.title}\n**Document Content:**\n${item.content}\n**Context ID:** ${itemId}`;
        }
        if (item?.title && item?.contentPreview) {
          return `${header}\n**Document Title:** ${item.title}\n**Document Preview:**\n${item.contentPreview}\n**Context ID:** ${itemId}`;
        }
      }

      if (itemType === 'codeArtifact') {
        return `${header}\n**Code Snippet:** ${item?.title || 'Untitled Code'}\n\`\`\`\n${item?.content || item?.contentPreview || 'No code available'}\n\`\`\`\n**Context ID:** ${itemId}`;
      }

      // Generic case for other item types
      if (item?.title && (item?.content || item?.contentPreview)) {
        return `${header}\n**Title:** ${item.title}\n**Content:**\n${item?.content || item?.contentPreview || 'No content available'}\n**Context ID:** ${itemId}`;
      }

      return null;
    })
    .filter(Boolean)
    .join('\n\n---\n\n');
}

/**
 * Formats the session and steps into a markdown TODO-list.
 */
export function formatTodoMd(session: PilotSession, steps: PilotStep[]): string {
  const completedSteps: PilotStep[] = steps.filter((step) => step.status === 'finish');
  const pendingSteps: PilotStep[] = steps.filter((step) => step.status !== 'finish');

  // Calculate the current epoch based on the session's metadata or default to 1
  const currentEpoch = session?.currentEpoch ?? 0;
  const totalEpochs = session?.maxEpoch ?? 3;

  let markdown = `# Todo: ${session.title ?? 'Research Plan'}\n\n`;

  // Add original request
  markdown += `## Original Request\n${session.input?.query ?? ''}\n\n`;

  // Add status
  markdown += `## Status\n${session.status ?? 'pending'}\n\n`;

  // Add current epoch
  markdown += `## Current Epoch: ${currentEpoch + 1}/${totalEpochs + 1}\n\n`;

  // Tasks section
  markdown += '## Tasks\n\n';

  // Completed tasks
  markdown += '### Completed\n';
  if (completedSteps?.length > 0) {
    for (const step of completedSteps) {
      markdown += `- [x] ${step.stepId}: ${step.name}\n`;
    }
  }
  markdown += '\n';

  // Pending tasks
  markdown += '### Pending\n';
  if (pendingSteps?.length > 0) {
    for (const step of pendingSteps) {
      const rawOutput: PilotStepRawOutput = JSON.parse(step.rawOutput ?? '{}');
      const { priority, query, workflowStage } = rawOutput;

      // Format: - [ ] task-id: task name (Priority: X)
      markdown += `- [ ] ${step.name}: ${query} (Priority: ${priority ?? 3})\n`;

      // Add workflow stage if available
      if (workflowStage) {
        markdown += `  - Stage: ${workflowStage}\n`;
      }
    }
  }

  return markdown;
}

/**
 * Formats the canvas content items into a mermaid flowchart.
 */
export function formatCanvasIntoMermaidFlowchart(contentItems: CanvasContentItem[]): string {
  if (!contentItems?.length) {
    return '```mermaid\ngraph TD\n    EmptyCanvas[Canvas is empty]\n```';
  }

  // Map of IDs to safe IDs for Mermaid (removing special characters)
  const idMap = new Map<string, string>();

  // Create safe IDs for Mermaid diagram
  contentItems.forEach((item, index) => {
    const itemId = item?.id || `unknown-${index}`;
    // Create a safe ID that works in Mermaid (alphanumeric with underscores)
    const safeId = `node_${index}_${itemId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    idMap.set(itemId, safeId);
  });

  // Start building the Mermaid diagram
  let mermaidCode = '```mermaid\ngraph TD\n';

  // Add nodes with proper styling based on type
  for (const item of contentItems) {
    const itemId = item?.id || 'unknown';
    const safeId = idMap.get(itemId) || `node_${itemId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const title = item?.title?.replace(/"/g, '\\"') || 'Untitled';
    const itemType = item?.type || 'unknown-type';

    // Define node style based on type
    let nodeStyle = '';
    switch (itemType) {
      case 'document':
        nodeStyle = 'class="document" fill:#f9f9f9,stroke:#666';
        break;
      case 'skillResponse':
        nodeStyle = 'class="skill" fill:#e6f7ff,stroke:#1890ff';
        break;
      case 'codeArtifact':
        nodeStyle = 'class="code" fill:#f6ffed,stroke:#52c41a';
        break;
      default:
        nodeStyle = 'class="default" fill:#fff,stroke:#d9d9d9';
    }

    // Add node with label and style
    mermaidCode += `    ${safeId}["${title}"] style ${safeId} ${nodeStyle}\n`;
  }

  // Add connections based on inputIds
  for (const item of contentItems) {
    const itemId = item?.id || 'unknown';
    const safeId = idMap.get(itemId) || `node_${itemId.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Check if item has input IDs (dependencies)
    if (item?.inputIds?.length) {
      for (const inputId of item.inputIds) {
        const safeInputId = idMap.get(inputId);
        // Only add connection if input ID exists in our map
        if (safeInputId) {
          mermaidCode += `    ${safeInputId} --> ${safeId}\n`;
        }
      }
    }
  }

  // Add legend
  mermaidCode += '    subgraph Legend\n';
  mermaidCode +=
    '        Document["Document"] style Document class="document" fill:#f9f9f9,stroke:#666\n';
  mermaidCode +=
    '        Skill["Skill Response"] style Skill class="skill" fill:#e6f7ff,stroke:#1890ff\n';
  mermaidCode +=
    '        Code["Code Artifact"] style Code class="code" fill:#f6ffed,stroke:#52c41a\n';
  mermaidCode += '    end\n';

  // End the Mermaid diagram
  mermaidCode += '```';

  return mermaidCode;
}

/**
 * Formats a single toolset into a structured string format
 */
export function formatToolset(toolset: ToolsetDefinition | GenericToolset): string {
  if (!toolset) {
    return '';
  }

  // Handle GenericToolset type
  // TODO: optimize formatter for MCP tools
  if ('type' in toolset) {
    const genericToolset = toolset as GenericToolset;
    const key =
      genericToolset.type === 'regular'
        ? (genericToolset.toolset?.key ?? 'unknown-key')
        : (genericToolset.name ?? 'unknown-name');

    const description =
      genericToolset.toolset?.definition?.descriptionDict?.en ?? 'No description available';

    const tools = genericToolset.toolset?.definition?.tools ?? [];
    const toolList = tools
      .map((tool) => {
        const toolDescription =
          tool.descriptionDict?.en ?? tool.descriptionDict?.['zh-CN'] ?? 'No description available';
        return `  - ${tool.name}: ${toolDescription}`;
      })
      .join('\n');

    return `## Toolset: ${genericToolset.name}
**Key:** ${key}
**Type:** ${genericToolset.type}
**Description:** ${description}
**Tools:**
${toolList}`;
  }

  // Handle ToolsetDefinition type
  const definition = toolset as ToolsetDefinition;
  const description =
    definition.descriptionDict?.en ??
    definition.descriptionDict?.['zh-CN'] ??
    'No description available';

  const toolList =
    definition.tools
      ?.map((tool) => {
        const toolDescription =
          tool.descriptionDict?.en ?? tool.descriptionDict?.['zh-CN'] ?? 'No description available';
        return `  - ${tool.name}: ${toolDescription}`;
      })
      .join('\n') ?? '';

  return `## Toolset: ${definition.key}
**Key:** ${definition.key}
**Description:** ${description}
**Tools:**
${toolList}`;
}

/**
 * Formats an array of toolsets into a comprehensive string format
 */
export function formatToolsets(toolsets: (ToolsetDefinition | GenericToolset)[]): string {
  if (!toolsets?.length) {
    return 'No toolsets available';
  }

  return toolsets
    .map((toolset) => {
      const formatted = formatToolset(toolset);
      return formatted ? `${formatted}\n` : null;
    })
    .filter(Boolean)
    .join('\n---\n\n');
}
