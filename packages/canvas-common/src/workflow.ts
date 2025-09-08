import {
  ActionStatus,
  CanvasData,
  CanvasNode,
  CanvasNodeType,
  EntityType,
  InvokeSkillRequest,
  WorkflowVariable,
} from '@refly/openapi-schema';
import deepmerge from 'deepmerge';
import { genNodeEntityId, genNodeID } from '@refly/utils';
import { IContextItem } from '@refly/common-types';
import { convertContextItemsToInvokeParams } from './context';
import { findThreadHistory } from './history';
import { CanvasNodeFilter, ResponseNodeMeta } from './types';

export interface WorkflowNode {
  canvasId: string;
  nodeId: string;
  nodeType: CanvasNodeType;
  node: CanvasNode;
  entityId: string;
  title: string;
  status: ActionStatus;
  processedQuery: string;
  originalQuery: string;
  connectTo: CanvasNodeFilter[];
  parentNodeIds: string[];
  childNodeIds: string[];
  sourceNodeId: string;
  sourceEntityId: string;
  invokeReq?: InvokeSkillRequest;
}

/**
 * Enhanced process query with workflow variables
 * - string: as before
 * - resource: return special marker for resource injection
 * - option: use defaultValue array first if value missing
 */
export const processQueryWithTypes = (query: string, variables: WorkflowVariable[] = []) => {
  if (!query || !variables.length) {
    return query;
  }

  let processedQuery = query;

  for (const variable of variables) {
    const values = variable.value;

    if (variable.variableType === 'resource') {
      continue;
    }

    // string/option: extract text values from VariableValue array
    const textValues =
      values
        ?.filter((v) => v.type === 'text' && v.text)
        .map((v) => v.text)
        .filter(Boolean) ?? [];

    const stringValue = textValues.length > 0 ? textValues.join(', ') : '';
    processedQuery = processedQuery.replace(
      new RegExp(`@${variable.name}\\s`, 'g'),
      `${stringValue} `,
    );
  }
  return processedQuery;
};

