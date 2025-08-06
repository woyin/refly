import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

interface CanvasResourcesPanelState {
  // Panel width in pixels
  resourcesPanelWidth: number;

  // Methods
  setResourcesPanelWidth: (width: number) => void;
  resetResourcesPanel: () => void;
}

const DEFAULT_PANEL_WIDTH = 480;

export const useCanvasResourcesPanelStore = create<CanvasResourcesPanelState>()(
  persist(
    (set) => ({
      // Default state
      resourcesPanelWidth: DEFAULT_PANEL_WIDTH,
      // Methods
      setResourcesPanelWidth: (width: number) => set({ resourcesPanelWidth: width }),
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
