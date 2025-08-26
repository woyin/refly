import {
  AiChat,
  Doc2,
  Audio,
  Code1,
  Image,
  Video,
  Web1,
  Note,
  Media,
  Group,
  Start,
  List,
  Attachment,
} from 'refly-icons';
import { BiText } from 'react-icons/bi';
export const getVariableIcon = (type: string) => {
  console.log('type', type);
  switch (type) {
    // Start node variable types
    case 'string':
      return <BiText className="bg-[#155EEF] rounded-md p-1" size={20} color="white" />;
    case 'option':
      return <List className="bg-[#F79009] rounded-md p-1" size={20} color="white" />;
    case 'resource':
      return <Attachment className="bg-[#12B76A] rounded-md p-1" size={20} color="white" />;

    // Node types for step and result records
    case 'document':
      return <Doc2 className="bg-[#0062D6] rounded-md p-1" size={20} color="white" />;
    case 'audio':
      return <Audio className="bg-[#F93920] rounded-md p-1" size={20} color="white" />;
    case 'startNode':
      return <Start className="bg-[#FC8800] rounded-md p-1" size={20} color="white" />;
    case 'resourceLibrary':
      return <AiChat className="bg-[#FC8800] rounded-md p-1" size={20} color="white" />;
    case 'code':
    case 'codeArtifact':
      return <Code1 className="bg-[#0062D6] rounded-md p-1" size={20} color="white" />;
    case 'image':
      return (
        <Image
          className="bg-gradient-to-r from-pink-500 to-purple-500 rounded-md p-1"
          size={20}
          color="white"
        />
      );
    case 'video':
      return <Video className="bg-[#F93920] rounded-md p-1" size={20} color="white" />;
    case 'website':
      return <Web1 className="bg-[#12B76A] rounded-md p-1" size={20} color="white" />;
    case 'memo':
      return <Note className="bg-[#F79009] rounded-md p-1" size={20} color="white" />;
    case 'skill':
    case 'mediaSkill':
      return <Media className="bg-[#155EEF] rounded-md p-1" size={20} color="white" />;
    case 'skillResponse':
    case 'mediaSkillResponse':
      return <AiChat className="bg-[#12B76A] rounded-md p-1" size={20} color="white" />;
    case 'tool':
    case 'toolResponse':
      return <AiChat className="bg-[#F79009] rounded-md p-1" size={20} color="white" />;
    case 'group':
      return <Group className="bg-[#667085] rounded-md p-1" size={20} color="white" />;
    case 'step':
      return <AiChat className="bg-[#12B76A] rounded-md p-1" size={20} color="white" />;
    case 'result':
      return <AiChat className="bg-[#155EEF] rounded-md p-1" size={20} color="white" />;
    default:
      return <AiChat className="bg-[#667085] rounded-md p-1" size={20} color="white" />;
  }
};
