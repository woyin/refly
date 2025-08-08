import { memo, useEffect } from 'react';
import { Modal } from 'antd';
import { CanvasResourcesHeader } from './canvas-resources-header';
import { ResourceOverview } from './resource-overview';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { PreviewComponent } from '@refly-packages/ai-workspace-common/components/canvas/node-preview';
import { RESULT_NODE_TYPES } from './result-list';
import { CanvasNodeType } from '@refly/openapi-schema';
import './index.scss';

export const CanvasResources = memo(() => {
  const { showLeftOverview, activeNode, panelMode, resetState, setParentType, setPanelMode } =
    useCanvasResourcesPanelStoreShallow((state) => ({
      showLeftOverview: state.showLeftOverview,
      activeNode: state.activeNode,
      panelMode: state.panelMode,
      resetState: state.resetState,
      setParentType: state.setParentType,
      setPanelMode: state.setPanelMode,
    }));

  const { canvasId } = useCanvasContext();

  useEffect(() => {
    console.log('CanvasResources useEffect', canvasId);
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
    }
  }, [activeNode, panelMode, setPanelMode]);

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
});

export const CanvasResourcesWidescreenModal = memo(() => {
  const { panelMode, setPanelMode } = useCanvasResourcesPanelStoreShallow((state) => ({
    panelMode: state.panelMode,
    setPanelMode: state.setPanelMode,
  }));
  console.log('panelMode', panelMode);

  return (
    <Modal
      open={panelMode === 'wide'}
      centered
      onCancel={() => {
        console.log('onCancel');
        setPanelMode('normal');
      }}
      title={null}
      closable={false}
      footer={null}
      width="90%"
      styles={{
        content: {
          padding: 0,
        },
      }}
      className="flex flex-col"
    >
      <div className="flex w-full h-[95vh]">
        <div className="w-[360px] h-full border-r border-refly-Card-Border">
          <ResourceOverview />
        </div>
        <div className="flex-1 h-full">
          <CanvasResources />
        </div>
      </div>
    </Modal>
  );
});

CanvasResourcesWidescreenModal.displayName = 'CanvasResourcesWidescreenModal';
