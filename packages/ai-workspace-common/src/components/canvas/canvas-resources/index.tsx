import { useState } from 'react';
import { CanvasResourcesHeader } from './canvas-resources-header';
import { ResourceOverview } from './resource-overview';
import { useCanvasResourcesPanelStoreShallow, type CanvasResourcesParentType } from '@refly/stores';

export const CanvasResources = () => {
  const [parentType, setParentType] = useState<CanvasResourcesParentType | null>('stepsRecord');
  const { showLeftOverview, activeTab, setActiveTab } = useCanvasResourcesPanelStoreShallow(
    (state) => ({
      showLeftOverview: state.showLeftOverview,
      activeTab: state.activeTab,
      setActiveTab: state.setActiveTab,
    }),
  );

  return (
    <div
      className={`w-full h-full bg-refly-bg-content-z2 rounded-xl border-solid border-[1px] border-refly-Card-Border shadow-refly-m ${
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
