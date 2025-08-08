import { CanvasNode } from '@refly/canvas-common';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

export type CanvasResourcesPanelMode = 'wide' | 'normal' | 'hidden';

export type CanvasResourcesParentType = 'stepsRecord' | 'resultsRecord' | 'myUpload';

interface CanvasResourcesPanelState {
  // Panel width in pixels
  panelWidth: number;
  panelMode: CanvasResourcesPanelMode;
  showLeftOverview: boolean;
  parentType: CanvasResourcesParentType | null;
  activeTab: CanvasResourcesParentType;
  activeNode: CanvasNode | null;

  // Methods
  setPanelWidth: (width: number) => void;
  setPanelMode: (mode: CanvasResourcesPanelMode) => void;
  setShowLeftOverview: (show: boolean) => void;
  setParentType: (type: CanvasResourcesParentType | null) => void;
  setActiveTab: (tab: CanvasResourcesParentType) => void;
  setActiveNode: (node: CanvasNode | null) => void;

  resetState: () => void;
}

const DEFAULT_PANEL_WIDTH = 480;

const defaultState = {
  panelWidth: DEFAULT_PANEL_WIDTH,
  panelMode: 'normal' as const,
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
      setPanelWidth: (width: number) => set({ panelWidth: width }),
      setPanelMode: (mode: CanvasResourcesPanelMode) => set({ panelMode: mode }),
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
        activeNode: state.activeNode,
        parentType: state.parentType,
        panelMode: state.panelMode,
        panelWidth: state.panelWidth,
      }),
    },
  ),
);

export const useCanvasResourcesPanelStoreShallow = <T>(
  selector: (state: CanvasResourcesPanelState) => T,
) => {
  return useCanvasResourcesPanelStore(useShallow(selector));
};
