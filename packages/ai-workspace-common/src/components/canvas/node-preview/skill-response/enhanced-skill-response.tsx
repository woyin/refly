import { memo, useState, useEffect, useRef } from 'react';
import { CanvasNode, ResponseNodeMeta } from '@refly/canvas-common';
import { LinearThreadContent } from '@refly-packages/ai-workspace-common/components/canvas/linear-thread/linear-thread';
import { LinearThreadMessage } from '@refly/stores';
import { cn } from '@refly/utils/cn';
import { useFindThreadHistory } from '@refly-packages/ai-workspace-common/hooks/canvas/use-find-thread-history';

import { useReactFlow } from '@xyflow/react';

interface EnhancedSkillResponseProps {
  node: CanvasNode<ResponseNodeMeta>;
  resultId: string;
  className?: string;
}

export const EnhancedSkillResponse = memo(
  ({ node, resultId, className }: EnhancedSkillResponseProps) => {
    // Thread messages state
    const [messages, setMessages] = useState<LinearThreadMessage[]>([]);
    const findThreadHistory = useFindThreadHistory();
    const { getNodes, getEdges } = useReactFlow();

    // Refs
    const retryTimeoutRef = useRef<NodeJS.Timeout>();

    // Initialize messages from resultId and its thread history with retry mechanism
    useEffect(() => {
      const initializeMessages = () => {
        if (resultId && node) {
          const nodes = getNodes();
          const edges = getEdges();

          // Check if we have enough data loaded
          if (nodes.length === 0 && edges.length === 0) {
            // Clear any existing timeout
            if (retryTimeoutRef.current) {
              clearTimeout(retryTimeoutRef.current);
            }
            // Retry after a delay
            retryTimeoutRef.current = setTimeout(initializeMessages, 500);
            return;
          }

          // Find thread history based on resultId
          const threadHistory = findThreadHistory({ resultId });

          // Initialize with empty messages array
          const initialMessages: LinearThreadMessage[] = [];

          // Check if current node is already in thread history to avoid duplication
          const isNodeInHistory = threadHistory.some((historyNode) => historyNode.id === node.id);

          // Add all history nodes to messages (and current node only if not already in history)
          const allNodes = isNodeInHistory ? threadHistory : [...threadHistory, node];

          allNodes.forEach((historyNode, index) => {
            const nodeResultId = historyNode?.data?.entityId;
            if (nodeResultId) {
              initialMessages.push({
                id: `history-${historyNode.id}-${index}`,
                resultId: nodeResultId,
                nodeId: historyNode.id,
                timestamp: Date.now() - (allNodes.length - index) * 1000, // Ensure proper ordering
                data: historyNode.data,
              });
            }
          });

          setMessages(initialMessages);
        }
      };

      initializeMessages();

      // Cleanup
      return () => {
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
      };
    }, [resultId, node, getNodes, getEdges, findThreadHistory]);

    return (
      <div
        className={cn(
          'flex flex-col h-full w-full flex-grow overflow-hidden max-w-[1024px] mx-auto',
          className,
        )}
      >
        <LinearThreadContent messages={messages} source="skillResponse" />
      </div>
    );
  },
);

EnhancedSkillResponse.displayName = 'EnhancedSkillResponse';
