import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { WorkflowVariable } from '@refly/openapi-schema';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from 'antd';
import { Close } from 'refly-icons';
import { useMemo, useState } from 'react';
import { BiText } from 'react-icons/bi';
import { Attachment, List } from 'refly-icons';
import cn from 'classnames';
const VARIABLE_TYPES = ['string', 'option', 'resource'];

interface CreateVariablesModalProps {
  defaultValue?: WorkflowVariable;
  visible: boolean;
  onCancel: (val: boolean) => void;
}

export const CreateVariablesModal = ({
  visible,
  onCancel,
  defaultValue,
}: CreateVariablesModalProps) => {
  const { t } = useTranslation();
  console.log('defaultValues', VARIABLE_TYPES, defaultValue, getClient);
  const [variableType, setVariableType] = useState<string>(defaultValue?.variableType || 'string');
  const variableTypeOptions = useMemo(() => {
    return [
      {
        label: t('canvas.workflow.variables.variableTypeOptions.string'),
        value: 'string',
        icon: <BiText size={16} />,
      },
      {
        label: t('canvas.workflow.variables.variableTypeOptions.resource'),
        value: 'resource',
        icon: <Attachment size={16} />,
      },
      {
        label: t('canvas.workflow.variables.variableTypeOptions.option'),
        value: 'option',
        icon: <List size={16} />,
      },
    ];
  }, [t]);

  const handleVariableTypeChange = (type: string) => {
    setVariableType(type);
  };

  return (
    <Modal
      centered
      open={visible}
      onCancel={() => onCancel(false)}
      closable={false}
      title={null}
      footer={null}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-refly-text-0 text-lg font-semibold leading-6">
            {t(`canvas.workflow.variables.${defaultValue ? 'editTitle' : 'addTitle'}`) ||
              (defaultValue ? 'Edit Variable' : 'Add Variable')}
          </div>
          <Button type="text" icon={<Close size={24} />} onClick={() => onCancel(false)} />
        </div>
        <div className="flex-grow min-h-0 overflow-y-auto">
          <div className="text-xs text-refly-text-0 mb-2 font-semibold">
            {t('canvas.workflow.variables.variableType')}
          </div>

          <div className="flex items-center justify-between gap-2">
            {variableTypeOptions.map((option) => (
              <div
                key={option.value}
                className={cn(
                  'flex-1 px-2 py-1 text-sm leading-5 flex items-center justify-center gap-1 rounded-lg bg-refly-bg-control-z1 border-[1px] border-solid border-refly-Card-Border hover:!text-refly-primary-default hover:!border-refly-primary-default cursor-pointer',
                  variableType === option.value
                    ? 'text-refly-primary-default border-refly-primary-default font-semibold'
                    : '',
                )}
                onClick={() => handleVariableTypeChange(option.value)}
              >
                {option.icon}
                {option.label}
              </div>
            ))}
          </div>

          <div>variables form</div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <Button onClick={() => onCancel(false)}>{t('common.cancel') || 'Cancel'}</Button>
          <Button type="primary" onClick={() => onCancel(false)}>
            {t('common.save') || 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
