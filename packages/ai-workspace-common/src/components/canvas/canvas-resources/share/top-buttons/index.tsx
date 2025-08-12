import { SkillResponseTopButtons } from './skill-response-top-buttons';
import { CodeArtifactTopButtons } from './code-artifact-top-buttons';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { DocumentTopButtons } from './document-top-buttons';
import { ResourceTopButtons } from './resource-top-buttons';

export const TopButtons = () => {
  const { activeNode } = useCanvasResourcesPanelStoreShallow((state) => ({
    activeNode: state.activeNode,
  }));

  switch (activeNode?.type) {
    case 'skillResponse':
      return <SkillResponseTopButtons node={activeNode} />;
    case 'codeArtifact':
      return <CodeArtifactTopButtons />;
    case 'document':
      return <DocumentTopButtons />;
    case 'resource':
      return <ResourceTopButtons />;
    default:
      return null;
  }
};
