import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

interface CopilotState {
  // state
  isCopilotOpen: boolean;
  currentSessionId: Record<string, string | null>;
  sessionResultIds: Record<string, string[]>;

  // method
  setIsCopilotOpen: (val: boolean) => void;
  setCurrentSessionId: (canvasId: string, sessionId: string | null) => void;
  setSessionResultIds: (sessionId: string, resultIds: string[]) => void;
  appendSessionResultId: (sessionId: string, resultId: string) => void;
}

export const useCopilotStore = create<CopilotState>()(
  devtools(
    persist(
      (set) => ({
        isCopilotOpen: false,
        currentSessionId: {},
        sessionResultIds: {},

        setIsCopilotOpen: (val: boolean) => set({ isCopilotOpen: val }),
        setCurrentSessionId: (canvasId: string, sessionId: string | null) =>
          set((state) => ({
            currentSessionId: {
              ...state.currentSessionId,
              [canvasId]: sessionId,
            },
          })),
        setSessionResultIds: (sessionId: string, resultIds: string[]) =>
          set((state) => ({
            sessionResultIds: {
              ...state.sessionResultIds,
              [sessionId]: resultIds,
            },
          })),
        appendSessionResultId: (sessionId: string, resultId: string) =>
          set((state) => ({
            sessionResultIds: {
              ...state.sessionResultIds,
              [sessionId]: [...(state.sessionResultIds[sessionId] || []), resultId],
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
