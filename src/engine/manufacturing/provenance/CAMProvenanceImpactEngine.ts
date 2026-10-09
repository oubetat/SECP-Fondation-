/**
 * SECP Industrial OS v2 — Change Impact Analysis & Compatibility Engine
 * Calculates Downstream Propagation, Stale Derivatives, and Compatibility Checks
 */

import { 
  CAMProvenanceGraphEngine 
} from "./CAMProvenanceGraph";
import { 
  ProvenanceNode, 
  CAMArtifactType, 
  ArtifactLifecycleStatus, 
  CompatibilityVerdict,
  ChangeSignificance 
} from "./types";

export interface ImpactAnalysisResult {
  changedArtifactId: string;
  changeSignificance: ChangeSignificance;
  affectedArtifactIds: string[];
  affectedArtifactTypes: CAMArtifactType[];
  staleDerivativesCount: number;
  requiresRegeneration: boolean;
  impactGraph: { source: string; target: string; impactType: string }[];
}

export class CAMProvenanceImpactEngine {
  private graph: CAMProvenanceGraphEngine;

  constructor(graph: CAMProvenanceGraphEngine) {
    this.graph = graph;
  }

  /**
   * Analyzes downstream impact when an artifact revision changes or parameter is updated
   */
  public analyzeImpact(changedArtifactId: string, changeSignificance: ChangeSignificance): ImpactAnalysisResult {
    const forwardTrace = this.graph.traceForward(changedArtifactId);
    const affectedArtifactIds = forwardTrace.reachableArtifactIds.filter(id => id !== changedArtifactId);
    
    const affectedArtifactTypes: CAMArtifactType[] = [];
    const impactGraph: { source: string; target: string; impactType: string }[] = [];

    let staleDerivativesCount = 0;

    for (const affectedId of affectedArtifactIds) {
      const node = this.graph.getNode(affectedId);
      if (node) {
        affectedArtifactTypes.push(node.identity.artifactType);
        
        // If engineering relevant or critical, mark downstream as STALE
        if (
          changeSignificance === ChangeSignificance.ENGINEERING_RELEVANT ||
          changeSignificance === ChangeSignificance.MANUFACTURING_RELEVANT ||
          changeSignificance === ChangeSignificance.CRITICAL
        ) {
          node.status = ArtifactLifecycleStatus.STALE_DERIVATIVE;
          staleDerivativesCount++;
        }
      }
    }

    // Build impact edge visualization
    const allEdges = this.graph.getAllEdges();
    for (const edge of allEdges) {
      if (forwardTrace.reachableArtifactIds.includes(edge.sourceArtifactId) &&
          forwardTrace.reachableArtifactIds.includes(edge.targetArtifactId)) {
        impactGraph.push({
          source: edge.sourceArtifactId,
          target: edge.targetArtifactId,
          impactType: changeSignificance
        });
      }
    }

    return {
      changedArtifactId,
      changeSignificance,
      affectedArtifactIds,
      affectedArtifactTypes: Array.from(new Set(affectedArtifactTypes)),
      staleDerivativesCount,
      requiresRegeneration: staleDerivativesCount > 0,
      impactGraph
    };
  }

  /**
   * Compatibility Check: Verifies compatibility between an operation/toolpath and its environment (Machine, Tool, Material, Fixture)
   */
  public checkCompatibility(
    toolpathNode: ProvenanceNode,
    machineNode: ProvenanceNode,
    toolNode: ProvenanceNode,
    materialNode: ProvenanceNode
  ): {
    verdict: CompatibilityVerdict;
    mismatches: string[];
    isCompatible: boolean;
  } {
    const mismatches: string[] = [];

    // 1. Tool diameter check
    const toolDiameter = toolNode.payload.content?.diameter || 10;
    const pathMaxPassWidth = toolpathNode.payload.content?.stepOver || 5;
    if (pathMaxPassWidth > toolDiameter) {
      mismatches.push(`Toolpath stepOver (${pathMaxPassWidth}mm) exceeds tool diameter (${toolDiameter}mm).`);
    }

    // 2. Machine envelope check
    const machineLimits = machineNode.payload.content?.axisLimits || { x: 500, y: 500, z: 500 };
    const pathBounds = toolpathNode.payload.content?.boundingVolume || { x: 200, y: 200, z: 100 };
    if (pathBounds.x > machineLimits.x || pathBounds.y > machineLimits.y || pathBounds.z > machineLimits.z) {
      mismatches.push(`Toolpath bounding box exceeds target machine envelope limits.`);
    }

    // 3. Material cutting speed compatibility
    const materialHardness = materialNode.payload.content?.hardnessHB || 120;
    const commandedRPM = toolpathNode.payload.content?.maxRPM || 8000;
    if (materialHardness > 300 && commandedRPM > 15000) {
      mismatches.push(`Excessive spindle speed (${commandedRPM} RPM) for hard material (${materialHardness} HB).`);
    }

    let verdict = CompatibilityVerdict.COMPATIBLE;
    if (mismatches.length > 0) {
      verdict = CompatibilityVerdict.INCOMPATIBLE;
    }

    return {
      verdict,
      mismatches,
      isCompatible: verdict === CompatibilityVerdict.COMPATIBLE
    };
  }
}
