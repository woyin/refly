import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useNodePreviewControl } from '@refly-packages/ai-workspace-common/hooks/canvas';
import { locateToVariableEmitter } from '@refly-packages/ai-workspace-common/events/locateToVariable';
import type { WorkflowVariable } from '@refly/openapi-schema';

/**
 * Hook for handling variable view operations
 * Provides functionality to open start node preview and locate to specific variables
 */
export const useVariableView = (canvasId: string) => {
  const { getNodes } = useReactFlow();
  const { previewNode } = useNodePreviewControl({ canvasId });

  const handleVariableView = useCallback(
    (variable: WorkflowVariable) => {
      // Find the start node in the canvas
      const nodes = getNodes();
      const startNode = nodes.find((node) => node.type === 'start');

      if (startNode) {
        // Convert ReactFlow Node to CanvasNode
        const canvasNode = {
          id: startNode.id,
          type: startNode.type as any,
          position: startNode.position,
          data: {
            title: startNode.data?.title || 'Start',
            entityId: startNode.data?.entityId || startNode.id,
            ...startNode.data,
          } as any,
          selected: startNode.selected,
          dragging: startNode.dragging,
          ...startNode,
        } as any;

        // Open the start node preview
        previewNode(canvasNode);

        // Emit event to locate to the specific variable
        setTimeout(() => {
          locateToVariableEmitter.emit('locateToVariable', {
            canvasId,
            nodeId: startNode.id,
            variableId: variable.variableId,
            variableName: variable.name,
          });
        }, 100); // Small delay to ensure preview is open
      }
    },
    [canvasId, getNodes, previewNode],
  );

  return {
    handleVariableView,
  };
};
