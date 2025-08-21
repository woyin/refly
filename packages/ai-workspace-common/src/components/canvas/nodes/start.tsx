import { memo, useEffect, useState, useCallback } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import { NodeIcon } from './shared/node-icon';
import { Button } from 'antd';
import { BiText } from 'react-icons/bi';
import { HiPaperClip } from 'react-icons/hi2';
import { HiOutlineViewList } from 'react-icons/hi';
import { LuX } from 'react-icons/lu';
import { useNodeData } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { getNodeCommonStyles } from './index';
import { CustomHandle } from './shared/custom-handle';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { useSelectedNodeZIndex } from '@refly-packages/ai-workspace-common/hooks/canvas/use-selected-node-zIndex';
import { useNodeHoverEffect } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-hover';
import { useTranslation } from 'react-i18next';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { CreateVariablesModal } from '../workflow-variables/create-variables-modal';

const NODE_SIDE_CONFIG = { width: 320, height: 'auto' };

// Input parameter row component
const InputParameterRow = memo(
  ({
    label,
    isRequired = false,
    icon: Icon,
  }: {
    label: string;
    isRequired?: boolean;
    icon: React.ComponentType<{ size?: number; color?: string }>;
  }) => {
    return (
      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
        {/* Left indicator with X icon and separator */}
        <div className="flex items-center gap-1">
          <LuX size={12} className="text-green-600" />
          <div className="w-px h-4 bg-gray-300" />
        </div>

        {/* Field label */}
        <span className="text-sm font-medium text-gray-700 flex-1">{label}</span>

        {/* Required tag */}
        {isRequired && (
          <span className="px-2 py-1 text-xs text-gray-500 bg-gray-200 rounded-full">必填</span>
        )}

        {/* Right icon */}
        <Icon size={16} color="#9CA3AF" />
      </div>
    );
  },
);

InputParameterRow.displayName = 'InputParameterRow';

// Define StartNodeProps type
type StartNodeProps = NodeProps & {
  onNodeClick?: () => void;
};

export const StartNode = memo(({ id, selected, onNodeClick }: StartNodeProps) => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const { edges } = useCanvasData();
  const { setNodeStyle } = useNodeData();
  useSelectedNodeZIndex(id, selected);
  const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);
  const { workflow, readonly } = useCanvasContext();
  const [showCreateVariablesModal, setShowCreateVariablesModal] = useState(false);
  const { workflowVariables, refetchWorkflowVariables, workflowVariablesLoading } = workflow;

  console.log(
    'workflowVariables',
    readonly,
    workflowVariables,
    workflowVariablesLoading,
    refetchWorkflowVariables,
  );
  // Check if node has any connections
  const isSourceConnected = edges?.some((edge) => edge.source === id);

  const handleMouseEnter = useCallback(() => {
    if (!isHovered) {
      setIsHovered(true);
      onHoverStart();
    }
  }, [isHovered, onHoverStart]);

  const handleMouseLeave = useCallback(() => {
    if (isHovered) {
      setIsHovered(false);
      onHoverEnd();
    }
  }, [isHovered, onHoverEnd]);

  useEffect(() => {
    setNodeStyle(id, NODE_SIDE_CONFIG);
  }, [id, setNodeStyle]);

  return (
    <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} onClick={onNodeClick}>
      <CustomHandle
        id={`${id}-source`}
        nodeId={id}
        type="source"
        position={Position.Right}
        isConnected={isSourceConnected}
        isNodeHovered={isHovered}
        nodeType="start"
      />

      <div
        style={NODE_SIDE_CONFIG}
        className={`h-full flex flex-col relative p-4 box-border z-1
          ${getNodeCommonStyles({ selected, isHovered })}
        `}
      >
        {/* Header section */}
        <div className="flex items-center gap-2 mb-4">
          <NodeIcon type="start" filled={true} />
          <span className="text-sm font-semibold leading-6 text-refly-text-0">
            {t('canvas.nodeTypes.start')}
          </span>
        </div>

        {/* Input parameters section */}
        {workflowVariables.length > 0 ? (
          <div className="space-y-2">
            <InputParameterRow label="userInput" isRequired={true} icon={BiText} />
            <InputParameterRow label="query" isRequired={true} icon={BiText} />
            <InputParameterRow label="files" icon={HiPaperClip} />
            <InputParameterRow label="audience" icon={HiOutlineViewList} />
          </div>
        ) : (
          <div className="px-3 py-6 gap-0.5 flex items-center justify-center bg-refly-bg-control-z0 rounded-lg">
            <div className="text-xs text-refly-text-1 leading-4">
              {t('canvas.workflow.variables.empty') || 'No variables defined'}
            </div>
            <Button
              type="text"
              size="small"
              className="text-xs leading-4 font-semibold !text-refly-primary-default p-0.5 !h-5 box-border hover:bg-refly-tertiary-hover"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowCreateVariablesModal(true);
              }}
            >
              {t('canvas.workflow.variables.addVariable') || 'Add'}
            </Button>
          </div>
        )}
      </div>

      <CreateVariablesModal
        visible={showCreateVariablesModal}
        onCancel={setShowCreateVariablesModal}
      />
    </div>
  );
});

StartNode.displayName = 'StartNode';
