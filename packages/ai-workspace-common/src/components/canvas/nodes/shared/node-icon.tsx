import { NODE_COLORS } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/colors';
import { CanvasNodeType } from '@refly/openapi-schema';
import { AiChat, Group, Image, Video, Audio, Doc, Code, Web1, Note } from 'refly-icons';

const ICONS = {
  group: Group,
  image: Image,
  video: Video,
  audio: Audio,
  document: Doc,
  codeArtifact: Code,
  website: Web1,
  memo: Note,
  skillResponse: AiChat,
};

interface NodeIconProps {
  type: CanvasNodeType;
  className?: string;
  iconColor?: string;
  iconSize?: number;
  small?: boolean;
}

export const NodeIcon = ({
  type,
  className,
  iconColor = 'white',
  iconSize,
  small = false,
}: NodeIconProps) => {
  const Icon = ICONS[type];
  const size = small ? 14 : 16;
  return (
    <div
      className={`rounded-lg flex items-center justify-center flex-shrink-0 ${small ? 'w-5 h-5' : 'w-6 h-6'} ${
        type === 'image' && 'bg-gradient-to-r from-pink-500 to-purple-500'
      } ${className}`}
      style={{ backgroundColor: NODE_COLORS[type] }}
    >
      <Icon size={iconSize || size} color={iconColor} />
    </div>
  );
};
