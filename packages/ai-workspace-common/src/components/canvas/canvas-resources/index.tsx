import { useState } from 'react';
import { CanvasResourcesHeader, CanvasResourcesParentType } from './canvas-resources-header';
import { ResourceOverview } from './resource-overview';

export const CanvasResources = () => {
  const [activeTab, setActiveTab] = useState<CanvasResourcesParentType>('stepsRecord');
  const [parentType, setParentType] = useState<CanvasResourcesParentType | null>('stepsRecord');

  return (
    <div className="w-full h-full bg-refly-bg-content-z2 rounded-xl border-solid border-[1px] border-refly-Card-Border shadow-refly-m">
      <CanvasResourcesHeader
        parentType={parentType}
        resourceTitle={activeTab}
        setParentType={setParentType}
      />
      <ResourceOverview activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};
