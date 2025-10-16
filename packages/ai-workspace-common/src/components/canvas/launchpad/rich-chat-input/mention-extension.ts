import React from 'react';
import { createRoot } from 'react-dom/client';
import Mention from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { getVariableIcon } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/variable/getVariableIcon';
import type { CanvasNodeType } from '@refly/openapi-schema';
import { MentionList } from './mentionList';
import type { MentionItem } from './mentionList';
import { ToolsetIcon } from '@refly-packages/ai-workspace-common/components/canvas/common/toolset-icon';

// Helper function to render NodeIcon consistently
const renderNodeIcon = (source: string, variableType: string, nodeAttrs: any) => {
  if (source === 'variables') {
    return getVariableIcon(variableType);
  } else if (source === 'stepRecord') {
    return React.createElement(NodeIcon, {
      type: 'skillResponse' as CanvasNodeType,
      small: true,
      filled: false,
      className: '!w-3.5 !h-3.5',
    });
  } else if (source === 'resultRecord' || source === 'myUpload') {
    const nodeType = variableType || 'document';
    return React.createElement(NodeIcon, {
      type: nodeType as CanvasNodeType,
      small: true,
      filled: false,
      url: nodeType === 'image' ? nodeAttrs.url : undefined,
      resourceType: nodeAttrs.resourceType,
      resourceMeta: nodeAttrs.resourceMeta,
      className: '!w-3.5 !h-3.5',
    });
  } else if (source === 'toolsets' || source === 'tools') {
    return React.createElement(ToolsetIcon, {
      toolset: nodeAttrs.toolset,
      isBuiltin: nodeAttrs.toolset?.builtin,
      disableInventoryLookup: true,
      config: { size: 14, className: 'flex-shrink-0', builtinClassName: '!w-3.5 !h-3.5' },
    });
  } else {
    const nodeType = variableType || 'document';
    return React.createElement(NodeIcon, {
      type: nodeType as CanvasNodeType,
      small: true,
      filled: false,
      className: '!w-3.5 !h-3.5',
    });
  }
};

// Custom Mention extension with icon support
const CustomMention = Mention.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      entityId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-entity-id'),
        renderHTML: (attributes) => {
          if (!attributes.entityId) {
            return {};
          }
          return {
            'data-entity-id': attributes.entityId,
          };
        },
      },
      source: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-source'),
        renderHTML: (attributes) => {
          if (!attributes.source) {
            return {};
          }
          return {
            'data-source': attributes.source,
          };
        },
      },
      url: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-url'),
        renderHTML: (attributes) => {
          if (!attributes.url) {
            return {};
          }
          return {
            'data-url': attributes.url,
          };
        },
      },
      variableType: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-variable-type'),
        renderHTML: (attributes) => {
          if (!attributes.variableType) {
            return {};
          }
          return {
            'data-variable-type': attributes.variableType,
          };
        },
      },
      resourceType: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-resource-type'),
        renderHTML: (attributes) => {
          if (!attributes.resourceType) {
            return {};
          }
          return {
            'data-resource-type': attributes.resourceType,
          };
        },
      },
      resourceMeta: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-resource-meta'),
        renderHTML: (attributes) => {
          if (!attributes.resourceMeta) {
            return {};
          }
          return {
            'data-resource-meta': JSON.stringify(attributes.resourceMeta),
          };
        },
      },
      toolsetId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-toolset-id'),
        renderHTML: (attributes) => {
          if (!attributes.toolsetId) {
            return {};
          }
          return {
            'data-toolset-id': attributes.toolsetId,
          };
        },
      },
      toolset: {
        default: null,
        parseHTML: (element) => {
          try {
            const raw = element.getAttribute('data-toolset');
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        },
        renderHTML: (attributes) => {
          if (!attributes.toolset) {
            return {};
          }
          return {
            'data-toolset': JSON.stringify(attributes.toolset),
          };
        },
      },
    };
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.className = 'mention';
      // Ensure mention node view behaves as an atomic, non-editable inline
      // element so browser selection cannot land inside its text content.
      // This allows Cmd/Ctrl+A and Backspace/Delete to remove the whole node
      // correctly when the selection spans it.
      dom.setAttribute('contenteditable', 'false');
      dom.setAttribute('draggable', 'false');
      dom.setAttribute('data-mention', 'true');
      (dom as any).spellcheck = false;

      // Create icon container
      const iconContainer = document.createElement('span');
      iconContainer.className = 'mention-icon';
      iconContainer.setAttribute('aria-hidden', 'true');

      // Create text container
      const textContainer = document.createElement('span');
      textContainer.className = 'mention-text';
      textContainer.textContent = node.attrs.label || node.attrs.id;
      textContainer.setAttribute('aria-hidden', 'true');

      const variableType = node.attrs.variableType || node.attrs.source;
      const source = node.attrs.source;

      let reactRoot: any = null;
      reactRoot = createRoot(iconContainer);

      // Use NodeIcon based on source type
      reactRoot.render(renderNodeIcon(source, variableType, node.attrs));

      dom.appendChild(iconContainer);
      dom.appendChild(textContainer);

      return {
        dom,
        destroy() {
          // Clean up React root when the node is destroyed
          if (reactRoot) {
            try {
              reactRoot.unmount();
            } catch {
              // Ignore cleanup errors
            }
          }
        },
      };
    };
  },
});

