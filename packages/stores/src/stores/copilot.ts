import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

interface CopilotState {
  // state
  isCopilotOpen: boolean;
  currentSessionId: Record<string, string | null>;

  // method
  setIsCopilotOpen: (val: boolean) => void;
  setCurrentSessionId: (canvasId: string, sessionId: string | null) => void;
}

export const useCopilotStore = create<CopilotState>()(
  devtools(
    persist(
      (set) => ({
        isCopilotOpen: false,
        currentSessionId: {},
        setIsCopilotOpen: (val: boolean) => set({ isCopilotOpen: val }),
        setCurrentSessionId: (canvasId: string, sessionId: string | null) =>
          set((state) => ({
            currentSessionId: {
              ...state.currentSessionId,
              [canvasId]: sessionId,
            },
          })),
      }),
      {
        name: 'copilot-storage',
        partialize: (state) => ({
          currentSessionId: state.currentSessionId,
        }),
      },
    ),
  ),
);

export const useCopilotStoreShallow = <T>(selector: (state: CopilotState) => T) => {
  return useCopilotStore(useShallow(selector));
};