// Helper function to find all nodes in the subtree starting from given start nodes
const findSubtreeNodes = (startNodeIds: string[], childMap: Map<string, string[]>): Set<string> => {
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

/**
 * Prepare node executions for a workflow execution
 * @param params - Parameters for preparing node executions
 * @returns Node executions and start nodes
 */
export const prepareNodeExecutions = (params: {
  executionId: string;
  canvasId: string;
  canvasData: CanvasData;
  variables: WorkflowVariable[];
  startNodes?: string[];
  isNewCanvas?: boolean;
}): { nodeExecutions: WorkflowNode[]; startNodes: string[] } => {
  const { canvasId, canvasData, variables, isNewCanvas = false } = params;
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

  // If new canvas mode, ignore provided start nodes
  const startNodes = isNewCanvas ? [] : (params.startNodes ?? []);
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

  // Determine which nodes should be in 'waiting' status
  const subtreeNodes = findSubtreeNodes(startNodes, childMap);

  // When running in new canvas mode, create a consistent id map from old -> new
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
    const entityId = node.data?.entityId;

    if (entityId) {
      const targetEntityId = isNewCanvas ? genNodeEntityId(node.type) : entityId;
      entityMap.set(entityId, targetEntityId);
    }
  }

  // Create node execution records
  const nodeExecutions: WorkflowNode[] = [];
  for (const node of nodes) {
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

    const metadata = (node.data?.metadata as ResponseNodeMeta) ?? {};
    let { contextItems = [] } = metadata;
    const { modelInfo, selectedToolsets } = metadata;

    if (isNewCanvas && node.type === 'skillResponse') {
      const originalContextItems: IContextItem[] = contextItems;
      const replacedContextItems = originalContextItems.map((item) => {
        if (item.entityId) {
          item.entityId = entityMap.get(item.entityId) ?? item.entityId;
        }
        return item;
      });
      contextItems = replacedContextItems;
      nodeForData.data = deepmerge(nodeForData.data, {
        metadata: { contextItems: replacedContextItems },
      });
    }

    // Set status based on whether the node is in the subtree (computed with original ids)
    const status = subtreeNodes.has(node.id) ? 'waiting' : 'finish';

    // Map relationship ids to the new ids when in new canvas mode
    const mappedParentIds = (parents || []).map((pid) => nodeIdMap.get(pid) ?? pid);
    const mappedChildIds = (children || []).map((cid) => nodeIdMap.get(cid) ?? cid);

    const originalQuery = String(metadata?.structuredData?.query ?? node.data?.title ?? '');
    const processedQuery = processQueryWithTypes(originalQuery, variables);

    // Build connection filters based on parent entity IDs
    const connectTo: CanvasNodeFilter[] = parents
      .map((pid) => {
        const node = nodeMap.get(pid);
        return {
          type: node?.type as CanvasNodeType,
          entityId: entityMap.get(node?.data?.entityId ?? '') ?? '',
          handleType: 'source' as const,
        };
      })
      .filter((f) => f.type && f.entityId);

    const { context, resultHistory, images } = convertContextItemsToInvokeParams(contextItems, () =>
      findThreadHistory({
        resultId: targetEntityId,
        nodes: nodes.map((node) => ({ ...node, id: nodeIdMap.get(node.id) ?? node.id })),
        edges: edges.map((edge) => ({
          ...edge,
          source: nodeIdMap.get(edge.source) ?? edge.source,
          target: nodeIdMap.get(edge.target) ?? edge.target,
        })),
      }).map((node) => ({
        title: String(node.data?.title),
        resultId: String(node.data?.entityId),
      })),
    );

    // Prepare the invoke skill request
    const invokeRequest: InvokeSkillRequest = {
      resultId: targetEntityId,
      input: {
        query: processedQuery, // Use processed query for skill execution
        originalQuery, // Pass original query separately
        images,
      },
      target: {
        entityType: 'canvas' as EntityType,
        entityId: canvasId,
      },
      modelName: modelInfo?.name,
      modelItemId: modelInfo?.providerItemId,
      context,
      resultHistory,
      toolsets: selectedToolsets,
    };

    const nodeExecution: WorkflowNode = {
      canvasId,
      nodeId: targetNodeId,
      nodeType: node.type,
      node: nodeForData,
      entityId: targetEntityId,
      title: node.data?.title ?? '',
      status,
      processedQuery,
      originalQuery,
      invokeReq: invokeRequest,
      connectTo: connectTo,
      parentNodeIds: mappedParentIds,
      childNodeIds: mappedChildIds,
      sourceNodeId: node.id, // Store the source node ID for new canvas mode
      sourceEntityId,
    };

    nodeExecutions.push(nodeExecution);
  }

  // Start nodes should be mapped to new ids in new canvas mode
  const mappedStartNodes = startNodes.map((sid) => nodeIdMap.get(sid) ?? sid);

  return { nodeExecutions, startNodes: mappedStartNodes };
};

/**
 * Pick ready-to-run child nodes in a single pass using in-memory evaluation.
 */
export const pickReadyChildNodes = (
  childNodeIds: string[],
  allNodes: Pick<WorkflowNode, 'nodeId' | 'parentNodeIds' | 'status'>[],
): string[] => {
  const nodeById = new Map(allNodes.map((n) => [n.nodeId, n]));
  const ready: string[] = [];

  for (const childId of childNodeIds) {
    const node = nodeById.get(childId);
    if (!node) continue;

    const parents = node.parentNodeIds.filter(Boolean);
    const allParentsFinished =
      parents.length === 0 || parents.every((pid) => nodeById.get(pid)?.status === 'finish');

    if (allParentsFinished && node.status === 'waiting') {
      ready.push(childId);
    }
  }

  return ready;
};
