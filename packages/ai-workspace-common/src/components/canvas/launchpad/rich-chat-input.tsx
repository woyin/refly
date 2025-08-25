import { memo, useCallback, forwardRef, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchStoreShallow } from '@refly/stores';
import type { WorkflowVariable } from '@refly/openapi-schema';
import { cn } from '@refly/utils/cn';
import { useUserStoreShallow } from '@refly/stores';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import type { IContextItem } from '@refly/common-types';

// Add custom styles for the editor and mention
const editorStyles = `
  .ProseMirror {
    outline: none;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    color: inherit;
    padding: 0;
    margin: 0;
    resize: none;
    min-height: 2.5rem;
    max-height: 12rem;
    overflow-y: auto;
  }
  
  .ProseMirror p {
    margin: 0;
  }
  
  .ProseMirror p.is-editor-empty:first-child::before {
    color: #adb5bd;
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }
  
  .mention {
    background-color: #e3f2fd;
    border-radius: 4px;
    padding: 2px 4px;
    color: #1976d2;
    font-weight: 500;
    text-decoration: none;
  }
  
  .mention:hover {
    background-color: #bbdefb;
  }

  /* Custom tippy styles to override default black border */
  .tippy-box {
    background-color: transparent !important;
    border: none !important;
    box-shadow: none !important;
  }
  
  .tippy-arrow {
    display: none !important;
  }
  
  .tippy-content {
    padding: 0 !important;
    background: transparent !important;
  }
`;

interface RichChatInputProps {
  readonly: boolean;
  query: string;
  setQuery: (text: string) => void;
  variables?: WorkflowVariable[];
  selectedSkillName?: string | null;
  placeholder?: string;
  inputClassName?: string;
  maxRows?: number;
  minRows?: number;
  handleSendMessage: () => void;
  contextItems?: IContextItem[];
  setContextItems?: (items: IContextItem[]) => void;

  onUploadImage?: (file: File) => Promise<void>;
  onUploadMultipleImages?: (files: File[]) => Promise<void>;
  onFocus?: () => void;
}

