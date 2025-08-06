import { useEffect, useState } from 'react';
import { CanvasResourcesHeader } from './canvas-resources-header';
import { ResourceOverview } from './resource-overview';
import { useCanvasResourcesPanelStoreShallow, type CanvasResourcesParentType } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

export const CanvasResources = () => {
  const [parentType, setParentType] = useState<CanvasResourcesParentType | null>('stepsRecord');
  const { showLeftOverview, activeTab, setActiveTab } = useCanvasResourcesPanelStoreShallow(
    (state) => ({
      showLeftOverview: state.showLeftOverview,
      activeTab: state.activeTab,
      setActiveTab: state.setActiveTab,
    }),
  );

  const { canvasId } = useCanvasContext();

  useEffect(() => {
    if (canvasId) {
      setParentType(null);
      setActiveTab('stepsRecord');
    }
  }, [canvasId]);

  return (
    <div
      className={`w-full h-full flex flex-col bg-refly-bg-content-z2 rounded-xl border-solid border-[1px] border-refly-Card-Border shadow-refly-m ${
        showLeftOverview ? 'rounded-l-none' : ''
      }`}
    >
      <CanvasResourcesHeader
        parentType={parentType}
        resourceTitle={activeTab}
        setParentType={setParentType}
      />
      <ResourceOverview activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};
