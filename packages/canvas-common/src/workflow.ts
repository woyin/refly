import {
  ActionResult,
  ActionStatus,
  CanvasData,
  CanvasEdge,
  CanvasNode,
  CanvasNodeType,
  WorkflowVariable,
} from '@refly/openapi-schema';
import { genNodeEntityId, genNodeID, deepmerge } from '@refly/utils';
import { IContextItem } from '@refly/common-types';
import { CanvasNodeFilter, ResponseNodeMeta } from './types';
import { ThreadHistoryQuery } from './history';

export interface WorkflowNode {
  nodeId: string;
  nodeType: CanvasNodeType;
  node: CanvasNode;
  entityId: string;
  title: string;
  status: ActionStatus;
  connectTo: CanvasNodeFilter[];
  parentNodeIds: string[];
  childNodeIds: string[];

  // only for skillResponse nodes
  processedQuery?: string;
  originalQuery?: string;
  resultHistory?: ActionResult[];
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

const buildNodeRelationships = (nodes: CanvasNode[], edges: CanvasEdge[]) => {
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

  return { nodeMap, parentMap, childMap };
};

/**
 * Prepare node executions for a workflow execution
 * @param params - Parameters for preparing node executions
 * @returns Node executions and start nodes
 */
export const prepareNodeExecutions = (params: {
  executionId: string;
  canvasData: CanvasData;
  variables: WorkflowVariable[];
  startNodes?: string[];
  isNewCanvas?: boolean;
}): { nodeExecutions: WorkflowNode[]; startNodes: string[] } => {
  const { canvasData, variables, isNewCanvas = false } = params;
  const { nodes, edges } = canvasData;

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

  // Build map from old entity id to new entity id
  const entityIdMap = new Map<string, string>(); // old entity id -> new entity id
  for (const node of nodes) {
    const entityId = node.data?.entityId;

    if (entityId) {
      const targetEntityId = isNewCanvas ? genNodeEntityId(node.type) : entityId;
      entityIdMap.set(entityId, targetEntityId);
    }
  }

  // Build new nodes
  const newNodes: CanvasNode[] = [];
  const entityMap = new Map<string, IContextItem>();

  for (const node of nodes) {
    const targetNodeId = isNewCanvas ? nodeIdMap.get(node.id) : node.id;
    const sourceEntityId = node.data?.entityId ?? '';
    const targetEntityId = entityIdMap.get(sourceEntityId) ?? sourceEntityId;

    const newNode: CanvasNode = isNewCanvas
      ? deepmerge(
          { ...node },
          {
            id: targetNodeId,
            data: { entityId: targetEntityId, contentPreview: '' },
          },
        )
      : { ...node };

    if (node.type === 'skillResponse') {
      const originalQuery = String(
        (node.data?.metadata as ResponseNodeMeta)?.structuredData?.query ?? node.data?.title ?? '',
      );
      newNode.data.title = processQueryWithTypes(originalQuery, variables);
    }

    entityMap.set(sourceEntityId, {
      title: newNode.data?.title ?? '',
      entityId: targetEntityId,
      type: newNode.type,
    });

    newNodes.push(newNode);
  }

  const newEdges = edges.map((edge) => ({
    ...edge,
    source: nodeIdMap.get(edge.source) ?? edge.source,
    target: nodeIdMap.get(edge.target) ?? edge.target,
  }));

  const { nodeMap, parentMap, childMap } = buildNodeRelationships(newNodes, newEdges);

  // If new canvas mode, ignore provided start nodes
  const startNodes = isNewCanvas
    ? []
    : (params.startNodes?.map((sid) => nodeIdMap.get(sid) ?? sid) ?? []);
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

  const historyQuery = new ThreadHistoryQuery(newNodes, newEdges);

  // Create node execution records
  const nodeExecutions: WorkflowNode[] = [];
  for (const node of newNodes) {
    const parents = parentMap.get(node.id) || [];
    const children = childMap.get(node.id) || [];

    const metadata = node.data?.metadata ?? {};
    let { contextItems = [] } = metadata as ResponseNodeMeta;

    if (node.type === 'skillResponse') {
      contextItems = contextItems.map((item) => {
        return {
          ...item,
          ...entityMap.get(item.entityId),
        };
      });
      node.data = deepmerge(node.data, {
        metadata: { contextItems },
      });
    }

    // Set status based on whether the node is in the subtree (computed with original ids)
    const status = subtreeNodes.has(node.id) ? 'waiting' : 'finish';

    // Build connection filters based on parent entity IDs
    const connectTo: CanvasNodeFilter[] = parents
      .map((pid) => {
        const node = nodeMap.get(pid);
        return {
          type: node?.type as CanvasNodeType,
          entityId: node?.data?.entityId ?? '',
          handleType: 'source' as const,
        };
      })
      .filter((f) => f.type && f.entityId);

    const nodeExecution: WorkflowNode = {
      nodeId: node.id,
      nodeType: node.type,
      node,
      entityId: node.data?.entityId ?? '',
      title: node.data?.editedTitle ?? node.data?.title ?? '',
      status,
      connectTo,
      parentNodeIds: parents,
      childNodeIds: children,
    };

    if (node.type === 'skillResponse') {
      const resultHistory = contextItems
        .filter((item) => item.type === 'skillResponse' && item.metadata?.withHistory)
        .flatMap((item) =>
          historyQuery.findThreadHistory({ resultId: item.entityId }).map((node) => ({
            title: String(node.data?.title),
            resultId: String(node.data?.entityId),
          })),
        );

      nodeExecution.originalQuery =
        String((node.data?.metadata as ResponseNodeMeta)?.structuredData?.query ?? '') ??
        node.data?.title ??
        '';
      nodeExecution.processedQuery = node?.data.title;
      nodeExecution.resultHistory = resultHistory;
    }

    nodeExecutions.push(nodeExecution);
  }

  return { nodeExecutions, startNodes };
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
