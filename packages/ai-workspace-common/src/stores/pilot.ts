import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { PilotSession } from '@refly/openapi-schema';

interface PilotState {
  // state
  isPilotOpen: boolean;
  activeSession: PilotSession | null;

  // method
  setIsPilotOpen: (val: boolean) => void;
  setActiveSession: (session: PilotSession | null) => void;
}

export const usePilotStore = create<PilotState>()(
  devtools((set) => ({
    isPilotOpen: false,
    activeSession: null,

    setIsPilotOpen: (val: boolean) => set({ isPilotOpen: val }),
    setActiveSession: (session: PilotSession | null) => set({ activeSession: session }),
  })),
);

export const usePilotStoreShallow = <T>(selector: (state: PilotState) => T) => {
  return usePilotStore(useShallow(selector));
};
