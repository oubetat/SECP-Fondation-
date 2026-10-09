import { TwinEvidenceGraph } from './types';

export class EvidenceBlastRadiusAnalyzer {
  public static calculateBlastRadius(graph: TwinEvidenceGraph, rootNodeId: string): string[] {
    const affectedNodes = new Set<string>();
    const queue = [rootNodeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      
      // Find all edges where this node is the source (i.e. 'toNodeId' in DERIVED_FROM or DEPENDS_ON)
      // Actually, if B is DERIVED_FROM A, then fromNodeId=B, toNodeId=A
      // So we look for edges where toNodeId === currentId and type implies dependency
      for (const edge of graph.edges.values()) {
        if (edge.toNodeId === currentId) {
          if (!affectedNodes.has(edge.fromNodeId)) {
            affectedNodes.add(edge.fromNodeId);
            queue.push(edge.fromNodeId);
          }
        }
      }
    }

    return Array.from(affectedNodes);
  }
}
