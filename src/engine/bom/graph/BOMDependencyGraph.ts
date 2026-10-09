import { BOMGraphData, BOMEdgeType } from './types';

export class BOMDependencyGraph {
  public static whereUsed(itemId: string, bom: BOMGraphData): string[] {
    const parentMap = new Map<string, string[]>();

    for (const edge of bom.edges) {
      if (edge.edgeType === BOMEdgeType.REQUIRES || edge.edgeType === BOMEdgeType.CONTAINS || edge.edgeType === BOMEdgeType.ASSEMBLES) {
        if (!parentMap.has(edge.childNodeId)) parentMap.set(edge.childNodeId, []);
        parentMap.get(edge.childNodeId)!.push(edge.parentNodeId);
      }
    }

    const result = new Set<string>();
    const queue = [itemId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const parents = parentMap.get(current) || [];
      for (const p of parents) {
        result.add(p);
        queue.push(p);
      }
    }

    return Array.from(result);
  }
}
