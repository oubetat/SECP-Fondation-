import { TwinEvidenceGraph, TwinEvidenceEdge } from './types';

export class TemporalContaminationGate {
  public static checkTemporalContamination(graph: TwinEvidenceGraph): { hasContamination: boolean; details: string } {
    for (const edge of graph.edges.values()) {
      // Validate edges (e.g., A validated by B)
      if (edge.edgeType === 'VALIDATED_BY') {
        const targetNode = graph.nodes.get(edge.fromNodeId); // The claim/prediction
        const sourceNode = graph.nodes.get(edge.toNodeId);   // The evidence/inspection

        if (targetNode && sourceNode) {
          const targetTime = new Date(targetNode.validFrom).getTime();
          const sourceTime = new Date(sourceNode.validFrom).getTime();

          // If evidence is strictly from the future relative to the claim's validity context
          // AND it's being used to retroactively validate a historical claim (assuming targetTime is the claim's horizon or state time)
          if (sourceTime > targetTime) {
            return {
              hasContamination: true,
              details: `TEMPORAL_CONTAMINATION: Evidence ${sourceNode.nodeId} (${sourceNode.validFrom}) used to validate Claim ${targetNode.nodeId} (${targetNode.validFrom}) from the past.`
            };
          }
        }
      }
    }
    return { hasContamination: false, details: '' };
  }
}
