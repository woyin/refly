import { CanvasNode } from '@refly/canvas-common';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

export type CanvasResourcesParentType = 'stepsRecord' | 'resultsRecord' | 'myUpload';

interface CanvasResourcesPanelState {
  // Panel width in pixels
  resourcesPanelWidth: number;
  panelVisible: boolean;
  showLeftOverview: boolean;
  parentType: CanvasResourcesParentType | null;
  activeTab: CanvasResourcesParentType;
  activeNode: CanvasNode | null;

  // Methods
  setResourcesPanelWidth: (width: number) => void;
  setPanelVisible: (visible: boolean) => void;
  setShowLeftOverview: (show: boolean) => void;
  setParentType: (type: CanvasResourcesParentType | null) => void;
  setActiveTab: (tab: CanvasResourcesParentType) => void;
  setActiveNode: (node: CanvasNode | null) => void;

  resetState: () => void;
}

const DEFAULT_PANEL_WIDTH = 480;

const defaultState = {
  resourcesPanelWidth: DEFAULT_PANEL_WIDTH,
  panelVisible: false,
  showLeftOverview: false,
  parentType: null,
  activeTab: 'stepsRecord' as const,
  activeNode: null,
};

export const useCanvasResourcesPanelStore = create<CanvasResourcesPanelState>()(
  persist(
    (set) => ({
      // Default state
      ...defaultState,

      // Methods
      setResourcesPanelWidth: (width: number) => set({ resourcesPanelWidth: width }),
      setPanelVisible: (visible: boolean) => set({ panelVisible: visible }),
      setShowLeftOverview: (show: boolean) => set({ showLeftOverview: show }),
      setParentType: (type: CanvasResourcesParentType | null) => set({ parentType: type }),
      setActiveTab: (tab: CanvasResourcesParentType) => set({ activeTab: tab }),
      setActiveNode: (node: CanvasNode | null) => set({ activeNode: node }),
      resetState: () => set(defaultState),
    }),
    {
      name: 'canvas-resources-panel-storage',
      partialize: (state) => ({
        activeTab: state.activeTab,
        panelVisible: state.panelVisible,
        resourcesPanelWidth: state.resourcesPanelWidth,
      }),
    },
  ),
);

export const useCanvasResourcesPanelStoreShallow = <T>(
  selector: (state: CanvasResourcesPanelState) => T,
) => {
  return useCanvasResourcesPanelStore(useShallow(selector));
};
