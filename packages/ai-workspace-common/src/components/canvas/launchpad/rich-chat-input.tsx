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

  onUploadImage?: (file: File) => Promise<void>;
  onUploadMultipleImages?: (files: File[]) => Promise<void>;
  onFocus?: () => void;
}

// Custom mention suggestion component with improved UI design
const MentionList = ({ items, command }: { items: any[]; command: any }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Group items by source
  const groupedItems = useMemo(() => {
    const startNodeItems = items.filter((item) => item.source === 'startNode');
    const resourceLibraryItems = items.filter((item) => item.source === 'resourceLibrary');

    return {
      startNode: startNodeItems,
      resourceLibrary: resourceLibraryItems,
    };
  }, [items]);

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
      className="bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-hidden min-w-96"
      onMouseLeave={() => {
        setHoveredCategory(null);
      }}
    >
      {/* Green border at top */}
      <div className="h-1 bg-green-500 rounded-t-lg" />

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
          {groupedItems.resourceLibrary.length > 0 && (
            <div
              className={`px-4 py-3 cursor-pointer transition-colors ${
                hoveredCategory === 'resourceLibrary'
                  ? 'bg-blue-50 border-l-2 border-l-blue-500'
                  : 'hover:bg-gray-50'
              }`}
              onMouseEnter={() => setHoveredCategory('resourceLibrary')}
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
          {hoveredCategory &&
            groupedItems[hoveredCategory as keyof typeof groupedItems]?.length > 0 && (
              <div className="py-2 max-h-56 overflow-y-auto">
                {groupedItems[hoveredCategory as keyof typeof groupedItems].map((item) => (
                  <div
                    key={item.name}
                    className="px-4 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => selectItem(item)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-green-500 text-xs">✗</span>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {item.name}
                        </span>
                        {item.description && (
                          <span className="text-xs text-gray-500 truncate">{item.description}</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 font-mono flex-shrink-0">
                        {item.source === 'startNode'
                          ? 'T'
                          : item.variableType === 'resource'
                            ? '@'
                            : null}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
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
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const [isDragging, setIsDragging] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const isLogin = useUserStoreShallow((state) => state.isLogin);

    const searchStore = useSearchStoreShallow((state) => ({
      setIsSearchOpen: state.setIsSearchOpen,
    }));

    // Filter workflow variables to only show startNode and resourceLibrary types
    const filteredVariables = useMemo(() => {
      return (
        variables?.filter(
          (variable) => variable.source === 'startNode' || variable.source === 'resourceLibrary',
        ) ?? []
      );
    }, [variables]);

    // Create mention extension with custom suggestion
    const mentionExtension = useMemo(() => {
      return Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: {
          items: ({ query }: { query: string }) => {
            if (!query) {
              return filteredVariables;
            }
            return filteredVariables.filter(
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
    }, [filteredVariables]);

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
