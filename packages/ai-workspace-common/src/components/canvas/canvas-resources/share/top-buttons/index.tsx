import { SkillResponseTopButtons } from './skill-response-top-buttons';
import { CodeArtifactTopButtons } from './code-artifact-top-buttons';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';

export const TopButtons = () => {
  const { activeNode } = useCanvasResourcesPanelStoreShallow((state) => ({
    activeNode: state.activeNode,
  }));

  switch (activeNode?.type) {
    case 'skillResponse':
      return <SkillResponseTopButtons node={activeNode} />;
    case 'codeArtifact':
      return <CodeArtifactTopButtons />;
    default:
      return null;
  }
};