interface MentionExtensionOptions {
  handleCommand: (params: { editor: any; range: any; props: any }) => void;
  hasUserInteractedRef: React.MutableRefObject<boolean>;
  allItemsRef: React.MutableRefObject<MentionItem[]>;
  mentionPosition: 'top-start' | 'bottom-start';
  setIsMentionListVisible: (visible: boolean) => void;
}

export const createMentionExtension = ({
  handleCommand,
  hasUserInteractedRef,
  allItemsRef,
  mentionPosition,
  setIsMentionListVisible,
}: MentionExtensionOptions) => {
  return CustomMention.configure({
    HTMLAttributes: {
      class: 'mention',
    },
    suggestion: {
      char: '@',
      command: handleCommand,
      items: () => {
        // Require explicit user interaction before providing items
        if (!hasUserInteractedRef.current) {
          return [];
        }

        return allItemsRef.current ?? [];
      },

      // Only show suggestion when user is actively typing @
      allow: () => {
        // Require explicit user interaction to enable suggestions
        if (!hasUserInteractedRef.current) {
          return false;
        }

        return true;
      },
      render: () => {
        let component: any;
        let popup: any;
        // Keep last non-null client rect to stabilize position during IME composition
        // Some IMEs (e.g., Chinese) may temporarily return null on space confirmation
        // which would cause Popper to position at (0,0). We cache the last rect instead.
        let lastClientRect: DOMRect | null = null;
        // Store latest props to avoid closure issues
        let latestProps: any = null;
        const parsePlacement = (inst: any): 'top' | 'bottom' => {
          const resolved =
            inst?.popperInstance?.state?.placement ??
            inst?.popper?.getAttribute?.('data-placement') ??
            inst?.state?.placement ??
            inst?.props?.placement ??
            'bottom-start';
          const base = String(resolved).split('-')[0];
          return base === 'top' ? 'top' : 'bottom';
        };

        return {
          onStart: (props: any) => {
            latestProps = props; // Store latest props
            component = new ReactRenderer(MentionList, {
              props: {
                ...props,
                placement: mentionPosition,
                query: props.query || '',
              },
              editor: props.editor,
            });

            popup = tippy('body', {
              getReferenceClientRect: () => {
                const rect = props?.clientRect?.();
                // Cache valid rect; fallback to the last valid one during composition
                if (rect) lastClientRect = rect as DOMRect;
                return (rect as DOMRect) ?? (lastClientRect as DOMRect);
              },
              appendTo: () => document.body,
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: 'manual',
              placement: mentionPosition,
              theme: 'custom',
              arrow: false,
              offset: [0, 8],
              onMount(instance) {
                const placement = parsePlacement(instance);
                component.updateProps({
                  ...latestProps,
                  placement,
                  query: latestProps?.query || '',
                });
              },
              onShown(instance) {
                const placement = parsePlacement(instance);
                setIsMentionListVisible(true);
                component.updateProps({
                  ...latestProps,
                  placement,
                  isMentionListVisible: true,
                  query: latestProps?.query || '',
                });
              },
              onHidden(instance) {
                const placement = parsePlacement(instance);
                setIsMentionListVisible(false);
                component.updateProps({
                  ...latestProps,
                  placement,
                  isMentionListVisible: false,
                  query: latestProps?.query || '',
                });
              },
              onDestroy() {
                setIsMentionListVisible(false);
                component.updateProps({
                  ...latestProps,
                  isMentionListVisible: false,
                  query: latestProps?.query || '',
                });
              },
            });

            // Store popup instance for manual control
            // Note: This is not accessible here, so we'll need to handle popup instance management differently
          },
          onUpdate(props: any) {
            latestProps = props; // Update latest props
            component.updateProps({ ...props, query: props.query || '' });
            // Update the reference rect while guarding against null during IME composition
            popup[0].setProps({
              getReferenceClientRect: () => {
                const rect = props?.clientRect?.();
                if (rect) lastClientRect = rect as DOMRect;
                return (rect as DOMRect) ?? (lastClientRect as DOMRect);
              },
            });
            // Read actual placement after Popper updates layout
            requestAnimationFrame(() => {
              try {
                const instance = popup?.[0];
                const placement = parsePlacement(instance);
                component.updateProps({ ...props, placement, query: props.query || '' });
              } catch {
                // noop
              }
            });
          },
          onExit() {
            popup[0].destroy();
            component.destroy();
          },
        };
      },
    },
  });
};
