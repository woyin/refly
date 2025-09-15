import {
  ActionResult,
  ActionStatus,
  CanvasData,
  CanvasEdge,
  CanvasNode,
  CanvasNodeType,
  WorkflowVariable,
} from '@refly/openapi-schema';
import { CanvasNodeFilter, ResponseNodeMeta } from './types';
import { ThreadHistoryQuery } from './history';
import { mirrorCanvasData } from './data';

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
 * Escape special regex characters in a string to be used in RegExp constructor
 */
const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Enhanced process query with workflow variables
 * - string: as before
 * - resource: return special marker for resource injection
 * - option: use defaultValue array first if value missing
 */
export const processQueryWithTypes = (
  query: string,
  variables: WorkflowVariable[] = [],
): string => {
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
    const escapedName = escapeRegExp(variable.name);
    processedQuery = processedQuery.replace(
      new RegExp(`@${escapedName}(?=\\s|$|[^\\w\\p{L}\\p{N}])`, 'gu'),
      `${stringValue}`,
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

  let newNodes: CanvasNode[] = nodes;
  let newEdges: CanvasEdge[] = edges;

  if (isNewCanvas) {
    const mirroredCanvas = mirrorCanvasData(canvasData, {
      nodeProcessor: (node) => {
        // Always clear content preview
        node.data.contentPreview = '';

        if (node.type === 'skillResponse') {
          const originalQuery = String(
            (node.data?.metadata as ResponseNodeMeta)?.structuredData?.query ??
              node.data?.title ??
              '',
          );
          node.data.title = processQueryWithTypes(originalQuery, variables);
        }

        return node;
      },
    });

    newNodes = mirroredCanvas.nodes;
    newEdges = mirroredCanvas.edges;
  } else {
    // Process skillResponse nodes with variables
    newNodes = nodes.map((node) => {
      if (node.type === 'skillResponse') {
        const originalQuery = String(
          (node.data?.metadata as ResponseNodeMeta)?.structuredData?.query ??
            node.data?.title ??
            '',
        );
        node.data.title = processQueryWithTypes(originalQuery, variables);
      }
      return node;
    });
  }

  const { nodeMap, parentMap, childMap } = buildNodeRelationships(newNodes, newEdges);

  // If new canvas mode, ignore provided start nodes
  const startNodes = isNewCanvas
    ? []
    : (params.startNodes?.map((sid) => nodeMap.get(sid)?.id ?? sid) ?? []);
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
      const metadata = node.data?.metadata ?? {};
      const { contextItems = [] } = metadata as ResponseNodeMeta;

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