// Custom mention suggestion component with improved UI design
const MentionList = ({ items, command }: { items: any[]; command: any }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [resourceLibraryType, setResourceLibraryType] = useState<
    'uploads' | 'stepRecord' | 'resultRecord'
  >('uploads');
  const { nodes } = useCanvasData();

  // Group items by source and create canvas-based items
  const groupedItems = useMemo(() => {
    const startNodeItems = items.filter((item) => item.source === 'startNode');
    const resourceLibraryItems = items.filter((item) => item.source === 'resourceLibrary');

    // Get skillResponse nodes for step records
    const stepRecordItems =
      nodes
        ?.filter((node) => node.type === 'skillResponse')
        ?.map((node) => ({
          name: node.data?.title ?? '未命名步骤',
          description: '步骤记录',
          source: 'stepRecord' as const,
          variableType: 'step' as const,
          entityId: node.data?.entityId,
          nodeId: node.id,
        })) ?? [];

    // Get non-skill nodes for result records
    const resultRecordItems =
      nodes
        ?.filter((node) => node.type !== 'skill' && node.type !== 'skillResponse')
        ?.map((node) => ({
          name: node.data?.title ?? '未命名结果',
          description: '结果记录',
          source: 'resultRecord' as const,
          variableType: 'result' as const,
          entityId: node.data?.entityId,
          nodeId: node.id,
        })) ?? [];

    return {
      startNode: startNodeItems,
      resourceLibrary: resourceLibraryItems,
      stepRecord: stepRecordItems,
      resultRecord: resultRecordItems,
    };
  }, [items, nodes]);

  const selectItem = (item: any) => {
    command(item);
  };

  const upHandler = () => {
    const totalItems = items.length;
    setSelectedIndex((selectedIndex + totalItems - 1) % totalItems);
  };

  const downHandler = () => {
    const totalItems = items.length;
    setSelectedIndex((selectedIndex + 1) % totalItems);
  };

  const enterHandler = () => {
    const item = items[selectedIndex];
    if (item) {
      selectItem(item);
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }

      return false;
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedIndex, items]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className="bg-white rounded-xl shadow-lg border border-refly-Card-Border max-h-64 overflow-hidden min-w-96"
      onMouseLeave={() => {
        setHoveredCategory(null);
      }}
    >
      <div className="flex">
        {/* First level menu - Categories */}
        <div className="w-36 border-r border-gray-100">
          {/* Start Node Category */}
          {groupedItems.startNode.length > 0 && (
            <div
              className={`px-4 py-3 cursor-pointer border-b border-gray-50 transition-colors ${
                hoveredCategory === 'startNode'
                  ? 'bg-blue-50 border-l-2 border-l-blue-500'
                  : 'hover:bg-gray-50'
              }`}
              onMouseEnter={() => setHoveredCategory('startNode')}
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-600 text-sm">@</span>
                <span className="text-sm font-medium text-gray-700">开始节点</span>
                <svg
                  className="w-3 h-3 text-gray-400 ml-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          )}

          {/* Resource Library Category */}
          {(groupedItems.resourceLibrary.length > 0 ||
            groupedItems.stepRecord.length > 0 ||
            groupedItems.resultRecord.length > 0) && (
            <div
              className={`px-4 py-3 cursor-pointer transition-colors ${
                hoveredCategory === 'resourceLibrary'
                  ? 'bg-blue-50 border-l-2 border-l-blue-500'
                  : 'hover:bg-gray-50'
              }`}
              onMouseEnter={() => {
                setHoveredCategory('resourceLibrary');
                // Reset to uploads when hovering resource library
                setResourceLibraryType('uploads');
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-600 text-sm">{'{'}</span>
                <span className="text-sm font-medium text-gray-700">资源库</span>
                <svg
                  className="w-3 h-3 text-gray-400 ml-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Second level menu - Variables */}
        <div className="flex-1">
          {hoveredCategory === 'startNode' && groupedItems.startNode?.length > 0 && (
            <div className="p-2 max-h-56 overflow-y-auto">
              {groupedItems.startNode.map((item) => (
                <div
                  key={item.name}
                  className="p-1.5 cursor-pointer hover:bg-refly-fill-hover transition-colors rounded-md border-6px"
                  onClick={() => selectItem(item)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-green-500 text-xl pl-1.5">🚀</span>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {item.name}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 font-mono flex-shrink-0">T</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hoveredCategory === 'resourceLibrary' && (
            <>
              {/* Switch button for resource library types */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                  <button
                    type="button"
                    className={`flex-1 px-3 py-1 text-xs rounded-md transition-colors border-none${
                      resourceLibraryType === 'uploads'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    onClick={() => setResourceLibraryType('uploads')}
                  >
                    我的上传
                  </button>
                  <button
                    type="button"
                    className={`flex-1 px-3 py-1 text-xs rounded-md transition-colors border-none${
                      resourceLibraryType === 'stepRecord'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    onClick={() => setResourceLibraryType('stepRecord')}
                  >
                    步骤记录
                  </button>
                  <button
                    type="button"
                    className={`flex-1 px-3 py-1 text-xs rounded-md transition-colors border-none${
                      resourceLibraryType === 'resultRecord'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    onClick={() => setResourceLibraryType('resultRecord')}
                  >
                    结果记录
                  </button>
                </div>
              </div>

              {/* Content based on selected type */}
              <div className="py-2  px-2 max-h-56 overflow-y-auto">
                {resourceLibraryType === 'uploads' &&
                  groupedItems.resourceLibrary?.length > 0 &&
                  groupedItems.resourceLibrary.map((item) => (
                    <div
                      key={item.name}
                      className="p-1.5 cursor-pointer hover:bg-refly-fill-hover transition-colors rounded-md border-6px"
                      onClick={() => selectItem(item)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-green-500 text-xl pl-1.5">📁</span>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {item.name}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                {resourceLibraryType === 'stepRecord' &&
                  groupedItems.stepRecord?.length > 0 &&
                  groupedItems.stepRecord.map((item) => (
                    <div
                      key={item.name}
                      className="px-4 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => selectItem(item)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-green-500 text-xs">📝</span>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {item.name}
                          </span>
                          {item.description && (
                            <span className="text-xs text-gray-500 truncate">
                              {item.description}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 font-mono flex-shrink-0">S</span>
                      </div>
                    </div>
                  ))}

                {resourceLibraryType === 'resultRecord' &&
                  groupedItems.resultRecord?.length > 0 &&
                  groupedItems.resultRecord.map((item) => (
                    <div
                      key={item.name}
                      className="px-4 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => selectItem(item)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-green-500 text-xs">📊</span>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {item.name}
                          </span>
                          {item.description && (
                            <span className="text-xs text-gray-500 truncate">
                              {item.description}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 font-mono flex-shrink-0">R</span>
                      </div>
                    </div>
                  ))}

                {/* Show empty state when no items in selected type */}
                {((resourceLibraryType === 'uploads' &&
                  groupedItems.resourceLibrary?.length === 0) ||
                  (resourceLibraryType === 'stepRecord' && groupedItems.stepRecord?.length === 0) ||
                  (resourceLibraryType === 'resultRecord' &&
                    groupedItems.resultRecord?.length === 0)) && (
                  <div className="px-4 py-8 text-center text-gray-500 text-sm">
                    {resourceLibraryType === 'uploads' && '暂无上传文件'}
                    {resourceLibraryType === 'stepRecord' && '暂无步骤记录'}
                    {resourceLibraryType === 'resultRecord' && '暂无结果记录'}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Show default view when no category is hovered */}
          {!hoveredCategory && (
            <div className="p-8 text-center text-gray-500 text-sm">悬停左侧分类查看变量</div>
          )}
        </div>
      </div>
    </div>
  );
};

const RichChatInputComponent = forwardRef<HTMLDivElement, RichChatInputProps>(
  (
    {
      readonly,
      query,
      setQuery,
      variables = [],
      inputClassName,
      handleSendMessage,
      onUploadImage,
      onUploadMultipleImages,
      onFocus,
      contextItems = [],
      setContextItems,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const [isDragging, setIsDragging] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const isLogin = useUserStoreShallow((state) => state.isLogin);
    const { nodes } = useCanvasData();
    console.log('nodes', nodes);
    const searchStore = useSearchStoreShallow((state) => ({
      setIsSearchOpen: state.setIsSearchOpen,
    }));

    // Get all available items including canvas nodes with fallback data
    const allItems = useMemo(() => {
      // Default variables if none provided
      const defaultVariables = [
        {
          name: 'userName',
          value: ['张三'],
          description: '用户姓名',
          source: 'startNode' as const,
          variableType: 'string' as const,
        },
        {
          name: 'projectName',
          value: ['AI智能助手项目'],
          description: '当前项目名称',
          source: 'startNode' as const,
          variableType: 'string' as const,
        },
        {
          name: 'knowledgeBase',
          value: ['research-papers-2024'],
          description: '研究论文知识库',
          source: 'resourceLibrary' as const,
          variableType: 'resource' as const,
        },
        {
          name: 'documentTemplate',
          value: ['tech-report-template'],
          description: '技术报告模板',
          source: 'resourceLibrary' as const,
          variableType: 'resource' as const,
        },
      ];

      const variableItems =
        variables?.length > 0
          ? variables.filter(
              (variable) =>
                variable.source === 'startNode' || variable.source === 'resourceLibrary',
            )
          : defaultVariables;

      // Get skillResponse nodes for step records
      const stepRecordItems =
        nodes
          ?.filter((node) => node.type === 'skillResponse')
          ?.map((node) => ({
            name: node.data?.title ?? '未命名步骤',
            description: '步骤记录',
            source: 'stepRecord' as const,
            variableType: 'step' as const,
            entityId: node.data?.entityId,
            nodeId: node.id,
          })) ?? [];

      // Get non-skill nodes for result records
      const resultRecordItems =
        nodes
          ?.filter((node) => node.type !== 'skill' && node.type !== 'skillResponse')
          ?.map((node) => ({
            name: node.data?.title ?? '未命名结果',
            description: '结果记录',
            source: 'resultRecord' as const,
            variableType: 'result' as const,
            entityId: node.data?.entityId,
            nodeId: node.id,
          })) ?? [];

      return [...variableItems, ...stepRecordItems, ...resultRecordItems];
    }, [variables, nodes]);

    // Create mention extension with custom suggestion
    const mentionExtension = useMemo(() => {
      return Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: {
          char: '@',
          command: ({ editor, range, props }: { editor: any; range: any; props: any }) => {
            // Handle different types of items
            const item = props;

            // For step and result records, add to context instead of inserting text
            if (item.source === 'stepRecord' || item.source === 'resultRecord') {
              if (setContextItems && item.entityId) {
                // Create context item
                const contextItem: IContextItem = {
                  entityId: item.entityId,
                  title: item.name,
                  type: item.source === 'stepRecord' ? 'skillResponse' : 'document',
                  metadata: {
                    nodeId: item.nodeId,
                    source: item.source,
                  },
                };

                // Check if already in context
                const isAlreadyInContext = contextItems.some(
                  (ctxItem) => ctxItem.entityId === item.entityId,
                );

                if (!isAlreadyInContext) {
                  setContextItems([...contextItems, contextItem]);
                }

                // Insert a placeholder text to show the selection
                const mentionText = `@${item.name}`;
                editor
                  .chain()
                  .focus()
                  .insertContentAt(range, [
                    {
                      type: 'mention',
                      attrs: {
                        id: item.name,
                        label: mentionText,
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
              // For regular variables, insert as normal
              const mentionText = `@${item.name}`;
              editor
                .chain()
                .focus()
                .insertContentAt(range, [
                  {
                    type: 'mention',
                    attrs: {
                      id: item.name,
                      label: mentionText,
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
          items: ({ query }: { query: string }) => {
            console.log('Mention suggestion items:', allItems);
            if (!query) {
              return allItems;
            }
            return allItems.filter(
              (item) =>
                item.name.toLowerCase().includes(query.toLowerCase()) ||
                (item.description?.toLowerCase().includes(query.toLowerCase()) ?? false),
            );
          },
          render: () => {
            let component: any;
            let popup: any;

            return {
              onStart: (props: any) => {
                console.log('Mention suggestion onStart:', props);
                component = new ReactRenderer(MentionList, {
                  props,
                  editor: props.editor,
                });

                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                  theme: 'custom',
                  arrow: false,
                  offset: [0, 8],
                });
              },
              onUpdate(props: any) {
                component.updateProps(props);

                popup[0].setProps({
                  getReferenceClientRect: props.clientRect,
                });
              },
              onKeyDown(props: any) {
                if (props.event.key === 'Escape') {
                  popup[0].hide();
                  return true;
                }

                return component.onKeyDown(props);
              },
              onExit() {
                popup[0].destroy();
                component.destroy();
              },
            };
          },
        },
      });
    }, [allItems, contextItems, setContextItems]);

    // Create Tiptap editor
    const editor = useEditor({
      extensions: [StarterKit, mentionExtension],
      content: query,
      editable: !readonly,
      onUpdate: ({ editor }) => {
        const content = editor.getText();
        setQuery(content);
      },
      editorProps: {
        attributes: {
          class: cn(
            'prose prose-sm max-w-none focus:outline-none',
            inputClassName,
            readonly && 'cursor-not-allowed',
            isFocused ? 'nodrag nopan nowheel cursor-text' : '!cursor-pointer',
          ),
        },
      },
    });

    // Update editor content when query changes externally
    useEffect(() => {
      if (editor && editor.getText() !== query) {
        editor.commands.setContent(query);
      }
    }, [query, editor]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (readonly) {
          e.preventDefault();
          return;
        }

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
            handleSendMessage();
            return;
          }

          // For regular Enter key, send message if not in mention suggestion
          if (!e.shiftKey && (query?.trim() || !isLogin)) {
            e.preventDefault();
            handleSendMessage();
          }
        }
      },
      [query, readonly, handleSendMessage, searchStore, isLogin],
    );

    // Handle focus event and propagate it upward
    const handleFocus = useCallback(() => {
      setIsFocused(true);
      if (onFocus && !readonly) {
        onFocus();
      }
    }, [onFocus, readonly, setIsFocused]);

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
        <style>{editorStyles}</style>
        <div
          ref={ref}
          className={cn(
            'w-full h-full flex flex-col flex-grow overflow-y-auto relative',
            isDragging && 'ring-2 ring-green-500 ring-opacity-50 rounded-lg',
            readonly && 'opacity-70 cursor-not-allowed',
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

          <div
            className={cn('flex-1 min-h-0', readonly && 'cursor-not-allowed')}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={() => setIsFocused(false)}
            onPaste={handlePaste}
          >
            {editor ? (
              <EditorContent editor={editor} className="h-full" data-cy="rich-chat-input" />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                Loading editor...
              </div>
            )}
          </div>
        </div>
      </>
    );
  },
);

RichChatInputComponent.displayName = 'RichChatInputComponent';

export const RichChatInput = memo(RichChatInputComponent, (prevProps, nextProps) => {
  return (
    prevProps.query === nextProps.query &&
    prevProps.selectedSkillName === nextProps.selectedSkillName &&
    prevProps.variables === nextProps.variables &&
    prevProps.onUploadImage === nextProps.onUploadImage &&
    prevProps.onUploadMultipleImages === nextProps.onUploadMultipleImages &&
    prevProps.onFocus === nextProps.onFocus
  );
}) as typeof RichChatInputComponent;

RichChatInput.displayName = 'RichChatInput';
