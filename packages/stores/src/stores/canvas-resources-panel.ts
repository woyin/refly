import { CanvasNode } from '@refly/canvas-common';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

export type CanvasResourcesPanelMode = 'wide' | 'normal' | 'hidden';

export type CanvasResourcesParentType = 'stepsRecord' | 'resultsRecord' | 'myUpload';

interface CanvasResourcesPanelState {
  // Panel width in pixels
  panelWidth: number;
  sidePanelVisible: boolean;
  wideScreenVisible: boolean;
  showLeftOverview: boolean;
  parentType: CanvasResourcesParentType | null;
  activeTab: CanvasResourcesParentType;
  activeNode: CanvasNode | null;
  searchKeyword: string;

  // Methods
  setPanelWidth: (width: number) => void;
  setSidePanelVisible: (visible: boolean) => void;
  setWideScreenVisible: (visible: boolean) => void;
  setShowLeftOverview: (show: boolean) => void;
  setParentType: (type: CanvasResourcesParentType | null) => void;
  setActiveTab: (tab: CanvasResourcesParentType) => void;
  setActiveNode: (node: CanvasNode | null) => void;
  setSearchKeyword: (keyword: string) => void;

  resetState: () => void;
}

const DEFAULT_PANEL_WIDTH = 480;

const defaultState = {
  panelWidth: DEFAULT_PANEL_WIDTH,
  sidePanelVisible: false,
  wideScreenVisible: false,
  showLeftOverview: false,
  parentType: null,
  activeTab: 'stepsRecord' as const,
  activeNode: null,
  searchKeyword: '',
};

export const useCanvasResourcesPanelStore = create<CanvasResourcesPanelState>()(
  persist(
    (set) => ({
      // Default state
      ...defaultState,

      // Methods
      setPanelWidth: (width: number) => set({ panelWidth: width }),
      setSidePanelVisible: (visible: boolean) => set({ sidePanelVisible: visible }),
      setWideScreenVisible: (visible: boolean) => set({ wideScreenVisible: visible }),
      setShowLeftOverview: (show: boolean) => set({ showLeftOverview: show }),
      setParentType: (type: CanvasResourcesParentType | null) => set({ parentType: type }),
      setActiveTab: (tab: CanvasResourcesParentType) => set({ activeTab: tab }),
      setActiveNode: (node: CanvasNode | null) => set({ activeNode: node }),
      setSearchKeyword: (keyword: string) => set({ searchKeyword: keyword }),
      resetState: () => set(defaultState),
    }),
    {
      name: 'canvas-resources-panel-storage',
      partialize: (state) => ({
        activeTab: state.activeTab,
        activeNode: state.activeNode,
        parentType: state.parentType,
        panelWidth: state.panelWidth,
        sidePanelVisible: state.sidePanelVisible,
        wideScreenVisible: state.wideScreenVisible,
      }),
    },
  ),
);

export const useCanvasResourcesPanelStoreShallow = <T>(
  selector: (state: CanvasResourcesPanelState) => T,
) => {
  return useCanvasResourcesPanelStore(useShallow(selector));
};
