import { memo, useMemo } from 'react';
import { Tree, Typography } from 'antd';
import { AiChat, Group } from 'refly-icons';
import { CanvasNode } from '@refly/canvas-common';
import { useTranslation } from 'react-i18next';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';
import { EventDataNode } from 'antd/es/tree';
import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';

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
    <Text ellipsis={{ tooltip: { placement: 'right' } }} style={{ width: 250 }}>
      {title || t('common.untitled')}
    </Text>
  );
});

export const StepList = memo(() => {
  const { nodes } = useRealtimeCanvasData();
  const { setParentType, setActiveNode } = useCanvasResourcesPanelStoreShallow((state) => ({
    setParentType: state.setParentType,
    setActiveNode: state.setActiveNode,
  }));

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

    // Process group nodes first
    for (const groupNode of groupNodes) {
      const groupTreeNode: TreeNode = {
        key: groupNode.id,
        title: <StepTitle title={groupNode.data?.title} />,
        nodeType: 'group',
        nodeData: groupNode,
        children: [],
        icon: <Group className="text-gray-500" size={16} />,
      };

      // Find skillResponse nodes that belong to this group
      const childSkillResponses = skillResponseNodes.filter(
        (skillNode) => skillNode.parentId === groupNode.id,
      );

      // Add skillResponse nodes as children
      for (const skillNode of childSkillResponses) {
        groupTreeNode.children?.push({
          key: skillNode.id,
          title: <StepTitle title={skillNode.data?.title} />,
          nodeType: 'skillResponse',
          nodeData: skillNode,
          icon: <AiChat className="text-blue-500" size={16} />,
        });
      }

      treeNodes.push(groupTreeNode);
    }

    // Add skillResponse nodes that don't have a parent group
    const orphanedSkillResponses = skillResponseNodes.filter(
      (skillNode) => !skillNode.parentId || !nodeMap.has(skillNode.parentId),
    );

    for (const skillNode of orphanedSkillResponses) {
      treeNodes.push({
        key: skillNode.id,
        title: <StepTitle title={skillNode.data?.title} />,
        nodeType: 'skillResponse',
        nodeData: skillNode,
        icon: <AiChat className="text-blue-500" size={16} />,
      });
    }

    return treeNodes;
  }, [nodes]);

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
    <div className="pt-4 h-full">
      <Tree
        treeData={treeData}
        onSelect={handleNodeSelect}
        blockNode
        defaultExpandAll
        autoExpandParent
        showIcon={true}
        className="steps-tree [&_.ant-tree-node-content-wrapper]:py-2 [&_.ant-tree-node-content-wrapper]:min-h-[40px] [&_.ant-tree-node-content-wrapper]:flex [&_.ant-tree-node-content-wrapper]:items-center"
      />
    </div>
  );
});

StepList.displayName = 'StepList';
