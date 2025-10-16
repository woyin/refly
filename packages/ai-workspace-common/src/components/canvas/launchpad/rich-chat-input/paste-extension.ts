import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

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
            let textToInsert = '';

            if (htmlData) {
              // Clean the HTML content by removing unwanted tags
              const cleanedHtml = cleanHtmlContent(htmlData);

              // If the content was modified, use cleaned content
              if (cleanedHtml !== htmlData) {
                event.preventDefault();

                // Create a temporary div to parse the cleaned HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = cleanedHtml;
                textToInsert = tempDiv.textContent || tempDiv.innerText || '';
              } else {
                // No modification needed, let default behavior handle it
                return false;
              }
            } else {
              // No HTML data, get plain text
              const plainText = clipboardData.getData('text/plain');
              if (plainText) {
                // For plain text, we can insert it directly
                textToInsert = plainText;
                event.preventDefault();
              } else {
                return false;
              }
            }

            // Insert the cleaned text content
            if (textToInsert.trim()) {
              const { state, dispatch } = view;
              const tr = state.tr.replaceSelectionWith(state.schema.text(textToInsert));
              dispatch(tr);
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});

// Function to clean HTML content by removing unwanted tags
function cleanHtmlContent(html: string): string {
  // Create a temporary div to parse the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Remove unwanted tags while preserving text content
  const unwantedTags = [
    'strong',
    'b',
    'code',
    'pre',
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
    'blockquote',
  ];

  for (const tagName of unwantedTags) {
    const elements = tempDiv.querySelectorAll(tagName);
    for (const element of elements) {
      // Replace the element with its text content
      const textNode = document.createTextNode(element.textContent || '');
      element.parentNode?.replaceChild(textNode, element);
    }
  }

  // Remove any remaining HTML tags, keeping only text content
  const cleanText = tempDiv.textContent || tempDiv.innerText || '';

  // Return the cleaned text wrapped in a simple paragraph
  return `<p>${cleanText}</p>`;
}
