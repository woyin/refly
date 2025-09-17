import { SKIP, visit } from 'unist-util-visit';

// Define the tool use and tool result tags directly here to avoid circular dependencies
const TOOL_USE_TAG = 'tool_use';

// Define the tool use and tool result tags directly here to avoid circular dependencies
export const TOOL_USE_TAG_RENDER = 'reflyToolUse';

// Pre-compiled regular expressions for better performance
const TOOL_USE_REGEX = new RegExp(`<${TOOL_USE_TAG}[^>]*>([\\s\\S]*?)<\\/${TOOL_USE_TAG}>`, 'i');
const NAME_REGEX = /<name>([\s\S]*?)<\/name>/i;
const TYPE_REGEX = /<type>([\s\S]*?)<\/type>/i;
const TOOLSET_KEY_REGEX = /<toolsetKey>([\s\S]*?)<\/toolsetKey>/i;
const TOOLSET_NAME_REGEX = /<toolsetName>([\s\S]*?)<\/toolsetName>/i;
const ARGUMENTS_REGEX = /<arguments>([\s\S]*?)<\/arguments>/i;
const RESULT_REGEX = /<result>([\s\S]*?)<\/result>/i;

// Media URL patterns with named groups for efficient extraction
const MEDIA_PATTERNS = {
  BASE64_IMAGE:
    /data:image\/(?<format>png|jpeg|gif|webp|svg\+xml);base64,(?<data>[A-Za-z0-9+\/=]+)/i,
  HTTP_IMAGE: /https?:\/\/[^\s"'<>]+\.(?<format>png|jpeg|jpg|gif|webp|svg)[^\s"'<>]*/i,
  HTTP_AUDIO: /https?:\/\/[^\s"'<>]+\.(?<format>mp3|wav|ogg|flac|m4a|aac)[^\s"'<>]*/i,
  HTTP_VIDEO: /https?:\/\/[^\s"'<>]+\.(?<format>mp4|webm|avi|mov|wmv|flv|mkv|m4v)[^\s"'<>]*/i,
} as const;

// URL encoding mappings for efficient decoding
const URL_DECODE_MAPPINGS = [
  [/%5C%22/g, '\\"'],
  [/%5Cn/g, '\\n'],
  [/%5Cr/g, '\\r'],
  [/%5Ct/g, '\\t'],
  [/%2C/g, ','],
  [/%5C/g, '\\'],
] as const;

/**
 * Utility function to safely extract content from regex matches
 * Uses a cache to avoid re-executing the same regex on the same content
 */
const extractionCache = new Map<string, string>();

const safeExtract = (content: string, regex: RegExp): string => {
  const cacheKey = `${regex.source}::${content}`;

  if (extractionCache.has(cacheKey)) {
    return extractionCache.get(cacheKey)!;
  }

  const match = regex.exec(content);
  const result = match?.[1]?.trim() ?? '';

  // Cache the result for future use
  extractionCache.set(cacheKey, result);

  return result;
};

/**
 * Decode URL that may have been encoded by remarkGfm
 * Optimized with pre-defined mappings for better performance
 */
const decodeUrlFromRemarkGfm = (url: string): string => {
  let decodedUrl = url;
  for (const [pattern, replacement] of URL_DECODE_MAPPINGS) {
    decodedUrl = decodedUrl.replace(pattern, replacement);
  }

  try {
    // Then try standard URL decoding for any remaining encoded characters
    return decodeURIComponent(decodedUrl);
  } catch {
    // If decoding fails, return the URL with replacements only
    return decodedUrl;
  }
};

/**
 * Extract URLs from HTML elements (for content processed by remarkGfm)
 * @param element The HTML element to extract URLs from
 * @returns Array of found URLs
 */
const extractUrlsFromHtmlElements = (element: any): string[] => {
  const urls: string[] = [];

  if (element?.type === 'element' && element?.tagName === 'a' && element?.properties?.href) {
    // Decode the URL in case it was encoded by remarkGfm
    const decodedUrl = decodeUrlFromRemarkGfm(element.properties.href);
    urls.push(decodedUrl);
  }

  if (element?.children) {
    for (const child of element.children) {
      urls.push(...extractUrlsFromHtmlElements(child));
    }
  }

  return urls;
};

/**
 * Media types for unified processing
 */
type MediaType = 'image' | 'audio' | 'video';

interface MediaExtractionResult {
  url: string | undefined;
  format: string | undefined;
  isHttp: boolean;
  isBase64?: boolean;
}

/**
 * Unified media URL extraction function
 * Extracts image, audio, or video URLs from strings and HTML elements
 */
const extractMediaUrl = (
  str: string,
  mediaType: MediaType,
  htmlElements?: any[],
): MediaExtractionResult => {
  // First check HTML elements if provided (for remarkGfm processed content)
  if (htmlElements && mediaType === 'image') {
    for (const element of htmlElements) {
      const urls = extractUrlsFromHtmlElements(element);
      for (const url of urls) {
        const httpMatch = MEDIA_PATTERNS.HTTP_IMAGE.exec(url);
        if (httpMatch?.groups && httpMatch[0]) {
          return {
            url: httpMatch[0],
            format: httpMatch.groups.format,
            isHttp: true,
            isBase64: false,
          };
        }
      }
    }
  }

  // Check for base64 image URL (only for images)
  if (mediaType === 'image') {
    const base64Match = MEDIA_PATTERNS.BASE64_IMAGE.exec(str);
    if (base64Match?.groups && base64Match[0]) {
      return {
        url: base64Match[0],
        format: base64Match.groups.format,
        isHttp: false,
        isBase64: true,
      };
    }
  }

  // Check for HTTP URLs based on media type
  const pattern =
    mediaType === 'image'
      ? MEDIA_PATTERNS.HTTP_IMAGE
      : mediaType === 'audio'
        ? MEDIA_PATTERNS.HTTP_AUDIO
        : MEDIA_PATTERNS.HTTP_VIDEO;

  const httpMatch = pattern.exec(str);
  if (httpMatch?.groups && httpMatch[0]) {
    return {
      url: httpMatch[0],
      format: httpMatch.groups.format,
      isHttp: true,
      isBase64: false,
    };
  }

  return { url: undefined, format: undefined, isHttp: false, isBase64: false };
};

/**
 * Parse JSON safely with caching to avoid repeated parsing
 */
const jsonParseCache = new Map<string, any>();

const safeJsonParse = (jsonStr: string): any => {
  if (jsonParseCache.has(jsonStr)) {
    return jsonParseCache.get(jsonStr);
  }

  try {
    const parsed = JSON.parse(jsonStr);
    jsonParseCache.set(jsonStr, parsed);
    return parsed;
  } catch {
    jsonParseCache.set(jsonStr, null);
    return null;
  }
};

/**
 * Extract media attributes for all media types at once
 */
const extractAllMediaAttributes = (
  resultStr: string,
  argsStr: string,
  linkElements?: any[],
): Record<string, string> => {
  const attributes: Record<string, string> = {};

  // Extract all media URLs in parallel
  const imageResult = extractMediaUrl(resultStr, 'image', linkElements);
  const audioResult = extractMediaUrl(resultStr, 'audio');
  const videoResult = extractMediaUrl(resultStr, 'video');

  // If no direct matches found, try JSON parsing once for all media types
  if (!imageResult.url && !audioResult.url && !videoResult.url) {
    const resultObj = safeJsonParse(resultStr);
    if (resultObj) {
      const resultJsonStr = JSON.stringify(resultObj);
      const jsonImageResult = extractMediaUrl(resultJsonStr, 'image', linkElements);
      const jsonAudioResult = extractMediaUrl(resultJsonStr, 'audio');
      const jsonVideoResult = extractMediaUrl(resultJsonStr, 'video');

      // Process JSON results
      if (jsonImageResult.url) Object.assign(imageResult, jsonImageResult);
      if (jsonAudioResult.url) Object.assign(audioResult, jsonAudioResult);
      if (jsonVideoResult.url) Object.assign(videoResult, jsonVideoResult);
    }
  }

  // Extract name from arguments once for all media types
  let mediaNameFromArgs = '';
  if (argsStr) {
    const argsObj = safeJsonParse(argsStr);
    if (argsObj) {
      if (typeof argsObj.params === 'string') {
        const paramsObj = safeJsonParse(argsObj.params);
        if (paramsObj?.name && typeof paramsObj.name === 'string') {
          mediaNameFromArgs = paramsObj.name.trim();
        }
      } else if (argsObj.name && typeof argsObj.name === 'string') {
        mediaNameFromArgs = argsObj.name.trim();
      }
    }
  }

  // Process image attributes
  if (imageResult.url && imageResult.format) {
    if (imageResult.isHttp) {
      attributes['data-tool-image-http-url'] = imageResult.url;
    } else {
      attributes['data-tool-image-base64-url'] = imageResult.url;
    }
    const imageName = mediaNameFromArgs || 'image';
    attributes['data-tool-image-name'] = `${imageName}.${imageResult.format}`;
  }

  // Process audio attributes
  if (audioResult.url && audioResult.format) {
    attributes['data-tool-audio-http-url'] = audioResult.url;
    const audioName = mediaNameFromArgs || 'audio';
    attributes['data-tool-audio-name'] = `${audioName}.${audioResult.format}`;
    attributes['data-tool-audio-format'] = audioResult.format;
  }

  // Process video attributes
  if (videoResult.url && videoResult.format) {
    attributes['data-tool-video-http-url'] = videoResult.url;
    const videoName = mediaNameFromArgs || 'video';
    attributes['data-tool-video-name'] = `${videoName}.${videoResult.format}`;
    attributes['data-tool-video-format'] = videoResult.format;
  }

  return attributes;
};

/**
 * Extract tool attributes from content string
 */
const extractToolAttributes = (content: string, linkElements?: any[]): Record<string, string> => {
  const attributes: Record<string, string> = {};

  // Extract basic tool information
  const toolName = safeExtract(content, NAME_REGEX);
  if (toolName) attributes['data-tool-name'] = toolName;

  const toolType = safeExtract(content, TYPE_REGEX);
  if (toolType) attributes['data-tool-type'] = toolType;

  const toolsetKey = safeExtract(content, TOOLSET_KEY_REGEX);
  if (toolsetKey) attributes['data-tool-toolset-key'] = toolsetKey;

  const toolsetName = safeExtract(content, TOOLSET_NAME_REGEX);
  if (toolsetName) attributes['data-tool-toolset-name'] = toolsetName;

  const argsStr = safeExtract(content, ARGUMENTS_REGEX);
  if (argsStr) attributes['data-tool-arguments'] = argsStr;

  const resultStr = safeExtract(content, RESULT_REGEX);
  if (resultStr) {
    attributes['data-tool-result'] = resultStr;

    // Extract all media attributes at once
    const mediaAttributes = extractAllMediaAttributes(resultStr, argsStr, linkElements);
    Object.assign(attributes, mediaAttributes);
  }

  return attributes;
};

/**
 * Rehype plugin to process tool_use tags in markdown
 * When parsing <tool_use> tags, if a <result> exists, extract both <arguments> and <result> and put them on the same node property.
 * If there is no <result>, only extract <arguments>.
 * Preserves text content outside the tags, so text in paragraphs is not lost.
 */
function rehypePlugin() {
  return (tree: any) => {
    visit(tree, (node, index, parent) => {
      // Handle raw HTML nodes that might contain our tool tags
      if (node.type === 'raw') {
        // Check for tool_use tags
        if (node.value?.includes(`<${TOOL_USE_TAG}`)) {
          const match = TOOL_USE_REGEX.exec(node.value);
          if (match?.[1]) {
            const content = match[1];
            const attributes = extractToolAttributes(content);

            // Create a new node with the extracted data for tool_use
            const toolNode = {
              type: 'element',
              tagName: TOOL_USE_TAG_RENDER,
              properties: attributes,
              children: [],
            };

            // Get the full match (including the tags)
            const fullMatch = match[0];

            // Split the raw text by the full match to get text before and after the tool_use tag
            const parts = node.value.split(fullMatch);

            // Create array to hold new nodes
            const newNodes = [];

            // Add text before the tool_use tag if it exists
            if (parts[0]) {
              newNodes.push({
                type: 'raw',
                value: parts[0],
              });
            }

            // Add the tool node
            newNodes.push(toolNode);

            // Add text after the tool_use tag if it exists
            if (parts[1]) {
              newNodes.push({
                type: 'raw',
                value: parts[1],
              });
            }

            // Replace the original node with the new nodes
            parent.children.splice(index, 1, ...newNodes);
            return [SKIP, (index ?? 0) + newNodes.length - 1]; // Skip to after the last inserted node
          }
        }
      }

      // Handle text nodes within paragraphs that might contain our tool tags
      if (node.type === 'element' && node.tagName === 'p' && node.children?.length > 0) {
        let paragraphText = '';
        let hasToolUse = false;
        const linkElements: any[] = [];

        for (const child of node.children) {
          let value = '';
          if (child.type === 'text' || child.type === 'raw') {
            value = child.value || '';
          } else if (child.type === 'element' && child.tagName === 'a' && child.properties?.href) {
            value = decodeUrlFromRemarkGfm(child.properties.href);
            linkElements.push(child);
          }

          if (!hasToolUse && value.includes(`<${TOOL_USE_TAG}`)) {
            hasToolUse = true;
          }
          paragraphText += value;
        }

        // Check if paragraph contains tool_use tags
        if (hasToolUse) {
          const useMatch = TOOL_USE_REGEX.exec(paragraphText);
          if (useMatch?.[1]) {
            const content = useMatch[1];
            const attributes = extractToolAttributes(content, linkElements);

            // Create a new node with the extracted data for tool_use
            const toolNode = {
              type: 'element',
              tagName: TOOL_USE_TAG_RENDER,
              properties: attributes,
              children: [],
            };

            // Get the full match (including the tags)
            const fullMatch = useMatch[0];

            // Split the paragraph text by the full match to get text before and after the tool_use tag
            const parts = paragraphText.split(fullMatch);

            // Create new children array for the paragraph
            const newChildren = [];

            // Add text before the tool_use tag if it exists
            if (parts[0]) {
              newChildren.push({
                type: 'text',
                value: parts[0],
              });
            }

            // Add the tool node
            newChildren.push(toolNode);

            // Add text after the tool_use tag if it exists
            if (parts[1]) {
              newChildren.push({
                type: 'text',
                value: parts[1],
              });
            }

            // Replace the children of the paragraph with our new children
            node.children = newChildren;
            return [SKIP, index];
          }
        }
      }

      console.log('node', node);
      if (
        node.type === 'element' &&
        node.tagName === 'code' &&
        node.properties?.className?.includes('language-haha') &&
        node.children?.length > 0
      ) {
        let paragraphText = '';
        let hasToolUse = false;
        const linkElements: any[] = [];

        for (const child of node.children) {
          let value = '';
          if (child.type === 'text' || child.type === 'raw') {
            value = child.value || '';
          } else if (child.type === 'element' && child.tagName === 'a' && child.properties?.href) {
            value = decodeUrlFromRemarkGfm(child.properties.href);
            linkElements.push(child);
          }

          if (!hasToolUse && value.includes(`<${TOOL_USE_TAG}`)) {
            hasToolUse = true;
          }
          paragraphText += value;
        }

        // Check if paragraph contains tool_use tags
        if (hasToolUse) {
          const useMatch = TOOL_USE_REGEX.exec(paragraphText);
          if (useMatch?.[1]) {
            const content = useMatch[1];
            const attributes = extractToolAttributes(content, linkElements);

            // Create a new node with the extracted data for tool_use
            const toolNode = {
              type: 'element',
              tagName: TOOL_USE_TAG_RENDER,
              properties: attributes,
              children: [],
            };

            // Get the full match (including the tags)
            const fullMatch = useMatch[0];

            // Split the paragraph text by the full match to get text before and after the tool_use tag
            const parts = paragraphText.split(fullMatch);

            // Create new children array for the paragraph
            const newChildren = [];

            // Add text before the tool_use tag if it exists
            if (parts[0]) {
              newChildren.push({
                type: 'text',
                value: parts[0],
              });
            }

            // Add the tool node
            newChildren.push(toolNode);

            // Add text after the tool_use tag if it exists
            if (parts[1]) {
              newChildren.push({
                type: 'text',
                value: parts[1],
              });
            }

            parent.children = newChildren;
            parent.tagName = 'p';
            return [SKIP, index];
          }
        }
      }
    });
  };
}

export default rehypePlugin;
