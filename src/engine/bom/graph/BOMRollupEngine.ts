import { BOMGraphData, BOMNode, BOMEdgeType } from './types';

export class BOMRollupEngine {
  public static calculateTotalQuantities(bom: BOMGraphData): Map<string, number> {
    const adj = new Map<string, { childId: string, quantity: number }[]>();
    const inDegree = new Map<string, number>();
    const nodeMap = new Map<string, BOMNode>();
    const totals = new Map<string, number>();

    for (const node of bom.nodes) {
      inDegree.set(node.bomNodeId, 0);
      nodeMap.set(node.bomNodeId, node);
    }

    for (const edge of bom.edges) {
      if (edge.edgeType === BOMEdgeType.REQUIRES || edge.edgeType === BOMEdgeType.CONTAINS || edge.edgeType === BOMEdgeType.ASSEMBLES) {
        if (!adj.has(edge.parentNodeId)) adj.set(edge.parentNodeId, []);
        adj.get(edge.parentNodeId)!.push({ childId: edge.childNodeId, quantity: edge.quantity });
        inDegree.set(edge.childNodeId, (inDegree.get(edge.childNodeId) || 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(id);
        const node = nodeMap.get(id);
        totals.set(id, node ? node.quantity : 1);
      }
    }

    // Process topologically
    // Actually wait, multiple paths could exist.
    // Instead of topo sort, we should do a simple top-down recursion with memoization if it's a DAG.
    return this.calculateTotalsRecursive(bom, adj, nodeMap);
  }

  private static calculateTotalsRecursive(bom: BOMGraphData, adj: Map<string, { childId: string, quantity: number }[]>, nodeMap: Map<string, BOMNode>): Map<string, number> {
    const totals = new Map<string, number>();

    // Initialize root nodes (those with no parent edges)
    const hasParentEdge = new Set<string>();
    for (const edge of bom.edges) {
      if (edge.edgeType === BOMEdgeType.REQUIRES || edge.edgeType === BOMEdgeType.CONTAINS || edge.edgeType === BOMEdgeType.ASSEMBLES) {
        hasParentEdge.add(edge.childNodeId);
      }
    }

    const roots = bom.nodes.filter(n => !hasParentEdge.has(n.bomNodeId));
    
    // DFS to accumulate paths
    const traverse = (nodeId: string, pathQuantity: number) => {
      const currentTotal = totals.get(nodeId) || 0;
      totals.set(nodeId, currentTotal + pathQuantity);

      const children = adj.get(nodeId) || [];
      for (const child of children) {
        traverse(child.childId, pathQuantity * child.quantity);
      }
    };

    for (const root of roots) {
      traverse(root.bomNodeId, root.quantity);
    }

    return totals;
  }
}
