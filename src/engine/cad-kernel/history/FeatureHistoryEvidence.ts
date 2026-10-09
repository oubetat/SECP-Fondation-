/**
 * SECP CAD Kernel — Feature History Evidence Artifact
 * Phase 2 (PATCH-022)
 *
 * ARCHITECTURAL CONTRACT:
 * - Creates machine-readable evidence artifact compatible with Evidence Object Model (PATCH-011).
 * - Cryptographically binds feature definitions, dependency graph, execution order, and results.
 * - Computes deterministic history hash without volatile timestamps or random tokens.
 */

import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';
import { FeatureNode } from './FeatureNode';
import { FeatureDependencyGraph } from './FeatureDependency';
import { RegenerationResult } from './FeatureRegenerator';
import { ToleranceContext } from '../tolerance';
import { Solid } from '../topology/TopologyContracts';
import { BRepHasher } from '../topology/BRepHasher';

export interface FeatureHistoryEvidenceReport {
  patchId: 'PATCH-022';
  documentId: string;
  historyHash: string;
  featureCount: number;
  deterministicOrder: string[];
  features: Array<{
    id: string;
    type: string;
    name: string;
    state: string;
    suppressed: boolean;
    dependencies: string[];
    definitionHash: string;
  }>;
  dependencyEdgesCount: number;
  regenerationSummary: {
    success: boolean;
    executedCount: number;
    skippedCount: number;
    failedCount: number;
  };
  tolerancePolicy: string;
  geometryHash?: string;
  topologyHash?: string;
  evidenceHash: string;
}

export class FeatureHistoryEvidence {
  /**
   * Computes the deterministic History Hash.
   * HistoryHash = Hash(documentId + ordered canonical feature definitions + dependency graph)
   */
  public static computeHistoryHash(
    documentId: string,
    nodes: FeatureNode[],
    graph: FeatureDependencyGraph
  ): string {
    // 1. Get deterministic topological order
    let orderedIds: string[];
    try {
      orderedIds = graph.getTopologicalOrder();
    } catch {
      orderedIds = nodes.map(n => n.id).sort();
    }

    const nodeMap = new Map<string, FeatureNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    // 2. Build canonical ordered payload
    const canonicalPayload = {
      documentId,
      orderedFeatures: orderedIds.map(id => {
        const n = nodeMap.get(id);
        if (!n) return { id };
        return {
          id: n.id,
          type: n.type,
          name: n.name,
          parameters: n.parameters,
          inputReferences: n.inputReferences,
          dependencyIds: n.dependencyIds,
          suppressed: n.suppressed,
          definitionHash: n.definitionHash
        };
      })
    };

    const { canonicalHash } = EngineeringHashChain.computeCanonicalHash(canonicalPayload);
    return canonicalHash;
  }

  /**
   * Generates a complete Evidence Report.
   */
  public static generateEvidence(
    documentId: string,
    nodes: FeatureNode[],
    graph: FeatureDependencyGraph,
    regenResult: RegenerationResult,
    toleranceContext?: ToleranceContext
  ): FeatureHistoryEvidenceReport {
    const historyHash = this.computeHistoryHash(documentId, nodes, graph);

    let deterministicOrder: string[] = [];
    try {
      deterministicOrder = graph.getTopologicalOrder();
    } catch {
      deterministicOrder = nodes.map(n => n.id);
    }

    let edgeCount = 0;
    for (const node of nodes) {
      edgeCount += node.dependencyIds.length;
    }

    const reportPayload: any = {
      patchId: 'PATCH-022' as const,
      documentId,
      historyHash,
      featureCount: nodes.length,
      deterministicOrder,
      features: nodes.map(n => ({
        id: n.id,
        type: n.type,
        name: n.name,
        state: n.state,
        suppressed: n.suppressed,
        dependencies: n.dependencyIds,
        definitionHash: n.definitionHash
      })),
      dependencyEdgesCount: edgeCount,
      regenerationSummary: {
        success: regenResult.success,
        executedCount: regenResult.executedFeatureIds.length,
        skippedCount: regenResult.skippedFeatureIds.length,
        failedCount: regenResult.failedFeatureIds.length
      },
      tolerancePolicy: toleranceContext?.policy || 'STRICT_INDUSTRIAL'
    };

    if (regenResult.finalGeometry && (regenResult.finalGeometry as any).shapeType === 'SOLID') {
      const artifactEvidence = BRepHasher.computeEvidence(regenResult.finalGeometry as Solid);
      reportPayload.geometryHash = artifactEvidence.geometryHash;
      reportPayload.topologyHash = artifactEvidence.topologyHash;
    }

    const { canonicalHash: evidenceHash } = EngineeringHashChain.computeCanonicalHash(reportPayload);

    return {
      ...reportPayload,
      evidenceHash
    };
  }
}
