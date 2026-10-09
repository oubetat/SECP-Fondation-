/**
 * SECP Industrial OS v2 — Lineage Reconstruction Engine
 * Reconstructs Lineage from Forensic Evidence Packages & Identifies Lineage Gaps
 */

import { 
  CAMProvenanceGraphEngine 
} from "./CAMProvenanceGraph";
import { 
  CAMArtifactType, 
  ForensicQueryResponse, 
  ProvenanceGapType,
  ProvenanceNode
} from "./types";

export class CAMProvenanceReconstructionEngine {
  private graph: CAMProvenanceGraphEngine;

  constructor(graph: CAMProvenanceGraphEngine) {
    this.graph = graph;
  }

  /**
   * Performs full forensic query for a given artifact
   */
  public queryForensicLineage(artifactId: string): ForensicQueryResponse {
    const trace = this.graph.traceBackward(artifactId);
    
    let originCADRevision = "UNKNOWN_CAD_REV";
    let assumedMaterial = "UNKNOWN_MATERIAL";
    let targetTool = "UNKNOWN_TOOL";
    let targetMachine = "UNKNOWN_MACHINE";
    let simulationVerdict = "UNKNOWN_SIMULATION";
    let generatedGCodeHash = "UNKNOWN_GCODE_HASH";
    let verificationVerdict = "UNKNOWN_VERIFICATION";
    let executionTwinStateHash = "UNKNOWN_TWIN_STATE";

    for (const pathId of trace.path) {
      const node = this.graph.getNode(pathId);
      if (!node) continue;

      switch (node.identity.artifactType) {
        case CAMArtifactType.CAD_REVISION:
        case CAMArtifactType.CAD_MODEL:
          originCADRevision = node.revision.revisionFingerprint;
          break;
        case CAMArtifactType.MATERIAL:
          assumedMaterial = node.payload.content?.materialName || node.identity.artifactId;
          break;
        case CAMArtifactType.TOOL:
          targetTool = node.payload.content?.toolId || node.identity.artifactId;
          break;
        case CAMArtifactType.MACHINE:
          targetMachine = node.payload.content?.machineId || node.identity.artifactId;
          break;
        case CAMArtifactType.SIMULATION:
          simulationVerdict = node.payload.content?.verdict || "SIMULATION_PASSED";
          break;
        case CAMArtifactType.NC_PROGRAM:
          generatedGCodeHash = node.contentHash;
          break;
        case CAMArtifactType.GCODE_VERIFICATION:
          verificationVerdict = node.payload.content?.verdict || "VERIFIED";
          break;
        case CAMArtifactType.DIGITAL_TWIN_STATE:
          executionTwinStateHash = node.contentHash;
          break;
      }
    }

    const completeness = this.graph.calculateCompleteness(artifactId);

    return {
      artifactId,
      originCADRevision,
      assumedMaterial,
      targetTool,
      targetMachine,
      simulationVerdict,
      generatedGCodeHash,
      verificationVerdict,
      executionTwinStateHash,
      isVerified: verificationVerdict === "VERIFIED" || verificationVerdict === "PASSED",
      isTwinSynchronized: executionTwinStateHash !== "UNKNOWN_TWIN_STATE",
      completeLineage: completeness.completenessRatio === 1.0
    };
  }

  /**
   * Reconstructs state graph from serialized forensic package
   */
  public reconstructFromEvidencePackage(evidencePackage: any): {
    reconstructedNodesCount: number;
    reconstructedEdgesCount: number;
    isIncomplete: boolean;
    missingGaps: ProvenanceGapType[];
  } {
    if (!evidencePackage || !evidencePackage.graph) {
      return {
        reconstructedNodesCount: 0,
        reconstructedEdgesCount: 0,
        isIncomplete: true,
        missingGaps: [ProvenanceGapType.MISSING_PARENT]
      };
    }

    const nodes = evidencePackage.graph.nodes || [];
    const edges = evidencePackage.graph.edges || [];

    return {
      reconstructedNodesCount: nodes.length,
      reconstructedEdgesCount: edges.length,
      isIncomplete: nodes.length < 5,
      missingGaps: nodes.length < 5 ? [ProvenanceGapType.MISSING_REVISION] : []
    };
  }
}
