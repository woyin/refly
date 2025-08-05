import { Button } from 'antd';
import { cn } from '../utils';
import {
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  StrikethroughIcon,
  UnderlineIcon,
  type LucideIcon,
} from 'lucide-react';
import { EditorBubbleItem, EditorInstance, useEditor } from '../../core/components';

type SelectorItem = {
  name: string;
  icon: LucideIcon;
  command: (editor: ReturnType<typeof useEditor>['editor']) => void;
  isActive: (editor: ReturnType<typeof useEditor>['editor']) => boolean;
};

export const TextButtons = ({ triggerEditor }: { triggerEditor?: EditorInstance }) => {
  const { editor: currentEditor } = useEditor();
  const editor = triggerEditor || currentEditor;
  if (!editor) return null;
  const items: SelectorItem[] = [
    {
      name: 'bold',
      isActive: (editor) => editor.isActive('bold'),
      command: (editor) => editor.chain().focus().toggleBold().run(),
      icon: BoldIcon,
    },
    {
      name: 'italic',
      isActive: (editor) => editor.isActive('italic'),
      command: (editor) => editor.chain().focus().toggleItalic().run(),
      icon: ItalicIcon,
    },
    {
      name: 'underline',
      isActive: (editor) => editor.isActive('underline'),
      command: (editor) => editor.chain().focus().toggleUnderline().run(),
      icon: UnderlineIcon,
    },
    {
      name: 'strike',
      isActive: (editor) => editor.isActive('strike'),
      command: (editor) => editor.chain().focus().toggleStrike().run(),
      icon: StrikethroughIcon,
    },
    {
      name: 'code',
      isActive: (editor) => editor.isActive('code'),
      command: (editor) => editor.chain().focus().toggleCode().run(),
      icon: CodeIcon,
    },
  ];

  return (
    <>
      {items.map((item) => (
        <EditorBubbleItem
          triggerEditor={triggerEditor}
          key={item.name}
          onSelect={(editor) => {
            item.command(editor);
          }}
        >
          <Button
            size="small"
            type="text"
            className="w-5 h-5 p-0.5 rounded-[6px] hover:bg-transparent"
          >
            <item.icon
              className={cn('h-4 w-4', {
                'text-refly-primary-default': item.isActive(editor),
              })}
            />
          </Button>
        </EditorBubbleItem>
      ))}
    </>
  );
};
