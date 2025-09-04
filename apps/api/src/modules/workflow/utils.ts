import { CanvasData, CanvasNode } from '@refly/openapi-schema';
import deepmerge from 'deepmerge';
import { Prisma } from '../../generated/client';
import { genNodeEntityId, genNodeID, genWorkflowNodeExecutionID } from '@refly/utils';
import { IContextItem } from '@refly/common-types';

export const prepareNodeExecutions = (
  executionId: string,
  canvasData: CanvasData,
  options: { startNodes?: string[]; isNewCanvas?: boolean },
): { nodeExecutions: Prisma.WorkflowNodeExecutionCreateManyInput[]; startNodes: string[] } => {
  const { nodes, edges } = canvasData;

  // Build node relationships
  const nodeMap = new Map<string, CanvasNode>();
  const parentMap = new Map<string, string[]>();
  const childMap = new Map<string, string[]>();

  // Initialize maps
  for (const node of nodes) {
    nodeMap.set(node.id, node);
    parentMap.set(node.id, []);
    childMap.set(node.id, []);
  }

  // Build relationships from edges
  for (const edge of edges || []) {
    const sourceId = edge.source;
    const targetId = edge.target;

    if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
      // Add target as child of source
      const sourceChildren = childMap.get(sourceId) || [];
      sourceChildren.push(targetId);
      childMap.set(sourceId, sourceChildren);

      // Add source as parent of target
      const targetParents = parentMap.get(targetId) || [];
      targetParents.push(sourceId);
      parentMap.set(targetId, targetParents);
    }
  }

  const startNodes = options?.startNodes || [];
  if (startNodes.length === 0) {
    for (const [nodeId, parents] of parentMap) {
      if (parents.length === 0) {
        startNodes.push(nodeId);
      }
    }
  }

  if (startNodes.length === 0) {
    return { nodeExecutions: [], startNodes };
  }

  // Helper function to find all nodes in the subtree starting from given start nodes
  const findSubtreeNodes = (startNodeIds: string[]): Set<string> => {
    const subtreeNodes = new Set<string>();
    const queue = [...startNodeIds];

    while (queue.length > 0) {
      const currentNodeId = queue.shift()!;
      if (!subtreeNodes.has(currentNodeId)) {
        subtreeNodes.add(currentNodeId);
        // Add all children to the queue
        const children = childMap.get(currentNodeId) || [];
        queue.push(...children);
      }
    }

    return subtreeNodes;
  };

  // Determine which nodes should be in 'waiting' status
  const subtreeNodes = findSubtreeNodes(startNodes);

  // When running in new canvas mode, create a consistent id map from old -> new
  const isNewCanvas = options?.isNewCanvas ?? false;
  const nodeIdMap = new Map<string, string>();
  if (isNewCanvas) {
    for (const node of nodes) {
      nodeIdMap.set(node.id, genNodeID());
    }
  } else {
    for (const node of nodes) {
      nodeIdMap.set(node.id, node.id);
    }
  }

  const entityMap = new Map<string, string>(); // old entity id -> new entity id
  for (const node of nodes) {
    const sourceEntityId = node.data?.entityId ?? '';
    const targetEntityId = isNewCanvas
      ? genNodeEntityId(node.type)
      : (nodeIdMap.get(node.id) ?? node.id);
    entityMap.set(sourceEntityId, targetEntityId);
  }

  // Create node execution records
  const nodeExecutions: Prisma.WorkflowNodeExecutionCreateManyInput[] = [];
  for (const node of nodes) {
    const nodeExecutionId = genWorkflowNodeExecutionID();
    const parents = parentMap.get(node.id) || [];
    const children = childMap.get(node.id) || [];

    // Resolve target/new node id
    const targetNodeId = nodeIdMap.get(node.id) ?? node.id;
    const sourceEntityId = node.data?.entityId ?? '';
    const targetEntityId = entityMap.get(sourceEntityId) ?? sourceEntityId;

    // Clone node for storage in nodeData, replacing id when in new canvas mode
    const nodeForData: CanvasNode = isNewCanvas
      ? deepmerge(
          { ...node },
          {
            id: targetNodeId,
            data: { entityId: targetEntityId },
          },
        )
      : { ...node };

    // NOTE: If additional transformation of context is needed in new canvas mode,
    // it should be handled here without mutating the original node.

    if (isNewCanvas && node.type === 'skillResponse') {
      const originalContextItems: IContextItem[] =
        (node.data?.metadata?.contextItems as IContextItem[]) || [];
      const replacedContextItems = originalContextItems.map((item) => {
        if (item.entityId) {
          item.entityId = entityMap.get(item.entityId) ?? item.entityId;
        }
        return item;
      });
      nodeForData.data.metadata.contextItems = replacedContextItems;
    }

    // Set status based on whether the node is in the subtree (computed with original ids)
    const status = subtreeNodes.has(node.id) ? 'waiting' : 'finish';

    // Map relationship ids to the new ids when in new canvas mode
    const mappedParentIds = (parents || []).map((pid) => nodeIdMap.get(pid) ?? pid);
    const mappedChildIds = (children || []).map((cid) => nodeIdMap.get(cid) ?? cid);

    const nodeExecution: Prisma.WorkflowNodeExecutionCreateManyInput = {
      nodeExecutionId,
      executionId,
      nodeId: targetNodeId,
      nodeType: node.type,
      nodeData: JSON.stringify(nodeForData),
      entityId: targetEntityId,
      title: node.data?.title ?? '',
      status,
      processedQuery: '', // TODO: set processed query
      originalQuery: '', // TODO: set original query
      connectTo: '[]', // TODO: set connect to
      parentNodeIds: JSON.stringify(mappedParentIds),
      childNodeIds: JSON.stringify(mappedChildIds),
      sourceNodeId: node.id, // Store the source node ID for new canvas mode
      sourceEntityId, // Store the source entity ID for new canvas mode
    };

    nodeExecutions.push(nodeExecution);
  }

  // Start nodes should be mapped to new ids in new canvas mode
  const mappedStartNodes = startNodes.map((sid) => nodeIdMap.get(sid) ?? sid);

  return { nodeExecutions, startNodes: mappedStartNodes };
};
