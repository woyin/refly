import { SkillContext } from '@refly/openapi-schema';

/**
 * Prepare context from SkillContext into a structured markdown format for LLM consumption
 * Converts user-selected context items into clear markdown structure with citation indices
 */
export async function prepareContext(ctx: SkillContext): Promise<{ contextStr: string }> {
  if (!ctx) {
    return { contextStr: '' };
  }

  const sections: string[] = [];
  let citationIndex = 1;

  // Process user selected content
  if (ctx.contentList?.length > 0) {
    const contentItems = ctx.contentList
      .map((item) => {
        const metadata = item.metadata || {};
        const title = (metadata as any)?.title || 'Untitled Content';
        const domain = (metadata as any)?.domain || 'unknown';
        const entityId = (metadata as any)?.entityId;
        const url = (metadata as any)?.url;

        let sourceInfo = `**Source:** ${domain}`;
        if (entityId) {
          sourceInfo += ` (ID: ${entityId})`;
        }
        if (url) {
          sourceInfo += `\n**URL:** ${url}`;
        }

        return `### ${title} [[citation:${citationIndex++}]]

${sourceInfo}

${item.content}`;
      })
      .join('\n\n---\n\n');

    sections.push(`## User Selected Content\n\n${contentItems}`);
  }

  // Process knowledge base documents
  if (ctx.documents?.length > 0) {
    const documentItems = ctx.documents
      .filter((item) => item.document?.content) // Only include documents with content
      .map((item) => {
        const doc = item.document!;
        const docId = doc.docId || 'unknown';
        const title = doc.title || 'Untitled Document';
        const content = doc.content || '';

        return `### ${title} [[citation:${citationIndex++}]]

**Document ID:** ${docId}

${content}`;
      })
      .join('\n\n---\n\n');

    if (documentItems) {
      sections.push(`## Knowledge Base Documents\n\n${documentItems}`);
    }
  }

  // Process knowledge base resources
  if (ctx.resources?.length > 0) {
    const resourceItems = ctx.resources
      .filter((item) => item.resource?.content) // Only include resources with content
      .map((item) => {
        const resource = item.resource!;
        const resourceId = resource.resourceId || 'unknown';
        const title = resource.title || 'Untitled Resource';
        const content = resource.content || '';
        const resourceType = resource.resourceType || 'unknown';

        return `### ${title} [[citation:${citationIndex++}]]

**Resource ID:** ${resourceId}
**Type:** ${resourceType}

${content}`;
      })
      .join('\n\n---\n\n');

    if (resourceItems) {
      sections.push(`## Knowledge Base Resources\n\n${resourceItems}`);
    }
  }

  // Process code artifacts
  if (ctx.codeArtifacts?.length > 0) {
    const codeArtifactItems = ctx.codeArtifacts
      .filter((item) => item.codeArtifact?.content) // Only include artifacts with content
      .map((item) => {
        const artifact = item.codeArtifact!;
        const artifactId = artifact.artifactId || 'unknown';
        const title = artifact.title || 'Untitled Code Artifact';
        const content = artifact.content || '';
        const language = artifact.language || 'text';

        return `### ${title} [[citation:${citationIndex++}]]

**Artifact ID:** ${artifactId}
**Language:** ${language}

\`\`\`${language}
${content}
\`\`\``;
      })
      .join('\n\n---\n\n');

    if (codeArtifactItems) {
      sections.push(`## Code Artifacts\n\n${codeArtifactItems}`);
    }
  }

  // Process media items
  if (ctx.mediaList?.length > 0) {
    const mediaItems = ctx.mediaList
      .map((item) => {
        const entityId = item.entityId;
        const title = item.title || 'Untitled Media';
        const url = item.url;
        const mediaType = item.mediaType;
        const storageKey = item.storageKey;

        return `### ${title} [[citation:${citationIndex++}]]

**Media ID:** ${entityId}
**Type:** ${mediaType}
**URL:** ${url}
**Storage Key:** ${storageKey}

*Media file: ${title}*`;
      })
      .join('\n\n---\n\n');

    sections.push(`## Media Items\n\n${mediaItems}`);
  }

  // Process deprecated URLs (for backward compatibility)
  if (ctx.urls?.length > 0) {
    const urlItems = ctx.urls
      .map((item) => {
        const url = item.url;
        const metadata = item.metadata || {};
        const title = (metadata as any)?.title || url;

        return `### ${title} [[citation:${citationIndex++}]]

**URL:** ${url}`;
      })
      .join('\n\n---\n\n');

    sections.push(`## URLs\n\n${urlItems}`);
  }

  // Join all sections with proper spacing
  const contextStr = sections.length > 0 ? `# Context\n\n${sections.join('\n\n')}` : '';

  return { contextStr };
}
