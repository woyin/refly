import {
  memo,
  useCallback,
  forwardRef,
  useEffect,
  useState,
  useMemo,
  useRef,
  useImperativeHandle,
} from 'react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchStoreShallow } from '@refly/stores';
import { cn } from '@refly/utils/cn';
import { useUserStoreShallow } from '@refly/stores';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import type { IContextItem } from '@refly/common-types';
import type { CanvasNodeType, ResourceType, ResourceMeta } from '@refly/openapi-schema';
import { getVariableIcon } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/variable/getVariableIcon';
import { mentionStyles } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/variable/mention-style';
import { createRoot } from 'react-dom/client';
import { useStore } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import {
  nodeActionEmitter,
  createNodeEventName,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useListResources } from '@refly-packages/ai-workspace-common/queries/queries';
import { type MentionItem, MentionList } from './mentionList';

interface RichChatInputProps {
  readonly: boolean;
  query: string;
  setQuery: (text: string) => void;
  placeholder?: string;
  inputClassName?: string;
  maxRows?: number;
  minRows?: number;
  handleSendMessage: () => void;
  contextItems?: IContextItem[];

  mentionPosition?: 'top-start' | 'bottom-start';

  setContextItems?: (items: IContextItem[]) => void;

  onUploadImage?: (file: File) => Promise<void>;
  onUploadMultipleImages?: (files: File[]) => Promise<void>;
  onFocus?: () => void;
}

export interface RichChatInputRef {
  focus: () => void;
}

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
    };
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.className = 'mention';

      // Create icon container
      const iconContainer = document.createElement('span');
      iconContainer.className = 'mention-icon';

      // Create text container
      const textContainer = document.createElement('span');
      textContainer.className = 'mention-text';
      textContainer.textContent = node.attrs.label || node.attrs.id;

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

