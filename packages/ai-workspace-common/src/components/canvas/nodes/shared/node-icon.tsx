import type { ComponentType, NamedExoticComponent } from 'react';
import { memo } from 'react';
import { NODE_COLORS } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/colors';
import { CanvasNodeType, SelectionKey } from '@refly/openapi-schema';
import { AiChat, Group, Image, Video, Audio, Doc, Web1, Note, Media } from 'refly-icons';

type IconComponent = ComponentType<{ size?: number | string; color?: string }>;
const ICONS: Record<CanvasNodeType | SelectionKey, IconComponent> = {
  group: Group,
  image: Image,
  video: Video,
  audio: Audio,
  document: Doc,
  resource: Doc,
  codeArtifact: Web1,
  website: Web1,
  memo: Note,
  skillResponse: AiChat,
  // Add missing types with reasonable defaults
  tool: AiChat,
  toolResponse: AiChat,
  skill: AiChat,
  mediaSkill: Media,
  mediaSkillResponse: Media,
  documentSelection: Doc,
  resourceSelection: Doc,
  skillResponseSelection: AiChat,
  extensionWeblinkSelection: Web1,
  documentCursorSelection: Doc,
  documentBeforeCursorSelection: Doc,
  documentAfterCursorSelection: Doc,
};

interface NodeIconProps {
  type: CanvasNodeType | SelectionKey;
  className?: string;
  iconColor?: string;
  iconSize?: number;
  small?: boolean;
  filled?: boolean;
}

export const NodeIcon: NamedExoticComponent<NodeIconProps> = memo(
  ({
    type,
    className,
    iconColor = 'white',
    iconSize,
    small = false,
    filled = true,
  }: NodeIconProps) => {
    // Fallback to Doc icon if the type is not mapped
    const Icon = ICONS[type] ?? Doc;
    const size = small ? 14 : 16;
    const resolvedColor = NODE_COLORS[type as CanvasNodeType] ?? NODE_COLORS.document;
    return (
      <div
        className={`rounded-lg flex items-center justify-center flex-shrink-0 ${small ? 'w-5 h-5' : 'w-6 h-6'} ${
          type === 'image' && filled && 'bg-gradient-to-r from-pink-500 to-purple-500'
        } ${className ?? ''}`}
        style={{ backgroundColor: filled ? resolvedColor : 'transparent' }}
      >
        <Icon size={iconSize || size} color={filled ? 'white' : (resolvedColor ?? iconColor)} />
      </div>
    );
  },
);

NodeIcon.displayName = 'NodeIcon';
