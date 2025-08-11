import { SkillResponseTopButtons } from '@refly-packages/ai-workspace-common/components/canvas/canvas-resources/share/top-buttons/skill-response-top-buttons';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';

export const TopButtons = () => {
  const { activeNode } = useCanvasResourcesPanelStoreShallow((state) => ({
    activeNode: state.activeNode,
  }));

  switch (activeNode?.type) {
    case 'skillResponse':
      return <SkillResponseTopButtons node={activeNode} />;
    default:
      return null;
  }
};
