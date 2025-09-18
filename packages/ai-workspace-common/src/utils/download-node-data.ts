import { message } from 'antd';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { TFunction } from 'i18next';
import { getFileExtensionFromType } from '@refly/utils/artifact';

// Interface for node data structure
interface NodeData {
  nodeId: string;
  nodeType: string;
  entityId: string;
  title?: string;
  metadata?: {
    [key: string]: any;
    imageUrl?: string;
    videoUrl?: string;
    audioUrl?: string;
    content?: string;
    type?: string;
    storageKey?: string;
    status?: string;
    url?: string;
  };
}

// Create a download link and trigger download
const triggerDownload = (href: string, fileName: string) => {
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Download file from URL with authentication
const downloadFromUrl = async (url: string, fileName: string): Promise<void> => {
  try {
    // Add download=1 query parameter to the URL
    const downloadUrl = new URL(url);
    downloadUrl.searchParams.set('download', '1');

    // Fetch the file with authentication
    const response = await fetch(downloadUrl.toString(), {
      credentials: 'include',
    });

    if (!response?.ok) {
      throw new Error(`Download failed: ${response?.status ?? 'unknown'}`);
    }

    // Get the blob from the response
    const blob = await response.blob();

    // Create a temporary object URL for download
    const objectUrl = URL.createObjectURL(blob);

    // Trigger download
    triggerDownload(objectUrl, fileName);

    // Clean up the object URL
    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    console.error('Download failed:', error);
    // Fallback to direct download if fetch fails
    triggerDownload(url, fileName);
  }
};

// Download text content as file
const downloadTextContent = (content: string, fileName: string, mimeType = 'text/plain') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, fileName);
  URL.revokeObjectURL(url);
};

// Get appropriate file extension for node type
const getFileExtension = (nodeType: string, metadata?: any): string => {
  switch (nodeType) {
    case 'image':
      return 'jpg'; // Default for images
    case 'video':
      return 'mp4'; // Default for videos
    case 'audio':
      return 'mp3'; // Default for audio
    case 'document':
      return 'md'; // Markdown for documents
    case 'codeArtifact':
      return getFileExtensionFromType(metadata?.type || 'text/html');
    case 'skillResponse':
      return 'txt'; // Plain text for skill responses
    case 'memo':
      return 'txt'; // Plain text for memos
    case 'resource':
      return 'txt'; // Default to text, could be enhanced based on resource type
    case 'website':
      return 'html'; // HTML for websites
    default:
      return 'txt';
  }
};

