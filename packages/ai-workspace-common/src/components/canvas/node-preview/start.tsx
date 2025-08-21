import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { memo, useMemo } from 'react';
import { Empty, Divider } from 'antd';
import { HiPlus } from 'react-icons/hi2';
import { LuList, LuFileStack } from 'react-icons/lu';
import { BiText } from 'react-icons/bi';
import type { WorkflowVariable } from '@refly/openapi-schema';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { VARIABLE_TYPE_ICON_MAP } from '../nodes/start';
import { useTranslation } from 'react-i18next';
import SVGX from '../../../assets/x.svg';

// Variable type configuration
const VARIABLE_TYPE_CONFIG = {
  string: {
    label: 'Text Type',
    icon: BiText,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  resource: {
    label: 'Resource Type',
    icon: LuFileStack,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  option: {
    label: 'Option Type',
    icon: LuList,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
} as const;

const VariableItem = memo(
  ({
    variableType,
    label,
    isRequired = false,
    isSingle = false,
  }: {
    variableType: 'string' | 'option' | 'resource';
    label: string;
    isRequired?: boolean;
    isSingle?: boolean;
  }) => {
    const { t } = useTranslation();
    const Icon = useMemo(() => {
      return VARIABLE_TYPE_ICON_MAP[variableType];
    }, [variableType]);

    return (
      <div className="flex gap-2 items-center justify-between py-1.5 px-3 bg-refly-bg-control-z0 rounded-lg">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <img src={SVGX} alt="x" className="w-[10px] h-[10px] flex-shrink-0" />
          <Divider type="vertical" className="bg-refly-Card-Border mx-2 my-0 flex-shrink-0" />
          <div className="text-xs font-medium text-refly-text-1 truncate max-w-full">{label}</div>
          {isRequired && (
            <div className="h-4 px-1 flex items-center justify-center text-refly-text-2 text-[10px] leading-[14px] border-[1px] border-solid border-refly-Card-Border rounded-[4px] flex-shrink-0">
              {t('canvas.workflow.variables.required')}
            </div>
          )}
          {['option', 'resource'].includes(variableType) && (
            <div className="h-4 px-1 flex items-center justify-center text-refly-text-2 text-[10px] leading-[14px] border-[1px] border-solid border-refly-Card-Border rounded-[4px] flex-shrink-0">
              {t(`canvas.workflow.variables.${isSingle ? 'singleSelect' : 'multipleSelect'}`)}
            </div>
          )}
        </div>

        <Icon size={14} color="var(--refly-text-3)" className="flex-shrink-0" />
      </div>
    );
  },
);

// Variable type section component
const VariableTypeSection = ({
  type,
  variables,
  onAdd,
}: {
  type: keyof typeof VARIABLE_TYPE_CONFIG;
  variables: WorkflowVariable[];
  onAdd?: () => void;
  onEdit?: (variable: WorkflowVariable) => void;
  onDelete?: (variable: WorkflowVariable) => void;
}) => {
  const config = VARIABLE_TYPE_CONFIG[type];
  const Icon = VARIABLE_TYPE_ICON_MAP[type];

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-refly-text-0">
          <Icon size={16} color="var(--refly-text-0)" className="flex-shrink-0" />
          <div className="text-sm font-semibold leading-6">{config.label}</div>
        </div>

        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <HiPlus className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* Variables list */}
      {variables.length > 0 ? (
        <div className="space-y-2">
          {variables.map((variable) => (
            <VariableItem
              key={variable.name}
              label={variable.name}
              isRequired={variable.required}
              variableType={variable.variableType}
              isSingle={variable.isSingle}
            />
          ))}
        </div>
      ) : (
        <Empty description="No variables" image={Empty.PRESENTED_IMAGE_SIMPLE} className="py-8" />
      )}
    </div>
  );
};

export const StartNodePreview = () => {
  const { workflow } = useCanvasContext();
  const { workflowVariables, workflowVariablesLoading } = workflow;

  // Group variables by type
  const groupedVariables = useMemo(() => {
    const groups = {
      string: [] as WorkflowVariable[],
      resource: [] as WorkflowVariable[],
      option: [] as WorkflowVariable[],
    };

    if (workflowVariables) {
      for (const variable of workflowVariables) {
        const type = variable.variableType ?? 'string';
        if (groups[type]) {
          groups[type].push(variable);
        }
      }
    }

    return groups;
  }, [workflowVariables]);

  const handleAddVariable = (type: keyof typeof VARIABLE_TYPE_CONFIG) => {
    // TODO: Implement add variable logic
    console.log('Add variable of type:', type);
  };

  const handleEditVariable = (variable: WorkflowVariable) => {
    // TODO: Implement edit variable logic
    console.log('Edit variable:', variable);
  };

  const handleDeleteVariable = (variable: WorkflowVariable) => {
    // TODO: Implement delete variable logic
    console.log('Delete variable:', variable);
  };

  if (workflowVariablesLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <Spin />
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto p-4">
      <div className="space-y-6">
        <VariableTypeSection
          type="string"
          variables={groupedVariables.string}
          onAdd={() => handleAddVariable('string')}
          onEdit={handleEditVariable}
          onDelete={handleDeleteVariable}
        />

        <VariableTypeSection
          type="resource"
          variables={groupedVariables.resource}
          onAdd={() => handleAddVariable('resource')}
          onEdit={handleEditVariable}
          onDelete={handleDeleteVariable}
        />

        <VariableTypeSection
          type="option"
          variables={groupedVariables.option}
          onAdd={() => handleAddVariable('option')}
          onEdit={handleEditVariable}
          onDelete={handleDeleteVariable}
        />
      </div>
    </div>
  );
};
