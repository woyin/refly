import { visit } from 'unist-util-visit';
import { processRawNode, processParagraphNode, processCodeNode } from './nodeProcessor';

export { TOOL_USE_TAG_RENDER } from './toolProcessor';

/**
 * Rehype plugin to process tool_use tags in markdown
 * When parsing <tool_use> tags, if a <result> exists, extract both <arguments> and <result> and put them on the same node property.
 * If there is no <result>, only extract <arguments>.
 * Preserves text content outside the tags, so text in paragraphs is not lost.
 */
function rehypePlugin() {
  return (tree: any) => {
    visit(tree, (node, index, parent) => {
      // Process raw HTML nodes that might contain tool tags
      const rawResult = processRawNode(node, index, parent);
      if (rawResult) {
        return rawResult;
      }

      // Process paragraph nodes that might contain tool tags
      const paragraphResult = processParagraphNode(node, index);
      if (paragraphResult) {
        return paragraphResult;
      }

      // Process code nodes with specific language class that might contain tool tags
      const codeResult = processCodeNode(node, index, parent);
      if (codeResult) {
        return codeResult;
      }
    });
  };
}

export default rehypePlugin;
