import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
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
  devtools((set) => ({
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
  })),
);

export const useCopilotStoreShallow = <T>(selector: (state: CopilotState) => T) => {
  return useCopilotStore(useShallow(selector));
};
