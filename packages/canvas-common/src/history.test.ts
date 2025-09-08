import { describe, it, expect } from 'vitest';
import { findThreadHistory } from './history';
import type { Node, Edge } from '@xyflow/react';

// Helper to create a skillResponse node
const createSkillResponseNode = (id: string, entityId?: string): Node => ({
  id,
  type: 'skillResponse',
  position: { x: 0, y: 0 },
  data: { entityId: entityId ?? id },
});

// Helper to create a non-skillResponse node
const createOtherNode = (id: string, type = 'document'): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { entityId: id },
});

// Helper to create an edge
const createEdge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
  type: 'default',
});

describe('findThreadHistory', () => {
  describe('Basic functionality', () => {
    it('should return empty array when no startNode and no resultId provided', () => {
      const nodes: Node[] = [];
      const edges: Edge[] = [];

      const result = findThreadHistory({
        nodes,
        edges,
      });

      expect(result).toEqual([]);
    });

    it('should return empty array when resultId is provided but no matching node found', () => {
      const nodes = [createSkillResponseNode('node1')];
      const edges: Edge[] = [];

      const result = findThreadHistory({
        resultId: 'nonexistent',
        nodes,
        edges,
      });

      expect(result).toEqual([]);
    });

    it('should return empty array when startNode is not a skillResponse type', () => {
      const startNode = createOtherNode('node1');
      const nodes = [startNode];
      const edges: Edge[] = [];

      const result = findThreadHistory({
        startNode,
        nodes,
        edges,
      });

      expect(result).toEqual([]);
    });

    it('should return single node when no edges exist', () => {
      const startNode = createSkillResponseNode('node1');
      const nodes = [startNode];
      const edges: Edge[] = [];

      const result = findThreadHistory({
        startNode,
        nodes,
        edges,
      });

      expect(result).toEqual([startNode]);
    });

    it('should find startNode by resultId when startNode is not provided', () => {
      const node1 = createSkillResponseNode('node1', 'entity1');
      const nodes = [node1];
      const edges: Edge[] = [];

      const result = findThreadHistory({
        resultId: 'entity1',
        nodes,
        edges,
      });

      expect(result).toEqual([node1]);
    });
  });

  describe('Thread traversal', () => {
    it('should traverse a simple chain of skillResponse nodes', () => {
      const node1 = createSkillResponseNode('node1');
      const node2 = createSkillResponseNode('node2');
      const node3 = createSkillResponseNode('node3');
      const nodes = [node1, node2, node3];
      const edges = [
        createEdge('edge1', 'node1', 'node2'), // node1 -> node2
        createEdge('edge2', 'node2', 'node3'), // node2 -> node3
      ];

      const result = findThreadHistory({
        startNode: node3,
        nodes,
        edges,
      });

      // Should return nodes in reverse order (oldest to newest)
      expect(result).toEqual([node1, node2, node3]);
    });

    it('should handle multiple incoming edges to the same node', () => {
      const node1 = createSkillResponseNode('node1');
      const node2 = createSkillResponseNode('node2');
      const node3 = createSkillResponseNode('node3');
      const node4 = createSkillResponseNode('node4');
      const nodes = [node1, node2, node3, node4];
      const edges = [
        createEdge('edge1', 'node1', 'node2'), // node1 -> node2
        createEdge('edge2', 'node1', 'node3'), // node1 -> node3
        createEdge('edge3', 'node2', 'node4'), // node2 -> node4
        createEdge('edge4', 'node3', 'node4'), // node3 -> node4
      ];

      const result = findThreadHistory({
        startNode: node4,
        nodes,
        edges,
      });

      // Should include all connected skillResponse nodes
      expect(result).toHaveLength(4);
      expect(result).toContainEqual(node1);
      expect(result).toContainEqual(node2);
      expect(result).toContainEqual(node3);
      expect(result).toContainEqual(node4);
    });

    it('should ignore non-skillResponse nodes in traversal', () => {
      const node1 = createSkillResponseNode('node1');
      const node2 = createOtherNode('node2', 'document');
      const node3 = createSkillResponseNode('node3');
      const nodes = [node1, node2, node3];
      const edges = [
        createEdge('edge1', 'node1', 'node2'), // node1 -> node2 (document)
        createEdge('edge2', 'node2', 'node3'), // node2 (document) -> node3
      ];

      const result = findThreadHistory({
        startNode: node3,
        nodes,
        edges,
      });

      // The function only traverses through skillResponse nodes, so it won't find node1
      // because it can't traverse through the document node
      expect(result).toEqual([node3]);
    });

    it('should handle complex branching structure', () => {
      const node1 = createSkillResponseNode('node1');
      const node2 = createSkillResponseNode('node2');
      const node3 = createSkillResponseNode('node3');
      const node4 = createSkillResponseNode('node4');
      const node5 = createSkillResponseNode('node5');
      const nodes = [node1, node2, node3, node4, node5];
      const edges = [
        createEdge('edge1', 'node1', 'node2'), // node1 -> node2
        createEdge('edge2', 'node1', 'node3'), // node1 -> node3
        createEdge('edge3', 'node2', 'node4'), // node2 -> node4
        createEdge('edge4', 'node3', 'node5'), // node3 -> node5
      ];

      const result = findThreadHistory({
        startNode: node4,
        nodes,
        edges,
      });

      // Should include node1, node2, and node4
      expect(result).toHaveLength(3);
      expect(result).toContainEqual(node1);
      expect(result).toContainEqual(node2);
      expect(result).toContainEqual(node4);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle circular dependencies without infinite loops', () => {
      const node1 = createSkillResponseNode('node1');
      const node2 = createSkillResponseNode('node2');
      const nodes = [node1, node2];
      const edges = [
        createEdge('edge1', 'node1', 'node2'), // node1 -> node2
        createEdge('edge2', 'node2', 'node1'), // node2 -> node1 (circular)
      ];

      const result = findThreadHistory({
        startNode: node1,
        nodes,
        edges,
      });

      // Should not cause infinite loop and should include both nodes
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(node1);
      expect(result).toContainEqual(node2);
    });

    it('should handle missing source nodes in edges', () => {
      const node1 = createSkillResponseNode('node1');
      const nodes = [node1];
      const edges = [
        createEdge('edge1', 'nonexistent', 'node1'), // nonexistent -> node1
      ];

      const result = findThreadHistory({
        startNode: node1,
        nodes,
        edges,
      });

      // Should still work and return the start node
      expect(result).toEqual([node1]);
    });

    it('should handle missing target nodes in edges', () => {
      const node1 = createSkillResponseNode('node1');
      const nodes = [node1];
      const edges = [
        createEdge('edge1', 'node1', 'nonexistent'), // node1 -> nonexistent
      ];

      const result = findThreadHistory({
        startNode: node1,
        nodes,
        edges,
      });

      // Should still work and return the start node
      expect(result).toEqual([node1]);
    });

    it('should handle empty nodes array', () => {
      const nodes: Node[] = [];
      const edges: Edge[] = [];

      const result = findThreadHistory({
        resultId: 'test',
        nodes,
        edges,
      });

      expect(result).toEqual([]);
    });

    it('should handle empty edges array', () => {
      const startNode = createSkillResponseNode('node1');
      const nodes = [startNode];
      const edges: Edge[] = [];

      const result = findThreadHistory({
        startNode,
        nodes,
        edges,
      });

      expect(result).toEqual([startNode]);
    });

    it('should handle duplicate nodes in history', () => {
      const node1 = createSkillResponseNode('node1');
      const node2 = createSkillResponseNode('node2');
      const nodes = [node1, node2];
      const edges = [
        createEdge('edge1', 'node1', 'node2'),
        createEdge('edge2', 'node2', 'node1'), // This would create a cycle
      ];

      const result = findThreadHistory({
        startNode: node1,
        nodes,
        edges,
      });

      // Should not include duplicate nodes
      const uniqueIds = new Set(result.map((node) => node.id));
      expect(uniqueIds.size).toBe(result.length);
    });
  });

  describe('Ordering and structure', () => {
    it('should return nodes in reverse order (oldest to newest)', () => {
      const node1 = createSkillResponseNode('node1');
      const node2 = createSkillResponseNode('node2');
      const node3 = createSkillResponseNode('node3');
      const nodes = [node1, node2, node3];
      const edges = [
        createEdge('edge1', 'node1', 'node2'), // node1 -> node2
        createEdge('edge2', 'node2', 'node3'), // node2 -> node3
      ];

      const result = findThreadHistory({
        startNode: node3,
        nodes,
        edges,
      });

      // Should be in order: node1 (oldest), node2, node3 (newest)
      expect(result[0]).toEqual(node1);
      expect(result[1]).toEqual(node2);
      expect(result[2]).toEqual(node3);
    });

    it('should maintain consistent ordering for complex graphs', () => {
      const node1 = createSkillResponseNode('node1');
      const node2 = createSkillResponseNode('node2');
      const node3 = createSkillResponseNode('node3');
      const node4 = createSkillResponseNode('node4');
      const nodes = [node1, node2, node3, node4];
      const edges = [
        createEdge('edge1', 'node1', 'node2'), // node1 -> node2
        createEdge('edge2', 'node1', 'node3'), // node1 -> node3
        createEdge('edge3', 'node2', 'node4'), // node2 -> node4
        createEdge('edge4', 'node3', 'node4'), // node3 -> node4
      ];

      const result = findThreadHistory({
        startNode: node4,
        nodes,
        edges,
      });

      // Should include all 4 nodes and end with node4 (the start)
      expect(result).toHaveLength(4);
      expect(result).toContainEqual(node1);
      expect(result).toContainEqual(node2);
      expect(result).toContainEqual(node3);
      expect(result).toContainEqual(node4);
      expect(result[result.length - 1]).toEqual(node4);
    });
  });

  describe('Performance and large graphs', () => {
    it('should handle large graphs efficiently', () => {
      const nodeCount = 1000;
      const nodes: Node[] = [];
      const edges: Edge[] = [];

      // Create a chain of 1000 nodes
      for (let i = 0; i < nodeCount; i++) {
        nodes.push(createSkillResponseNode(`node${i}`));
        if (i > 0) {
          edges.push(createEdge(`edge${i}`, `node${i - 1}`, `node${i}`)); // node[i-1] -> node[i]
        }
      }

      const startNode = nodes[nodeCount - 1];

      const startTime = performance.now();
      const result = findThreadHistory({
        startNode,
        nodes,
        edges,
      });
      const endTime = performance.now();

      // Should complete in reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
      expect(result).toHaveLength(nodeCount);
    });

    it('should handle highly connected graphs', () => {
      const nodeCount = 100;
      const nodes: Node[] = [];
      const edges: Edge[] = [];

      // Create a fully connected graph
      for (let i = 0; i < nodeCount; i++) {
        nodes.push(createSkillResponseNode(`node${i}`));
        for (let j = 0; j < i; j++) {
          edges.push(createEdge(`edge${i}-${j}`, `node${j}`, `node${i}`)); // node[j] -> node[i]
        }
      }

      const startNode = nodes[nodeCount - 1];

      const startTime = performance.now();
      const result = findThreadHistory({
        startNode,
        nodes,
        edges,
      });
      const endTime = performance.now();

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(100);
      expect(result).toHaveLength(nodeCount);
    });
  });

  describe('Data integrity', () => {
    it('should preserve original node data', () => {
      const node1 = createSkillResponseNode('node1', 'entity1');
      const node2 = createSkillResponseNode('node2', 'entity2');
      const nodes = [node1, node2];
      const edges = [createEdge('edge1', 'node1', 'node2')]; // node1 -> node2

      const result = findThreadHistory({
        startNode: node2,
        nodes,
        edges,
      });

      // Should preserve all original node properties
      expect(result[0]).toEqual(node1);
      expect(result[1]).toEqual(node2);
      expect(result[0].data?.entityId).toBe('entity1');
      expect(result[1].data?.entityId).toBe('entity2');
    });

    it('should not modify original nodes or edges arrays', () => {
      const node1 = createSkillResponseNode('node1');
      const node2 = createSkillResponseNode('node2');
      const nodes = [node1, node2];
      const edges = [createEdge('edge1', 'node1', 'node2')]; // node1 -> node2

      const originalNodes = [...nodes];
      const originalEdges = [...edges];

      findThreadHistory({
        startNode: node2,
        nodes,
        edges,
      });

      // Original arrays should be unchanged
      expect(nodes).toEqual(originalNodes);
      expect(edges).toEqual(originalEdges);
    });
  });
});
