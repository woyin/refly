import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

export type CanvasResourcesParentType = 'stepsRecord' | 'resultsRecord' | 'myUpload';

interface CanvasResourcesPanelState {
  // Panel width in pixels
  resourcesPanelWidth: number;
  showLeftOverview: boolean;
  activeTab: CanvasResourcesParentType;

  // Methods
  setResourcesPanelWidth: (width: number) => void;
  setShowLeftOverview: (show: boolean) => void;
  setActiveTab: (tab: CanvasResourcesParentType) => void;
  resetResourcesPanel: () => void;
}

const DEFAULT_PANEL_WIDTH = 480;

export const useCanvasResourcesPanelStore = create<CanvasResourcesPanelState>()(
  persist(
    (set) => ({
      // Default state
      resourcesPanelWidth: DEFAULT_PANEL_WIDTH,
      showLeftOverview: false,
      activeTab: 'stepsRecord',
      // Methods
      setResourcesPanelWidth: (width: number) => set({ resourcesPanelWidth: width }),
      setShowLeftOverview: (show: boolean) => set({ showLeftOverview: show }),
      setActiveTab: (tab: CanvasResourcesParentType) => set({ activeTab: tab }),
      resetResourcesPanel: () => set({ resourcesPanelWidth: DEFAULT_PANEL_WIDTH }),
    }),
    {
      name: 'canvas-resources-panel-storage',
      partialize: (state) => ({
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
