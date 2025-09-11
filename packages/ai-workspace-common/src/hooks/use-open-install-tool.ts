import { useCallback } from 'react';
import { SettingsModalActiveTab, useSiderStoreShallow, useToolStoreShallow } from '@refly/stores';
import { useListToolsetInventory } from '@refly-packages/ai-workspace-common/queries';

export const useOpenInstallTool = () => {
  const { data: toolsetInventory } = useListToolsetInventory({}, null, {
    enabled: true,
  });
  const { setToolStoreModalOpen, setToolInstallModalOpen, setCurrentToolDefinition } =
    useToolStoreShallow((state) => ({
      setToolStoreModalOpen: state.setToolStoreModalOpen,
      setToolInstallModalOpen: state.setToolInstallModalOpen,
      setCurrentToolDefinition: state.setCurrentToolDefinition,
    }));
  const { setShowSettingModal, setSettingsModalActiveTab } = useSiderStoreShallow((state) => ({
    setShowSettingModal: state.setShowSettingModal,
    setSettingsModalActiveTab: state.setSettingsModalActiveTab,
  }));

  const openInstallToolByKey = useCallback(
    (toolsetKey: string) => {
      const definition = toolsetInventory?.data?.find((t) => t.key === toolsetKey);

      if (definition) {
        setCurrentToolDefinition(definition);
        setSettingsModalActiveTab(SettingsModalActiveTab.ToolsConfig);
        setShowSettingModal(true);
        setToolStoreModalOpen(true);
        setToolInstallModalOpen(true);
      }
    },
    [toolsetInventory, setToolStoreModalOpen, setToolInstallModalOpen, setCurrentToolDefinition],
  );

  return { openInstallToolByKey };
};
