import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { ToolsetDefinition } from '@refly/openapi-schema';

interface ToolState {
  isInitialLoading: boolean;
  toolStoreModalOpen: boolean;
  toolInstallModalOpen: boolean;
  mcpFormModalOpen: boolean;
  currentToolDefinition: ToolsetDefinition | null;

  setInitialLoading: (loading: boolean) => void;
  setToolStoreModalOpen: (open: boolean) => void;
  setToolInstallModalOpen: (open: boolean) => void;
  setMcpFormModalOpen: (open: boolean) => void;
  setCurrentToolDefinition: (definition: ToolsetDefinition | null) => void;
}

export const useToolStore = create<ToolState>()(
  devtools((set) => ({
    isInitialLoading: false,
    toolStoreModalOpen: false,
    toolInstallModalOpen: false,
    mcpFormModalOpen: false,
    currentToolDefinition: null,

    setInitialLoading: (loading: boolean) => set({ isInitialLoading: loading }),
    setToolStoreModalOpen: (open: boolean) => set({ toolStoreModalOpen: open }),
    setToolInstallModalOpen: (open: boolean) => set({ toolInstallModalOpen: open }),
    setMcpFormModalOpen: (open: boolean) => set({ mcpFormModalOpen: open }),
    setCurrentToolDefinition: (definition: ToolsetDefinition | null) =>
      set({ currentToolDefinition: definition }),
  })),
);

export const useToolStoreShallow = <T>(selector: (state: ToolState) => T): T =>
  useToolStore(useShallow(selector));
