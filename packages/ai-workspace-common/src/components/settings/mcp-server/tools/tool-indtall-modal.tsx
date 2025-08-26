import { Modal } from 'antd';
import { ToolsetDefinition, ToolsetInstance } from '@refly-packages/ai-workspace-common/requests';
import { useTranslation } from 'react-i18next';

interface ToolInstallModalProps {
  mode: 'install' | 'update';
  toolInstance?: ToolsetInstance;
  toolDefinition?: ToolsetDefinition;
  visible: boolean;
  onCancel: () => void;
}

export const ToolInstallModal = ({
  mode,
  toolInstance,
  toolDefinition,
  visible,
  onCancel,
}: ToolInstallModalProps) => {
  const { t } = useTranslation();
  console.log('toolInstance', t, mode, toolInstance, toolDefinition);

  return (
    <Modal open={visible} onCancel={onCancel}>
      <div>ToolInstallModal</div>
    </Modal>
  );
};
