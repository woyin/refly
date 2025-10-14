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
import Placeholder from '@tiptap/extension-placeholder';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import type { IContextItem } from '@refly/common-types';
import type { CanvasNodeType, ResourceType, ResourceMeta } from '@refly/openapi-schema';
import { mentionStyles } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/variable/mention-style';
import { useStore } from '@xyflow/react';
import { useShallow } from 'zustand/react/shallow';
import {
  nodeActionEmitter,
  createNodeEventName,
} from '@refly-packages/ai-workspace-common/events/nodeActions';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useGetProjectCanvasId } from '@refly-packages/ai-workspace-common/hooks/use-get-project-canvasId';
import { useListResources } from '@refly-packages/ai-workspace-common/queries/queries';
import { type MentionItem } from './mentionList';
import { createMentionExtension } from './mention-extension';

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

// Helper function to create context item from mention item
const createContextItem = (item: MentionItem): IContextItem => {
  return {
    entityId: item.entityId,
    title: item.name,
    type: (() => {
      if (item.source === 'stepRecord') {
        return 'skillResponse' as CanvasNodeType;
      } else if (item.source === 'resultRecord') {
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
        return 'resource' as CanvasNodeType;
      } else if (item.source === 'myUpload') {
        return 'resource' as CanvasNodeType;
      }

      return 'resource' as CanvasNodeType;
    })(),

    metadata: {
      nodeId: item.nodeId,
      source: item.source,
      variableType: item.variableType,
      ...item.metadata,
    },
  };
};

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
      const variableItems = workflowVariables.map((variable) => ({
        name: variable.name,
        description: variable.description || '',
        source: 'variables' as const,
        variableType: variable.variableType || 'string',
        variableId: variable.variableId || '',
        variableValue: variable.value,
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
            storageKey: resource.storageKey,
            rawFileKey: resource.rawFileKey,
            [`${resource.resourceType}Url`]: resource.downloadURL,
          },
        })) ?? [];

      return [...variableItems, ...stepRecordItems, ...resultRecordItems, ...myUploadItems];
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

    // Helper function to add item to context items
    const addToContextItems = useCallback(
      (contextItem: IContextItem) => {
        if (!setContextItems) return;

        const currentContextItems = contextItemsRef.current || [];
        const isAlreadyInContext = currentContextItems.some(
          (ctxItem) => ctxItem.entityId === contextItem.entityId,
        );

        if (!isAlreadyInContext) {
          setContextItems([...currentContextItems, contextItem]);
        }
      },
      [setContextItems],
    );

    // Helper function to insert mention into editor
    const insertMention = useCallback((editor: any, range: any, attrs: any) => {
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {
            type: 'mention',
            attrs,
          },
          {
            type: 'text',
            text: ' ',
          },
        ])
        .run();
    }, []);

    const handleCommand = useCallback(
      ({ editor, range, props }: { editor: any; range: any; props: MentionItem }) => {
        const item = props;

        // For step and result records, add to context instead of inserting text
        if (
          item.source === 'stepRecord' ||
          item.source === 'resultRecord' ||
          item.source === 'myUpload'
        ) {
          if (setContextItems && item.entityId) {
            const contextItem = createContextItem(item);
            addToContextItems(contextItem);

            const url =
              item.metadata?.imageUrl || item.metadata?.videoUrl || item.metadata?.audioUrl;

            insertMention(editor, range, {
              id: item.entityId || item.nodeId || item.name,
              label: item.name,
              source: item.source,
              variableType: item.variableType || item.source,
              url: url,
              resourceType: item.metadata?.resourceType,
              resourceMeta: item.metadata?.resourceMeta,
              entityId: item.entityId || item.nodeId,
            });
          }
        } else if (item.variableType === 'resource') {
          // For resource type variables, find the corresponding resource data and add to context
          if (item.variableValue?.length && item.variableValue[0]?.resource) {
            const resourceValue = item.variableValue[0].resource;
            const resource = resources.find((r) => r.resourceId === resourceValue.entityId);

            const contextItem: IContextItem = {
              entityId: resourceValue.entityId,
              title: resource?.title ?? resourceValue.name,
              type: 'resource' as CanvasNodeType,
              metadata: {
                source: 'myUpload',
                storageKey: resourceValue.storageKey,
                resourceType: resourceValue.fileType,
                resourceMeta: resource?.data,
                [`${resourceValue.fileType}Url`]: resource?.downloadURL,
              },
            };

            addToContextItems(contextItem);

            insertMention(editor, range, {
              id: resourceValue.entityId,
              label: resourceValue.name,
              source: 'myUpload',
              variableType: 'resource',
              url: resourceValue.storageKey,
              resourceType: resourceValue.fileType,
              resourceMeta: resource?.data,
              entityId: resourceValue.entityId,
            });
          }
        } else {
          // For regular variables (startNode and resourceLibrary), insert as normal mention
          // These will be converted to Handlebars format when sending
          insertMention(editor, range, {
            id: item.variableId || item.name,
            label: item.name,
            source: item.source,
            variableType: item.variableType || item.source,
            url: item.metadata?.imageUrl,
            resourceType: item.metadata?.resourceType,
            resourceMeta: item.metadata?.resourceMeta,
            entityId: item.variableId,
          });
        }
      },
      [addToContextItems, insertMention, resources],
    );

    // Create mention extension with custom suggestion
    const mentionExtension = useMemo(() => {
      return createMentionExtension({
        handleCommand,
        hasUserInteractedRef,
        allItemsRef,
        mentionPosition,
        setIsMentionListVisible,
      });
    }, [
      handleCommand,
      hasUserInteractedRef,
      allItemsRef,
      mentionPosition,
      setIsMentionListVisible,
    ]);

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
          const content = serializeDocToTokens(editor?.state?.doc);
          // Keep raw text in state for UX; content is already serialized with mentions
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

    // Serializer: convert current doc with mentions into @{...} tokens for state/query
    const serializeDocToTokens = useCallback((doc: any): string => {
      try {
        if (!doc) return '';
        const text = doc.textBetween(0, doc.content.size, '\n', (node: any) => {
          const nodeName = node?.type?.name ?? '';
          if (nodeName === 'mention') {
            const label = node?.attrs?.label ?? node?.attrs?.id ?? '';
            const id = node?.attrs?.id ?? '';
            const source = node?.attrs?.source ?? '';
            const type =
              source === 'variables'
                ? 'var'
                : source === 'stepRecord'
                  ? 'step'
                  : source === 'resultRecord' ||
                      source === 'myUpload' ||
                      source === 'resourceLibrary'
                    ? 'resource'
                    : 'var';
            const safeId = String(id ?? '').trim();
            const safeName = String(label ?? '').trim();
            return safeName ? `@{type=${type},id=${safeId || safeName},name=${safeName}}` : '';
          }
          if (nodeName === 'hardBreak') {
            return '\n';
          }
          return '';
        });
        return text ?? '';
      } catch {
        return '';
      }
    }, []);

    // Build tiptap JSON content from a string with @variableName format
    const buildNodesFromContent = useCallback(
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

        const findVarMetaByName = (name: string) => {
          // Priority 1: Look in allItems first (includes canvas-based items and workflow variables)
          const foundFromAll = (allItems || []).find((it: any) => it?.name === name);
          if (foundFromAll) {
            return {
              variableType: foundFromAll?.variableType ?? 'string',
              entityId: foundFromAll?.entityId ?? foundFromAll?.variableId ?? foundFromAll?.nodeId,
              source: foundFromAll?.source,
            };
          }

          // Priority 2: Look in variables prop (most reliable for startNode)
          const foundInVariables = (workflowVariables || []).find((v: any) => v?.name === name);
          if (foundInVariables) {
            return {
              variableType: foundInVariables?.variableType ?? 'string',
              entityId: foundInVariables?.variableId,
              source: 'variables',
            };
          }

          // Fallback: Default to variables with string type
          return {
            variableType: 'string',
            source: 'variables',
          };
        };

        const findMetaById = (id: string) => {
          if (!id) return null as any;
          const foundFromAll = (allItems || []).find((it: any) => {
            const vid = it?.variableId ?? '';
            const eid = it?.entityId ?? '';
            const nid = it?.nodeId ?? '';
            return vid === id || eid === id || nid === id;
          });
          if (foundFromAll) {
            return {
              variableType: foundFromAll?.variableType ?? 'string',
              source: foundFromAll?.source,
            };
          }
          return null as any;
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
            // Try new rich token: @{type=...,id=...,name=...}
            if (normalized[i + 1] === '{') {
              const closeIdx = normalized.indexOf('}', i + 2);
              if (closeIdx !== -1) {
                const inside = normalized.slice(i + 2, closeIdx);
                // Parse key=value pairs separated by comma, allow spaces
                const pairs = inside.split(',').map((s) => s.trim());
                const map: Record<string, string> = {};
                for (const p of pairs) {
                  const eq = p.indexOf('=');
                  if (eq > 0) {
                    const k = p.slice(0, eq).trim();
                    const v = p.slice(eq + 1).trim();
                    map[k] = v;
                  }
                }
                const tokenType = map.type || 'var';
                const tokenId = map.id || '';
                const tokenName = map.name || '';

                if (textBuffer) {
                  nodes.push({ type: 'text', text: textBuffer });
                  textBuffer = '';
                }

                // Map type to source and variableType
                let source = 'variables';
                let variableType = 'string';
                if (tokenType === 'var') {
                  source = 'variables';
                  const meta = findMetaById(tokenId) || findVarMetaByName(tokenName);
                  variableType = meta?.variableType ?? 'string';
                } else if (tokenType === 'step') {
                  source = 'stepRecord';
                  variableType = 'skillResponse';
                } else if (tokenType === 'resource') {
                  source = 'resultRecord';
                  const meta = findMetaById(tokenId) || findVarMetaByName(tokenName);
                  variableType = meta?.variableType ?? 'resource';
                }

                nodes.push({
                  type: 'mention',
                  attrs: {
                    id: tokenId || tokenName,
                    label: tokenName || tokenId,
                    variableType,
                    source,
                    entityId: tokenId || undefined,
                  },
                });
                i = closeIdx + 1;
                continue;
              }
            }

            // Fallback: legacy @name syntax
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
              const meta = findVarMetaByName(matchedName);
              nodes.push({
                type: 'mention',
                attrs: {
                  id: meta?.entityId || matchedName,
                  label: matchedName,
                  variableType: meta?.variableType ?? 'string',
                  source: meta?.source ?? 'variables',
                  entityId: meta?.entityId,
                },
              });
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
        const currentContent = serializeDocToTokens(editor?.state?.doc);
        // Update the query with the serialized content before sending
        setQuery(currentContent);
        // Call the original handleSendMessage
        handleSendMessage();
      } else {
        handleSendMessage();
      }
    }, [editor, setQuery, handleSendMessage, serializeDocToTokens]);

    // Update editor content when query changes externally
    useEffect(() => {
      if (!editor) return;
      if (internalUpdateRef.current) {
        // Skip applying content when the change originated from editor updates
        internalUpdateRef.current = false;
        return;
      }
      const currentText = serializeDocToTokens(editor?.state?.doc);
      const nextText = query ?? '';
      if (currentText !== nextText) {
        // Convert handlebars variables back to mention nodes for rendering
        const nodes = buildNodesFromContent(nextText);
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
          const prevSelection = editor.state?.selection?.anchor ?? null;
          internalUpdateRef.current = true;
          editor.commands.setContent(jsonDoc);
          if (prevSelection !== null) {
            const size = editor?.state?.doc?.content?.size ?? 0;
            const clamped = Math.min(prevSelection, size);
            editor.commands.setTextSelection(clamped);
          }
        } else {
          const prevSelection = editor.state?.selection?.anchor ?? null;
          internalUpdateRef.current = true;
          editor.commands.setContent(nextText);
          if (prevSelection !== null) {
            const size = editor?.state?.doc?.content?.size ?? 0;
            const clamped = Math.min(prevSelection, size);
            editor.commands.setTextSelection(clamped);
          }
        }
      }
    }, [query, editor, buildNodesFromContent, serializeDocToTokens]);

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
        const nodes = buildNodesFromContent(query);
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
          const prevSelection = editor.state?.selection?.anchor ?? null;
          internalUpdateRef.current = true;
          editor.commands.setContent(jsonDoc);
          if (prevSelection !== null) {
            const size = editor?.state?.doc?.content?.size ?? 0;
            const clamped = Math.min(prevSelection, size);
            editor.commands.setTextSelection(clamped);
          }
        }
      }
    }, [canvasId, editor, query, buildNodesFromContent, allItems]);

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
