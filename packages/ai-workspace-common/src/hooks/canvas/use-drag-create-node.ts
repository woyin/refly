import { useCallback, useRef } from 'react';
import { addEdge, useReactFlow } from '@xyflow/react';
import { genUniqueId } from '@refly/utils/id';
import { genSkillID } from '@refly/utils/id';
import { useTranslation } from 'react-i18next';

/**
 * Hook to manage temporary edge connections in the canvas
 * Used when a user drags an edge from a node but doesn't connect it to another node yet
 */
export function useDragToCreateNode() {
  const { setNodes, setEdges, screenToFlowPosition } = useReactFlow();
  const { t } = useTranslation();

  // Track if we're actually dragging or just clicking
  const isDraggingRef = useRef(false);
  const startPositionRef = useRef({ x: 0, y: 0 });

  // Track when connection starts (mouse down on handle)
  const onConnectStart = useCallback((event) => {
    isDraggingRef.current = false;
    if ('clientX' in event && 'clientY' in event) {
      startPositionRef.current = { x: event.clientX, y: event.clientY };
    } else if (event?.touches?.[0]) {
      startPositionRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
  }, []);

  // Handle when a connection attempt ends without a valid target
  const onConnectEnd = useCallback(
    (event, connectionState) => {
      // Determine if this was a drag or just a click
      let currentPosition = { x: 0, y: 0 };
      if ('clientX' in event && 'clientY' in event) {
        currentPosition = { x: event.clientX, y: event.clientY };
      } else if (event?.changedTouches?.[0]) {
        currentPosition = {
          x: event.changedTouches[0].clientX,
          y: event.changedTouches[0].clientY,
        };
      }

      // Calculate distance moved to determine if it was a drag
      const dx = currentPosition.x - startPositionRef.current.x;
      const dy = currentPosition.y - startPositionRef.current.y;
      const distanceMoved = Math.sqrt(dx * dx + dy * dy);

      // If distance moved is very small, consider it a click and don't create a node
      if (distanceMoved < 10) {
        return;
      }

      // Only create a skill node if the connection is invalid
      // and we have connection state information
      if (!connectionState || connectionState.isValid) {
        return;
      }

      // Extract connection information
      const { fromNode, fromHandle } = connectionState;

      // Get the node ID that initiated the connection
      let sourceNodeId = null;
      let targetNodeId = null;
      let handleType = null;

      // Determine connection direction based on which handle was used
      if (fromHandle?.type === 'source') {
        // User dragged from a source handle, so we need a target
        sourceNodeId = fromNode?.id;
        handleType = 'source';
      } else if (fromHandle?.type === 'target') {
        // User dragged from a target handle, so we need a source
        targetNodeId = fromNode?.id;
        handleType = 'target';
      } else {
        // No handle information, can't proceed
        return;
      }

      if (!sourceNodeId && !targetNodeId) return; // Safety check

      // Get the position where the user dropped the connection
      const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event;
      const position = screenToFlowPosition({
        x: clientX,
        y: clientY,
      });

      // Generate a unique ID for the skill node
      const skillId = genSkillID();
      const skillNodeId = `node-${genUniqueId()}`;

      // Create a skill node at the drop position
      const skillNode = {
        id: skillNodeId,
        type: 'skill',
        position: position,
        data: {
          title: t('canvas.skill.askAI', 'Ask AI'),
          entityId: skillId,
          metadata: {
            query: '',
            // Define basic skill metadata directly
            sizeMode: 'adaptive',
            selectedSkill: null,
            modelInfo: null,
            contextItems: [],
          },
        },
        selectable: true,
      };

      // Create an edge connecting to our skill node (direction depends on handle type)
      const newEdge = {
        id:
          handleType === 'source'
            ? `${sourceNodeId}->${skillNodeId}`
            : `${skillNodeId}->${targetNodeId}`,
        source: handleType === 'source' ? sourceNodeId : skillNodeId,
        target: handleType === 'source' ? skillNodeId : targetNodeId,
      };

      // Add the skill node and edge to the canvas
      setNodes((nodes) => nodes.concat(skillNode));
      setEdges((edges) => addEdge(newEdge, edges));

      // If the source node has contextItems, add the source node to the skill's context
      if (sourceNodeId && handleType === 'source') {
        setNodes((nodes) => {
          const sourceNode = nodes.find((node) => node.id === sourceNodeId);
          if (sourceNode?.data && sourceNode.type !== 'skill' && sourceNode.type !== 'group') {
            // Update the skill node to include the source node in its contextItems
            return nodes.map((node) => {
              if (node.id === skillNodeId) {
                const contextItem = {
                  entityId: sourceNode.data.entityId,
                  type: sourceNode.type,
                  title: sourceNode.data.title || '',
                };

                // Create a new node object without using spread on potentially undefined properties
                const newNode = Object.assign({}, node);
                const newData = Object.assign({}, node.data);
                newNode.data = newData;

                if (!newData.metadata) {
                  newData.metadata = {};
                }

                // Assign the context items
                newData.metadata = Object.assign({}, newData.metadata, {
                  contextItems: [contextItem],
                });

                return newNode;
              }
              return node;
            });
          }
          return nodes;
        });
      }
    },
    [setNodes, setEdges, screenToFlowPosition, t],
  );

  return {
    onConnectStart,
    onConnectEnd,
  };
}
