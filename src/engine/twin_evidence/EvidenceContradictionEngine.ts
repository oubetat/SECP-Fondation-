import { TwinEvidenceGraph, TwinEvidenceNode, TwinEvidenceEdge } from './types';

export class EvidenceContradictionEngine {
  public static detectNumericalContradiction(graph: TwinEvidenceGraph): { hasContradiction: boolean; details: string; contradictingNodes: string[] } {
    const valueMap = new Map<string, { value: number, nodeId: string }>();

    for (const node of graph.nodes.values()) {
      if (node.attributes && node.attributes.target && node.attributes.value !== undefined) {
        const key = `${node.entityId}-${node.attributes.target}`;
        
        if (valueMap.has(key)) {
          const existing = valueMap.get(key)!;
          // If values differ by more than 1% tolerance, it's a contradiction
          const diff = Math.abs(existing.value - node.attributes.value);
          const max = Math.max(Math.abs(existing.value), Math.abs(node.attributes.value));
          
          if (max > 0 && (diff / max) > 0.01) {
             return {
               hasContradiction: true,
               details: `NUMERICAL_CONTRADICTION: Node ${node.nodeId} (${node.attributes.value}) contradicts Node ${existing.nodeId} (${existing.value}) for ${key}`,
               contradictingNodes: [existing.nodeId, node.nodeId]
             };
          }
        } else {
          valueMap.set(key, { value: node.attributes.value, nodeId: node.nodeId });
        }
      }
    }

    return { hasContradiction: false, details: '', contradictingNodes: [] };
  }
}
