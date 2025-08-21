import { memo, useEffect, useState, useCallback } from 'react';
import { NodeProps, Position } from '@xyflow/react';
import { NodeIcon } from './shared/node-icon';
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
  const [isHovered, setIsHovered] = useState(false);
  const { edges } = useCanvasData();
  const { setNodeStyle } = useNodeData();
  useSelectedNodeZIndex(id, selected);
  const { handleMouseEnter: onHoverStart, handleMouseLeave: onHoverEnd } = useNodeHoverEffect(id);

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
          <NodeIcon type="start" filled={true} iconSize={24} />
          <span className="text-lg font-bold text-gray-800">Start</span>
        </div>

        {/* Input parameters section */}
        <div className="space-y-2">
          <InputParameterRow label="userInput" isRequired={true} icon={BiText} />
          <InputParameterRow label="query" isRequired={true} icon={BiText} />
          <InputParameterRow label="files" icon={HiPaperClip} />
          <InputParameterRow label="audience" icon={HiOutlineViewList} />
        </div>
      </div>
    </div>
  );
});

StartNode.displayName = 'StartNode';