const RichChatInputComponent = forwardRef<RichChatInputRef, RichChatInputProps>(
  (
    {
      readonly,
      query,
      setQuery,
      handleSendMessage,
      onUploadImage,
      onUploadMultipleImages,
      onFocus,
      contextItems = [],
      setContextItems,
      placeholder,
      mentionPosition = 'bottom-start',
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const [isDragging, setIsDragging] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const isLogin = useUserStoreShallow((state) => state.isLogin);
    const { nodes } = useCanvasData();
    const { canvasId, workflow } = useCanvasContext();
    const { projectId } = useGetProjectCanvasId();
    const { data: resourcesData } = useListResources({
      query: {
        canvasId,
        projectId,
      },
    });
    const resources = resourcesData?.data ?? [];
    const searchStore = useSearchStoreShallow((state) => ({
      setIsSearchOpen: state.setIsSearchOpen,
    }));

    const [isMentionListVisible, setIsMentionListVisible] = useState(false);

    const { workflowVariables = [] } = workflow || {};

    // Gate mention suggestions until explicit user interaction
    // Prevent auto-popup on initial load when content already contains '@xx'
    const hasUserInteractedRef = useRef(false);
    const popupInstanceRef = useRef<any>(null);

    // Get all available items including canvas nodes with fallback data
    const allItems: MentionItem[] = useMemo(() => {
      const startNodeItems = workflowVariables.map((variable) => ({
        name: variable.name,
        description: variable.description || '',
        source: 'variables' as const,
        variableType: variable.variableType || 'string',
        variableId: variable.variableId || '',
      }));

      // Get skillResponse nodes for step records
      const stepRecordItems: MentionItem[] =
        nodes
          ?.filter((node) => node.type === 'skillResponse')
          ?.map((node) => ({
            name: node.data?.title ?? t('canvas.richChatInput.untitledStep'),
            description: t('canvas.richChatInput.stepRecord'),
            source: 'stepRecord' as const,
            variableType: node.type, // Use actual node type
            entityId: node.data?.entityId || '',
            nodeId: node.id,
          })) ?? [];

      // Get result record nodes - same logic as ResultList component
      const resultRecordItems: MentionItem[] =
        nodes
          ?.filter(
            (node) =>
              ['document', 'codeArtifact', 'website', 'video', 'audio'].includes(node.type) ||
              (node.type === 'image' && !!node.data?.metadata?.resultId),
          )
          ?.map((node) => ({
            name: node.data?.title ?? t('canvas.richChatInput.untitledResult'),
            description: t('canvas.richChatInput.resultRecord'),
            source: 'resultRecord' as const,
            variableType: node.type, // Use actual node type
            entityId: node.data?.entityId,
            nodeId: node.id,
            metadata: {
              imageUrl: node.data?.metadata?.imageUrl,
              resourceType: node.data?.metadata?.resourceType as ResourceType | undefined,
              resourceMeta: node.data?.metadata?.resourceMeta as ResourceMeta | undefined,
            },
          })) ?? [];

      // Get my upload items from API resources data
      const myUploadItems: MentionItem[] =
        resources?.map((resource) => ({
          name: resource.title ?? t('canvas.richChatInput.untitledUpload'),
          description: t('canvas.richChatInput.myUpload'),
          source: 'myUpload' as const,
          variableType: resource.resourceType || 'resource',
          entityId: resource.resourceId,
          nodeId: resource.resourceId,
          metadata: {
            imageUrl: resource.data?.url as string | undefined,
            resourceType: resource.resourceType as ResourceType | undefined,
            resourceMeta: resource.data as ResourceMeta | undefined,
          },
        })) ?? [];

      return [...startNodeItems, ...stepRecordItems, ...resultRecordItems, ...myUploadItems];
    }, [workflowVariables, nodes, resources]);

    // Keep latest items in a ref so Mention suggestion always sees fresh data
    const allItemsRef = useRef<MentionItem[]>(allItems);

    useEffect(() => {
      allItemsRef.current = allItems;
    }, [allItems]);

    // Use ref to store latest contextItems to avoid performance issues
    const contextItemsRef = useRef(contextItems);

    // Update ref when contextItems changes
    useEffect(() => {
      contextItemsRef.current = contextItems;
    }, [contextItems]);

    // Use ref to track previous canvas data to avoid infinite loops
    const prevCanvasDataRef = useRef({ canvasId: '', allItemsLength: 0 });

    const handleCommand = useCallback(
      ({ editor, range, props }: { editor: any; range: any; props: any }) => {
        const item = props;

        // For step and result records, add to context instead of inserting text
        if (
          item.source === 'stepRecord' ||
          item.source === 'resultRecord' ||
          item.source === 'myUpload'
        ) {
          if (setContextItems && item.entityId) {
            // Create context item with correct type mapping
            const contextItem: IContextItem = {
              entityId: item.entityId,
              title: item.name,
              type: (() => {
                if (item.source === 'stepRecord') {
                  // For step records, use skillResponse type
                  return 'skillResponse' as CanvasNodeType;
                } else if (item.source === 'resultRecord' || item.source === 'myUpload') {
                  // For result records and uploads, use the actual node type
                  // Validate that variableType is a valid CanvasNodeType
                  const validCanvasNodeTypes: CanvasNodeType[] = [
                    'document',
                    'codeArtifact',
                    'website',
                    'resource',
                    'skill',
                    'tool',
                    'skillResponse',
                    'toolResponse',
                    'memo',
                    'group',
                    'image',
                    'video',
                    'audio',
                    'mediaSkill',
                    'mediaSkillResponse',
                    'start',
                  ];

                  if (validCanvasNodeTypes.includes(item.variableType as CanvasNodeType)) {
                    return item.variableType as CanvasNodeType;
                  }

                  // Fallback to resource context item
                  return 'resource' as CanvasNodeType;
                }
                // Fallback for unexpected sources
                console.warn(`Unexpected source "${item.source}", falling back to "document"`, {
                  item,
                });
                return 'resource' as CanvasNodeType;
              })(),

              metadata: {
                nodeId: item.nodeId,
                source: item.source,
                variableType: item.variableType,
                ...item.metadata,
              },
            };

            // Add to context items using ref to get latest value
            if (setContextItems) {
              // Check if already in context using ref
              const currentContextItems = contextItemsRef.current || [];
              const isAlreadyInContext = currentContextItems.some(
                (ctxItem) => ctxItem.entityId === item.entityId,
              );

              if (!isAlreadyInContext) {
                setContextItems([...currentContextItems, contextItem]);
              }
            }

            const url =
              item.metadata?.imageUrl || item.metadata?.videoUrl || item.metadata?.audioUrl;

            // Insert a placeholder text to show the selection
            editor
              .chain()
              .focus()
              .insertContentAt(range, [
                {
                  type: 'mention',
                  attrs: {
                    id: item.name,
                    label: item.name, // Don't include @ in label
                    source: item.source, // Store source for later processing
                    variableType: item.variableType || item.source,
                    url: url,
                    resourceType: item.metadata?.resourceType,
                    resourceMeta: item.metadata?.resourceMeta,
                  },
                },
                {
                  type: 'text',
                  text: ' ',
                },
              ])
              .run();
          }
        } else {
          // For regular variables (startNode and resourceLibrary), insert as normal mention
          // These will be converted to Handlebars format when sending
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: 'mention',
                attrs: {
                  id: item.name,
                  label: item.name, // Don't include @ in label
                  source: item.source, // Store source for later processing
                  variableType: item.variableType || item.source,
                  url: item.metadata?.imageUrl,
                  resourceType: item.metadata?.resourceType,
                  resourceMeta: item.metadata?.resourceMeta,
                },
              },
              {
                type: 'text',
                text: ' ',
              },
            ])
            .run();
        }
      },
      [setContextItems],
    );

    // Create mention extension with custom suggestion
    const mentionExtension = useMemo(() => {
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
                popupInstanceRef.current = popup[0];
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
    }, [handleCommand, isMentionListVisible, mentionPosition]);

    // Create Tiptap editor
    const internalUpdateRef = useRef(false);

    // Keyboard shortcut: Alt+Cmd+V (Mac) or Alt+Ctrl+V (Windows) to trigger variable extraction
    const selectedSkillNodeId = useStore(
      useShallow((state: any) => {
        const nodes = state.nodes || [];
        const selected = nodes.find((n: any) => n?.selected && n?.type === 'skill');
        return selected?.id || '';
      }),
    );

    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        const isV = (e.key || '').toLowerCase() === 'v';
        const isAlt = !!e.altKey;
        const isCmd = !!e.metaKey; // Mac
        const isCtrl = !!e.ctrlKey;

        if (isV && isAlt && (isCmd || isCtrl)) {
          if (selectedSkillNodeId) {
            e.preventDefault();
            nodeActionEmitter.emit(createNodeEventName(selectedSkillNodeId, 'extractVariables'));
          }
        }
      };

      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [selectedSkillNodeId]);

    // Create placeholder extension with dynamic placeholder
    const placeholderExtension = useMemo(() => {
      return Placeholder.configure({
        placeholder: placeholder || t('canvas.richChatInput.defaultPlaceholder'),
      });
    }, [placeholder, t]);

    // Create all extensions array
    const extensions = useMemo(
      () => [StarterKit, mentionExtension, placeholderExtension],
      [mentionExtension, placeholderExtension],
    );

    const editor = useEditor(
      {
        extensions,
        content: query,
        editable: !readonly,
        onUpdate: ({ editor }) => {
          const content = editor.getText();
          // Keep raw text in state for UX; convert to handlebars only on send
          internalUpdateRef.current = true;
          setQuery(content);
        },
        onFocus: () => {
          handleFocus();
        },
        onBlur: () => {
          setIsFocused(false);
        },
        editorProps: {
          attributes: {
            class: cn('prose prose-sm max-w-none focus:outline-none'),
          },
        },
      },
      [placeholder],
    );

    // Expose focus method through ref
    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          if (editor && !readonly) {
            editor.commands.focus();
          }
        },
      }),
      [editor, readonly],
    );

    // Function to convert mentions to Handlebars format
    const convertMentionsToHandlebars = useCallback(
      (content: string) => {
        if (!editor) return content;

        // Build the content by traversing the doc and handling nodes properly
        let processedContent = '';
        let paragraphIndex = 0;

        editor.state.doc.descendants((node) => {
          const nodeName = node?.type?.name ?? '';

          // Insert a newline between paragraphs to preserve line breaks created by Enter
          if (nodeName === 'paragraph') {
            if (paragraphIndex > 0) {
              processedContent += '\n';
            }
            paragraphIndex += 1;
            return; // Children will be handled in subsequent calls
          }

          // Map hardBreak nodes to '\n' to preserve single line breaks
          if (nodeName === 'hardBreak') {
            processedContent += '\n';
            return;
          }

          if (nodeName === 'mention') {
            const mentionName = node?.attrs?.label ?? node?.attrs?.id;
            const source = node?.attrs?.source;

            // Only convert startNode and resourceLibrary variables to @variableName format
            if (mentionName && (source === 'variables' || source === 'resourceLibrary')) {
              processedContent += `@${mentionName} `;
            } else if (mentionName) {
              // For other types (stepRecord, resultRecord), just add the name without @
              processedContent += mentionName;
            }
            return;
          }

          if (nodeName === 'text') {
            processedContent += node.text ?? '';
            return;
          }
        });

        return processedContent;
      },
      [editor],
    );

    // Build tiptap JSON content from a string with @variableName format
    const buildContentFromHandlebars = useCallback(
      (content: string) => {
        const nodes: any[] = [];
        if (!content) return nodes;

        // Normalize input to avoid generating unexpected extra blank lines
        // - Unify EOL to \n
        // - Remove trailing whitespace before newlines
        // - Collapse 3+ consecutive newlines to exactly 2 (represents a single empty line)
        // - Trim leading and trailing newlines
        const normalizeContent = (input: string): string => {
          let s = input?.replace(/\r\n?/g, '\n') ?? '';
          s = s.replace(/[ \t]+\n/g, '\n');
          s = s.replace(/\n{3,}/g, '\n\n');
          s = s.replace(/^\n+/, '').replace(/\n+$/, '');
          return s;
        };

        const normalized = normalizeContent(content);

        const findVarMeta = (name: string) => {
          // Priority 1: Look in allItems first (includes canvas-based items and workflow variables)
          const foundFromAll = (allItems || []).find((it: any) => it?.name === name);
          if (foundFromAll) {
            return {
              variableType: foundFromAll?.variableType ?? 'string',
            };
          }

          // Priority 2: Look in variables prop (most reliable for startNode)
          const foundInVariables = (workflowVariables || []).find((v: any) => v?.name === name);
          if (foundInVariables) {
            return {
              variableType: foundInVariables?.variableType ?? 'string',
            };
          }

          // Fallback: Default to variables with string type
          return {
            variableType: 'string',
          };
        };

        // Prepare name list sorted by length desc to prefer the longest match
        const allNames = Array.from(
          new Set((allItems || []).map((it: any) => it?.name).filter(Boolean)),
        ) as string[];
        allNames.sort((a, b) => (b?.length ?? 0) - (a?.length ?? 0));

        let i = 0;
        let textBuffer = '';
        while (i < normalized.length) {
          const ch = normalized[i];

          // Preserve newlines by mapping to hardBreak nodes
          if (ch === '\n') {
            if (textBuffer) {
              nodes.push({ type: 'text', text: textBuffer });
              textBuffer = '';
            }
            nodes.push({ type: 'hardBreak' });
            i += 1;
            continue;
          }

          if (ch === '@') {
            // Try to match any known name right after '@'
            let matchedName: string | null = null;
            for (const name of allNames) {
              const candidate = normalized.slice(i + 1, i + 1 + name.length);
              if (candidate === name) {
                const nextChar = normalized[i + 1 + name.length] ?? '';
                if (nextChar === ' ' || nextChar === '\n' || nextChar === '' || nextChar === '\t') {
                  matchedName = name;
                  break;
                }
              }
            }

            if (matchedName) {
              if (textBuffer) {
                nodes.push({ type: 'text', text: textBuffer });
                textBuffer = '';
              }
              const meta = findVarMeta(matchedName);
              nodes.push({
                type: 'mention',
                attrs: {
                  id: matchedName,
                  label: matchedName,
                  variableType: meta.variableType,
                },
              });
              // Consume '@' + name but do NOT consume trailing whitespace to preserve original spacing
              i = i + 1 + matchedName.length;
              continue;
            }
          }
          // Default: accumulate as plain text
          textBuffer += ch;
          i += 1;
        }

        if (textBuffer) {
          nodes.push({ type: 'text', text: textBuffer });
        }

        return nodes;
      },
      [workflowVariables, allItems],
    );

    // Enhanced handleSendMessage that converts mentions to Handlebars
    const handleSendMessageWithHandlebars = useCallback(() => {
      if (editor) {
        const currentContent = editor.getText();
        const processedContent = convertMentionsToHandlebars(currentContent);
        // Update the query with the processed content before sending
        setQuery(processedContent);
        // Call the original handleSendMessage
        handleSendMessage();
      } else {
        handleSendMessage();
      }
    }, [editor, convertMentionsToHandlebars, setQuery, handleSendMessage]);

    // Update editor content when query changes externally
    useEffect(() => {
      if (!editor) return;
      if (internalUpdateRef.current) {
        // Skip applying content when the change originated from editor updates
        internalUpdateRef.current = false;
        return;
      }
      const currentText = editor.getText();
      const nextText = query ?? '';
      if (currentText !== nextText) {
        // Convert handlebars variables back to mention nodes for rendering
        const nodes = buildContentFromHandlebars(nextText);
        if (nodes.length > 0) {
          const jsonDoc = {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: nodes,
              },
            ],
          } as any;
          internalUpdateRef.current = true;
          editor.commands.setContent(jsonDoc);
        } else {
          internalUpdateRef.current = true;
          editor.commands.setContent(nextText);
        }
      }
    }, [query, editor, buildContentFromHandlebars]);

    // Additional effect to re-render content when canvas data becomes available
    useEffect(() => {
      if (!editor || !query) return;

      // Check if canvas data has actually changed to avoid infinite loops
      const currentCanvasData = {
        canvasId: canvasId || '',
        allItemsLength: allItems?.length || 0,
      };

      const prevCanvasData = prevCanvasDataRef.current;
      const hasCanvasDataChanged =
        currentCanvasData.canvasId !== prevCanvasData.canvasId ||
        currentCanvasData.allItemsLength !== prevCanvasData.allItemsLength;

      if (!hasCanvasDataChanged) return;

      // Update the ref with current data
      prevCanvasDataRef.current = currentCanvasData;

      // Check if we have the necessary data to render mentions
      const hasCanvasData = allItems && allItems.length > 0;

      if (hasCanvasData) {
        // Try to re-render with current data
        const nodes = buildContentFromHandlebars(query);
        if (nodes.length > 0) {
          const jsonDoc = {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: nodes,
              },
            ],
          } as any;
          internalUpdateRef.current = true;
          editor.commands.setContent(jsonDoc);
        }
      }
    }, [canvasId, editor, query, buildContentFromHandlebars, allItems]);

    const isCursorAfterAtToken = useCallback((state: any): boolean => {
      try {
        const cursorPos = state?.selection?.from ?? 0;
        const lookback = 128;
        const fromPos = Math.max(0, cursorPos - lookback);
        const textBefore = state.doc.textBetween(fromPos, cursorPos) || '';
        const atIndex = textBefore.lastIndexOf('@');

        if (atIndex < 0) return false;

        const token = textBefore.slice(atIndex);
        const charBeforeAt = textBefore[atIndex - 1] ?? '';
        const isBoundaryValid = atIndex === 0 || /\s/.test(charBeforeAt);

        if (!isBoundaryValid) return false;

        // Check if token is contiguous (no spaces) and starts with @
        return /^@[^\s@]*$/.test(token);
      } catch {
        return false;
      }
    }, []);

    // Try to show mention popup if cursor is after @ token
    const tryShowMentionPopup = useCallback(() => {
      try {
        if (!editor || !popupInstanceRef.current || isMentionListVisible) return;

        const state = editor.state;
        if (isCursorAfterAtToken(state)) {
          popupInstanceRef.current.show();
        }
      } catch {
        // noop
      }
    }, [editor, isMentionListVisible, isCursorAfterAtToken]);

    const handlePopupShow = useCallback(() => {
      hasUserInteractedRef.current = true;
      tryShowMentionPopup();
    }, [tryShowMentionPopup, hasUserInteractedRef]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (readonly) {
          e.preventDefault();
          return;
        }

        handlePopupShow();

        // Handle Ctrl+K or Cmd+K to open search
        if (e.keyCode === 75 && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          searchStore.setIsSearchOpen(true);
        }

        // Handle the Enter key
        if (e.keyCode === 13) {
          // Shift + Enter creates a new line (let default behavior handle it)
          if (e.shiftKey) {
            return;
          }

          // Ctrl/Meta + Enter should always send the message
          if ((e.ctrlKey || e.metaKey) && (query?.trim() || !isLogin)) {
            e.preventDefault();
            handleSendMessageWithHandlebars();
            return;
          }

          // For regular Enter key, send message if not in mention suggestion
          if (!e.shiftKey && (query?.trim() || !isLogin)) {
            e.preventDefault();
            handleSendMessageWithHandlebars();
          }
        }
      },
      [
        query,
        readonly,
        handleSendMessageWithHandlebars,
        searchStore,
        isLogin,
        isMentionListVisible,
        handlePopupShow,
      ],
    );

    // Handle focus event and propagate it upward
    const handleFocus = useCallback(() => {
      if (readonly) return;
      setIsFocused(true);
      handlePopupShow();

      if (onFocus) {
        onFocus();
      }
    }, [onFocus, readonly, setIsFocused, handlePopupShow]);

    const handlePaste = useCallback(
      async (e: React.ClipboardEvent) => {
        if (readonly || (!onUploadImage && !onUploadMultipleImages)) {
          return;
        }

        const items = e.clipboardData?.items;

        if (!items?.length) {
          return;
        }

        const imageFiles: File[] = [];

        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              imageFiles.push(file);
            }
          }
        }

        if (imageFiles.length > 0) {
          e.preventDefault();
          if (imageFiles.length === 1 && onUploadImage) {
            await onUploadImage(imageFiles[0]);
          } else if (onUploadMultipleImages && imageFiles.length > 0) {
            await onUploadMultipleImages(imageFiles);
          }
        }
      },
      [onUploadImage, onUploadMultipleImages, readonly],
    );

    return (
      <>
        <style>{mentionStyles}</style>
        <div
          ref={ref as any}
          className={cn(
            'w-full h-full flex flex-col flex-grow overflow-y-auto overflow-x-hidden relative',
            isDragging && 'ring-2 ring-green-500 ring-opacity-50 rounded-lg',
            readonly && 'opacity-70 cursor-not-allowed',
            isFocused ? 'nodrag nopan nowheel cursor-text' : '!cursor-pointer',
          )}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!readonly) setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!readonly) setIsDragging(false);
          }}
          onDrop={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (readonly) return;

            setIsDragging(false);

            if (!onUploadImage && !onUploadMultipleImages) return;

            const files = Array.from(e.dataTransfer.files);
            const imageFiles = files.filter((file) => file.type.startsWith('image/'));

            if (imageFiles.length > 0) {
              try {
                if (imageFiles.length === 1 && onUploadImage) {
                  await onUploadImage(imageFiles[0]);
                } else if (onUploadMultipleImages) {
                  await onUploadMultipleImages(imageFiles);
                }
              } catch (error) {
                console.error('Failed to upload images:', error);
              }
            }
          }}
        >
          {isDragging && !readonly && (
            <div className="absolute inset-0 bg-green-50/50 flex items-center justify-center pointer-events-none z-10 rounded-lg border-2 border-green-500/30">
              <div className="text-green-600 text-sm font-medium">{t('common.dropImageHere')}</div>
            </div>
          )}

          <div className="flex-1 min-h-0" onKeyDown={handleKeyDown} onPaste={handlePaste}>
            {editor ? (
              <EditorContent
                editor={editor}
                data-cy="rich-chat-input"
                data-placeholder={placeholder || t('canvas.richChatInput.defaultPlaceholder')}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                {t('canvas.richChatInput.loadingEditor')}
              </div>
            )}
          </div>
        </div>
      </>
    );
  },
);

RichChatInputComponent.displayName = 'RichChatInputComponent';

export const RichChatInput = memo(RichChatInputComponent) as typeof RichChatInputComponent;

RichChatInput.displayName = 'RichChatInput';