// Get sanitized filename
const getSanitizedFileName = (title: string, nodeType: string, metadata?: any): string => {
  const sanitizedTitle = title?.replace(/[<>:"/\\|?*]/g, '_') || `${nodeType}_${Date.now()}`;
  const extension = getFileExtension(nodeType, metadata);
  return `${sanitizedTitle}.${extension}`;
};

// Check if node has downloadable data
export const hasDownloadableData = (nodeData: NodeData): boolean => {
  const { nodeType, entityId, metadata = {} } = nodeData;

  switch (nodeType) {
    case 'image':
      return Boolean(metadata.imageUrl);

    case 'video':
      return Boolean(metadata.videoUrl);

    case 'audio':
      return Boolean(metadata.audioUrl);

    case 'document':
      return Boolean(metadata.content || entityId);

    case 'codeArtifact':
      return Boolean(metadata.content || entityId);

    case 'skillResponse':
      return Boolean(entityId);

    case 'memo':
      return Boolean(metadata.content);

    case 'resource':
      return Boolean(metadata.content || entityId);

    case 'website':
      return Boolean(metadata.url);

    default:
      return false;
  }
};

// Main download function for different node types
export const downloadNodeData = async (nodeData: NodeData, t: TFunction): Promise<void> => {
  const { nodeType, entityId, title = '', metadata = {} } = nodeData;
  const fileName = getSanitizedFileName(title, nodeType, metadata);

  try {
    switch (nodeType) {
      case 'image': {
        const imageUrl = metadata.imageUrl;
        if (!imageUrl) {
          message.error(t('canvas.download.error.noImageUrl', 'No image URL found'));
          return;
        }
        await downloadFromUrl(imageUrl, fileName);
        message.success(t('canvas.download.success.image', { fileName }));
        break;
      }

      case 'video': {
        const videoUrl = metadata.videoUrl;
        if (!videoUrl) {
          message.error(t('canvas.download.error.noVideoUrl', 'No video URL found'));
          return;
        }
        await downloadFromUrl(videoUrl, fileName);
        message.success(t('canvas.download.success.video', { fileName }));
        break;
      }

      case 'audio': {
        const audioUrl = metadata.audioUrl;
        if (!audioUrl) {
          message.error(t('canvas.download.error.noAudioUrl', 'No audio URL found'));
          return;
        }
        await downloadFromUrl(audioUrl, fileName);
        message.success(t('canvas.download.success.audio', { fileName }));
        break;
      }

      case 'document': {
        let content = metadata.content;
        if (!content && entityId) {
          const { data } = await getClient().getDocumentDetail({
            query: { docId: entityId },
          });
          content = data?.data?.content;
        }
        if (!content) {
          message.error(t('canvas.download.error.noDocumentContent', 'No document content found'));
          return;
        }
        downloadTextContent(content, fileName, 'text/markdown');
        message.success(t('canvas.download.success.document', { fileName }));
        break;
      }

      case 'codeArtifact': {
        let content = metadata.content;
        if (!content && entityId) {
          const { data } = await getClient().getCodeArtifactDetail({
            query: { artifactId: entityId },
          });
          content = data?.data?.content;
        }
        if (!content) {
          message.error(t('canvas.download.error.noCodeContent', 'No code content found'));
          return;
        }
        downloadTextContent(content, fileName, 'text/plain');
        message.success(t('canvas.download.success.code', { fileName }));
        break;
      }

      case 'skillResponse': {
        let content = '';
        if (entityId) {
          const { data } = await getClient().getActionResult({
            query: { resultId: entityId },
          });
          content =
            data?.data?.steps
              ?.map((step) => step?.content || '')
              .filter(Boolean)
              .join('\n\n') || '';
        }
        if (!content) {
          message.error(
            t('canvas.download.error.noSkillContent', 'No skill response content found'),
          );
          return;
        }
        downloadTextContent(content, fileName, 'text/plain');
        message.success(t('canvas.download.success.skillResponse', { fileName }));
        break;
      }

      case 'memo': {
        const content = metadata.content || '';
        if (!content) {
          message.error(t('canvas.download.error.noMemoContent', 'No memo content found'));
          return;
        }
        downloadTextContent(content, fileName, 'text/plain');
        message.success(t('canvas.download.success.memo', { fileName }));
        break;
      }

      case 'resource': {
        let content = metadata.content;
        if (!content && entityId) {
          const { data } = await getClient().getResourceDetail({
            query: { resourceId: entityId },
          });
          content = data?.data?.content;
        }
        if (!content) {
          message.error(t('canvas.download.error.noResourceContent', 'No resource content found'));
          return;
        }
        downloadTextContent(content, fileName, 'text/plain');
        message.success(t('canvas.download.success.resource', { fileName }));
        break;
      }

      case 'website': {
        const url = metadata.url;
        if (!url) {
          message.error(t('canvas.download.error.noWebsiteUrl', 'No website URL found'));
          return;
        }
        // For websites, we can download the URL as a text file or open it
        downloadTextContent(url, fileName.replace(/\.[^/.]+$/, '.txt'), 'text/plain');
        message.success(t('canvas.download.success.website', { fileName }));
        break;
      }

      default: {
        message.warning(
          t('canvas.download.error.unsupportedType', `Unsupported node type: ${nodeType}`),
        );
        break;
      }
    }
  } catch (error) {
    console.error('Download failed:', error);
    message.error(t('canvas.download.error.general', 'Download failed. Please try again.'));
  }
};

export type { NodeData };
