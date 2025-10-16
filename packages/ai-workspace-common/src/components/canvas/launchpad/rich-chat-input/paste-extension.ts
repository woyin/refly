import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DOMParser as ProseMirrorDOMParser } from '@tiptap/pm/model';

// Extension to handle paste events and remove unwanted HTML tags
export const PasteCleanupExtension = Extension.create({
  name: 'pasteCleanup',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('pasteCleanup'),
        props: {
          handlePaste: (view, event) => {
            // Get the clipboard data
            const clipboardData = event.clipboardData;
            if (!clipboardData) {
              return false;
            }

            // Get HTML content from clipboard first
            const htmlData = clipboardData.getData('text/html');
            const { state, dispatch } = view;

            if (htmlData) {
              // Clean the HTML content by removing unwanted tags while preserving paragraph structure
              const cleanedHtml = cleanHtmlContent(htmlData);

              // Always prevent default and use cleaned content to ensure consistent behavior
              event.preventDefault();

              // Parse cleaned HTML into a Slice and insert to preserve paragraph structure
              const container = document.createElement('div');
              container.innerHTML = cleanedHtml;
              const parser = ProseMirrorDOMParser.fromSchema(state.schema);
              const slice = parser.parseSlice(container);
              dispatch(state.tr.replaceSelection(slice));
              return true;
            } else {
              // No HTML data, get plain text
              const plainText = clipboardData.getData('text/plain');

              if (plainText) {
                // Convert markdown-like text into plain paragraphs (strip styles)
                const paragraphHtml = stripMarkdownToParagraphHtml(plainText);
                event.preventDefault();

                const container = document.createElement('div');
                container.innerHTML = paragraphHtml;
                const parser = ProseMirrorDOMParser.fromSchema(state.schema);
                const slice = parser.parseSlice(container);
                dispatch(state.tr.replaceSelection(slice));
                return true;
              } else {
                return false;
              }
            }
          },
        },
      }),
    ];
  },
});

// Function to clean HTML content by removing unwanted tags while preserving paragraph structure
function cleanHtmlContent(html: string): string {
  // Create a temporary div to parse the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Remove dangerous or irrelevant tags entirely
  const removeAll = (selector: string) => {
    const nodes = tempDiv.querySelectorAll(selector);
    for (const n of nodes) {
      n.parentNode?.removeChild(n);
    }
  };
  removeAll('script, style, meta, link');

  // Remove unwanted tags while preserving text content and paragraph structure
  const unwantedTags = [
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'strike',
    'del',
    'mark',
    'small',
    'sub',
    'sup',
  ];

  for (const tagName of unwantedTags) {
    const elements = tempDiv.querySelectorAll(tagName);
    for (const element of elements) {
      // Replace the element with its text content
      const textNode = document.createTextNode(element.textContent || '');
      element.parentNode?.replaceChild(textNode, element);
    }
  }

  // Unwrap all span except mention spans; drop heavy inline styles
  const spans = tempDiv.querySelectorAll('span');
  for (const span of spans) {
    const isMention =
      span.classList?.contains('mention') || span.getAttribute('data-mention') != null;

    if (isMention) {
      // Ensure canonical attributes for robustness
      span.classList.add('mention');
      if (!span.getAttribute('data-mention')) span.setAttribute('data-mention', 'true');
      // Keep all existing attributes for mention tags
      continue;
    }

    // For non-mention spans, replace with plain text
    const textNode = document.createTextNode(span.textContent || '');
    span.parentNode?.replaceChild(textNode, span);
  }

  // Process paragraph structure using leaf block-level nodes to avoid duplicates from nesting
  const blockSelector = 'p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre';
  const blockNodes = tempDiv.querySelectorAll(blockSelector);
  const processedParagraphs: string[] = [];

  const isNonEmptyHtml = (html: string): boolean => {
    const text = html
      .replace(/<br\s*\/?>(\n)?/gi, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .trim();
    return text.length > 0;
  };

  if (blockNodes.length > 0) {
    const leafBlocks = Array.from(blockNodes).filter((el) => !el.querySelector(blockSelector));
    for (const element of leafBlocks) {
      const tag = element.tagName?.toLowerCase?.() ?? '';
      if (tag === 'pre') {
        // Preserve code lines by splitting into plain paragraphs
        const codeText = element.textContent ?? '';
        const lines = codeText.split(/\r?\n/).map((l) => l.trim());
        for (const line of lines) {
          if (line.length > 0) {
            processedParagraphs.push(line);
          }
        }
        continue;
      }

      const htmlContent = (element as HTMLElement).innerHTML?.trim() ?? '';
      if (isNonEmptyHtml(htmlContent)) {
        processedParagraphs.push(htmlContent);
      }
    }
  }

  // Fallback: if no leaf blocks produced output, use raw text split by lines
  if (processedParagraphs.length === 0) {
    const textContent = tempDiv.textContent ?? tempDiv.innerText ?? '';
    const lines = textContent.split(/\r?\n/);
    if (lines.length > 1) {
      processedParagraphs.push(
        ...lines.map((line) => line.trim()).filter((line) => line.length > 0),
      );
    } else {
      processedParagraphs.push(textContent);
    }
  }

  // If no paragraphs were found, use the original text content
  if (processedParagraphs.length === 0) {
    const textFallback = tempDiv.textContent ?? tempDiv.innerText ?? '';
    processedParagraphs.push(textFallback);
  }

  // Join paragraphs with proper HTML structure
  return processedParagraphs.map((p) => `<p>${p}</p>`).join('');
}

// Function to strip common markdown formatting and return paragraph HTML
function stripMarkdownToParagraphHtml(text: string): string {
  if (!text) {
    return '<p></p>';
  }

  let normalized = text;

  // Normalize Windows/Mac line endings
  normalized = normalized.replace(/\r\n?/g, '\n');

  // Remove fenced code block markers ```lang ... ``` while preserving content
  normalized = normalized.replace(/```[\s\S]*?```/g, (match) => {
    // Drop the backticks but keep inner content and newlines
    return match.replace(/```/g, '');
  });

  // Remove inline code backticks
  normalized = normalized.replace(/`([^`]+)`/g, '$1');

  // Remove emphasis markers: **bold**, __bold__, *em*, _em_
  normalized = normalized.replace(/\*\*([^*]+)\*\*/g, '$1');
  normalized = normalized.replace(/__([^_]+)__/g, '$1');
  normalized = normalized.replace(/\*([^*]+)\*/g, '$1');
  normalized = normalized.replace(/_([^_]+)_/g, '$1');

  // Remove strikethrough ~~text~~
  normalized = normalized.replace(/~~([^~]+)~~/g, '$1');

  // Remove heading markers ######, ##### ... #
  normalized = normalized.replace(/^\s{0,3}#{1,6}\s+/gm, '');

  // Remove blockquote markers '>'
  normalized = normalized.replace(/^\s{0,3}>\s?/gm, '');

  // Simplify links: [text](url) -> text
  normalized = normalized.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

  // Simplify images: ![alt](url) -> alt
  normalized = normalized.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1');

  // Remove list markers while keeping content
  normalized = normalized.replace(/^\s*[-*+]\s+/gm, '');
  normalized = normalized.replace(/^\s*\d+\.\s+/gm, '');

  // Split paragraphs by two or more newlines
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (!paragraphs?.length) {
    // Fallback: treat single-line as one paragraph
    return `<p>${normalized.trim()}</p>`;
  }

  return paragraphs.map((p) => `<p>${p}</p>`).join('');
}
