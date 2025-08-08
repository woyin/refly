import { memo, useMemo, useCallback } from 'react';
import { Tree, Typography, Button, Tooltip } from 'antd';
import { CanvasNode } from '@refly/canvas-common';
import { useTranslation } from 'react-i18next';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';
import { EventDataNode } from 'antd/es/tree';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { NodeIcon } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/node-icon';
import { Location, Delete } from 'refly-icons';
import { useReactFlow } from '@xyflow/react';
import { useNodePosition } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-position';
import { useDeleteNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-delete-node';

const { Text } = Typography;

interface TreeNode {
  key: string;
  title: React.ReactNode;
  children?: TreeNode[];
  nodeType: 'skillResponse' | 'group';
  nodeData: CanvasNode;
  icon?: React.ReactNode;
}

const StepTitle = memo(({ title }: { title?: string }) => {
  const { t } = useTranslation();
  return (
    <Text ellipsis={{ tooltip: { placement: 'right' } }} className="block flex-1 min-w-0 truncate">
      {title || t('common.untitled')}
    </Text>
  );
});

interface StepRowTitleProps {
  node: CanvasNode;
  isActive: boolean;
  onLocate: (node: CanvasNode) => void;
  onDelete: (node: CanvasNode) => void;
}

const StepRowTitle = memo(({ node, isActive, onLocate, onDelete }: StepRowTitleProps) => {
  const { t } = useTranslation();
  return (
    <div className="w-full flex items-center justify-between gap-2">
      <Text
        ellipsis={{ tooltip: { placement: 'right' } }}
        className={`block flex-1 min-w-0 truncate ${isActive ? 'font-semibold' : ''}`}
      >
        {node?.data?.title || t('common.untitled')}{' '}
      </Text>
      <div className="steps-row-actions flex items-center gap-1 opacity-0 transition-opacity flex-shrink-0">
        <Tooltip title={t('canvas.nodeActions.centerNode')} arrow={false}>
          <Button
            type="text"
            size="small"
            icon={<Location size={16} />}
            onClick={(e) => {
              e.stopPropagation();
              onLocate(node);
            }}
          />
        </Tooltip>
        <Tooltip title={t('common.delete')} arrow={false}>
          <Button
            type="text"
            size="small"
            icon={<Delete size={16} />}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node);
            }}
          />
        </Tooltip>
      </div>
    </div>
  );
});

export const StepList = memo(() => {
  const { nodes, nodesSignature } = useRealtimeCanvasData();
  const { setParentType, setActiveNode, activeNode } = useCanvasResourcesPanelStoreShallow(
    (state) => ({
      setParentType: state.setParentType,
      setActiveNode: state.setActiveNode,
      activeNode: state.activeNode,
    }),
  );
  const { setNodeCenter } = useNodePosition();
  const { getNodes } = useReactFlow();
  const { deleteNode } = useDeleteNode();

  const handleLocateNode = (node: CanvasNode) => {
    if (node?.type === 'group') {
      return;
    }
    const nodes = getNodes();
    const foundNode = nodes.find((n) => n.data?.entityId === node.data?.entityId);
    if (foundNode) {
      setNodeCenter(foundNode.id, true);
    }
  };

  const handleDeleteNode = useCallback(
    (node: CanvasNode) => {
      if (!node?.id) {
        return;
      }
      deleteNode({
        id: node.id,
        type: node.type,
        data: node.data,
        position: node.position ?? { x: 0, y: 0 },
      } as CanvasNode);
      if (activeNode?.id === node.id) {
        setActiveNode(null);
      }
    },
    [activeNode?.id, deleteNode, setActiveNode],
  );

  // Transform nodes into tree structure
  const treeData = useMemo(() => {
    if (!nodes?.length) {
      return [];
    }

    // Filter nodes by type
    const skillResponseNodes = nodes.filter((node) => node.type === 'skillResponse');
    const groupNodes = nodes.filter((node) => node.type === 'group');

    // Create a map for quick lookup
    const nodeMap = new Map<string, CanvasNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    // Build tree structure
    const treeNodes: TreeNode[] = [];

    // Helper to check if a node is a (direct or indirect) child of a group
    const isDescendantOfGroup = (node: CanvasNode, groupId: string): boolean => {
      let currentParentId: string | undefined = node.parentId as string | undefined;
      const visited = new Set<string>();
      while (currentParentId && !visited.has(currentParentId)) {
        visited.add(currentParentId);
        if (currentParentId === groupId) return true;
        const parentNode = nodeMap.get(currentParentId);
        if (!parentNode) break;
        currentParentId = parentNode.parentId as string | undefined;
      }
      return false;
    };

    // Process group nodes first
    for (const groupNode of groupNodes) {
      const groupTreeNode: TreeNode = {
        key: groupNode.id,
        title: <StepTitle title={groupNode.data?.title} />,
        nodeType: 'group',
        nodeData: groupNode,
        children: [],
        icon: <NodeIcon type="group" small />,
      };

      // Find skillResponse nodes that belong to this group (directly or indirectly)
      const childSkillResponses = skillResponseNodes.filter((skillNode) =>
        isDescendantOfGroup(skillNode, groupNode.id),
      );

      // Add skillResponse nodes as children
      for (const skillNode of childSkillResponses) {
        groupTreeNode.children?.push({
          key: skillNode.id,
          title: (
            <StepRowTitle
              node={skillNode}
              isActive={activeNode?.id === skillNode.id}
              onLocate={handleLocateNode}
              onDelete={handleDeleteNode}
            />
          ),
          nodeType: 'skillResponse',
          nodeData: skillNode,
          icon: <NodeIcon type="skillResponse" small />,
        });
      }

      treeNodes.push(groupTreeNode);
    }

    // Add skillResponse nodes that don't belong to any group (by ancestry)
    const orphanedSkillResponses = skillResponseNodes.filter((skillNode) => {
      // If it belongs to any group, skip
      return !groupNodes.some((groupNode) => isDescendantOfGroup(skillNode, groupNode.id));
    });

    for (const skillNode of orphanedSkillResponses) {
      treeNodes.push({
        key: skillNode.id,
        title: (
          <StepRowTitle
            node={skillNode}
            isActive={activeNode?.id === skillNode.id}
            onLocate={handleLocateNode}
            onDelete={handleDeleteNode}
          />
        ),
        nodeType: 'skillResponse',
        nodeData: skillNode,
        icon: <NodeIcon type="skillResponse" small />,
      });
    }

    return treeNodes;
  }, [nodes, nodesSignature, activeNode?.id]);

  const handleNodeSelect = (
    _: React.Key[],
    info: {
      node: EventDataNode<TreeNode>;
    },
  ) => {
    const node = info.node.nodeData;

    if (node.type === 'group') {
      return;
    }

    setParentType('stepsRecord');
    setActiveNode(node);
  };

  return (
    <div className="step-list h-full">
      <Tree
        key={nodesSignature}
        treeData={treeData}
        onSelect={handleNodeSelect}
        blockNode
        defaultExpandAll
        autoExpandParent
        showIcon={true}
        switcherIcon={null}
        className="steps-tree"
        selectedKeys={[activeNode?.id]}
      />
    </div>
  );
});

StepList.displayName = 'StepList';
