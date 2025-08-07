import { useEffect } from 'react';
import { CanvasResourcesHeader } from './canvas-resources-header';
import { ResourceOverview } from './resource-overview';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { PreviewComponent } from '@refly-packages/ai-workspace-common/components/canvas/node-preview';
import { RESULT_NODE_TYPES } from './result-list';
import { CanvasNodeType } from '@refly/openapi-schema';

export const CanvasResources = () => {
  const { showLeftOverview, activeNode, resetState, setParentType, setPanelVisible } =
    useCanvasResourcesPanelStoreShallow((state) => ({
      showLeftOverview: state.showLeftOverview,
      activeNode: state.activeNode,
      resetState: state.resetState,
      setParentType: state.setParentType,
      setPanelVisible: state.setPanelVisible,
    }));

  const { canvasId } = useCanvasContext();

  useEffect(() => {
    if (canvasId) {
      resetState();
    }
  }, [canvasId]);

  useEffect(() => {
    if (activeNode) {
      if (activeNode.type === 'resource') {
        setParentType('myUpload');
      }
      if (activeNode.type === 'skillResponse') {
        setParentType('stepsRecord');
      }
      if (RESULT_NODE_TYPES.includes(activeNode.type as CanvasNodeType)) {
        setParentType('resultsRecord');
      }

      // Ensure resources panel is visible when active node changes
      setPanelVisible(true);
    }
  }, [activeNode]);

  return (
    <div
      className={`w-full h-full flex flex-col bg-refly-bg-content-z2 rounded-xl border-solid border-[1px] border-refly-Card-Border shadow-refly-m ${
        showLeftOverview ? 'rounded-l-none' : ''
      }`}
    >
      <CanvasResourcesHeader />
      {activeNode ? <PreviewComponent node={activeNode} /> : <ResourceOverview />}
    </div>
  );
};
