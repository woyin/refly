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
  // Change from single activeNode to map of canvasId to activeNode
  activeNodes: Record<string, CanvasNode | null>;
  searchKeyword: string;

  // Methods
  setPanelWidth: (width: number) => void;
  setSidePanelVisible: (visible: boolean) => void;
  setWideScreenVisible: (visible: boolean) => void;
  setShowLeftOverview: (show: boolean) => void;
  setParentType: (type: CanvasResourcesParentType | null) => void;
  setActiveTab: (tab: CanvasResourcesParentType) => void;
  // Update setActiveNode to accept canvasId parameter
  setActiveNode: (canvasId: string, node: CanvasNode | null) => void;
  // Add helper method to get activeNode for a specific canvas
  getActiveNode: (canvasId: string) => CanvasNode | null;
  setSearchKeyword: (keyword: string) => void;

  resetState: () => void;
}

const DEFAULT_PANEL_WIDTH = 480;
const defaultState = {
  sidePanelVisible: true,
  wideScreenVisible: false,
  showLeftOverview: false,
  parentType: null,
  activeTab: 'stepsRecord' as const,
  // Initialize activeNodes as empty object
  searchKeyword: '',
};

export const useCanvasResourcesPanelStore = create<CanvasResourcesPanelState>()(
  persist(
    (set, get) => ({
      // Default state
      panelWidth: DEFAULT_PANEL_WIDTH,
      activeNodes: {},
      ...defaultState,

      // Methods
      setPanelWidth: (width: number) => set({ panelWidth: width }),
      setSidePanelVisible: (visible: boolean) => set({ sidePanelVisible: visible }),
      setWideScreenVisible: (visible: boolean) => set({ wideScreenVisible: visible }),
      setShowLeftOverview: (show: boolean) => set({ showLeftOverview: show }),
      setParentType: (type: CanvasResourcesParentType | null) => set({ parentType: type }),
      setActiveTab: (tab: CanvasResourcesParentType) => set({ activeTab: tab }),
      // Update setActiveNode to handle canvasId
      setActiveNode: (canvasId: string, node: CanvasNode | null) =>
        set((state) => ({
          activeNodes: {
            ...state.activeNodes,
            [canvasId]: node,
          },
        })),
      // Add helper method to get activeNode for a specific canvas
      getActiveNode: (canvasId: string) => {
        const state = get();
        return state.activeNodes[canvasId] ?? null;
      },
      setSearchKeyword: (keyword: string) => set({ searchKeyword: keyword }),
      resetState: () => set(defaultState),
    }),
    {
      name: 'canvas-resources-panel-storage',
      partialize: (state) => ({
        activeTab: state.activeTab,
        // Persist activeNodes for all canvases
        activeNodes: state.activeNodes,
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

// Custom hook to get activeNode for a specific canvas
export const useActiveNode = (canvasId: string) => {
  return useCanvasResourcesPanelStoreShallow((state) => ({
    activeNode: state.activeNodes[canvasId] ?? null,
    setActiveNode: (node: CanvasNode | null) => state.setActiveNode(canvasId, node),
  }));
};
