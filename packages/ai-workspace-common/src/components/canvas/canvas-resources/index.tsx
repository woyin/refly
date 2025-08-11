import { memo, useEffect, useRef } from 'react';
import { Modal } from 'antd';
import { CanvasResourcesHeader } from './share/canvas-resources-header';
import { ResourceOverview } from './share/resource-overview';
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
  const prevCanvasIdRef = useRef<string | null>(canvasId);

  useEffect(() => {
    if (canvasId && canvasId !== prevCanvasIdRef.current) {
      prevCanvasIdRef.current = canvasId;
      resetState();
    }
  }, [canvasId, resetState]);

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
      className={`w-full h-full overflow-hidden flex flex-col bg-refly-bg-content-z2 rounded-xl border-solid border border-refly-Card-Border shadow-refly-m ${
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
        wrapper: {
          transform: 'translateX(4.5%)',
        },
        content: {
          padding: 0,
        },
      }}
      className="flex flex-col"
      destroyOnHidden
    >
      <div className="flex w-full h-[99vh]">
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
