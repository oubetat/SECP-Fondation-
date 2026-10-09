/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-013: Provenance Graph Gate & Main Index Entrypoint
 */

import { ProvenanceGraph } from './ProvenanceGraph';
import { ProvenanceGraphBuilder } from './ProvenanceGraphBuilder';
import { ProvenanceGraphVerifier } from './ProvenanceGraphVerifier';
import { ProvenanceGraphSerializer } from './ProvenanceGraphSerializer';
import {
  ProvenanceNode,
  ProvenanceEdge,
  ProvenanceVerificationResult,
  ProvenanceGraphEvidenceReport
} from './ProvenanceGraphTypes';
import { EngineeringEvidence } from '../evidence/EngineeringEvidenceTypes';

export * from './ProvenanceGraphTypes';
export * from './ProvenanceGraphErrors';
export * from './ProvenanceGraph';
export * from './ProvenanceGraphBuilder';
export * from './ProvenanceGraphVerifier';
export * from './ProvenanceGraphSerializer';

export class ProvenanceGraphIntegrityGate {
  public static readonly GATE_ID = 'GATE-PATCH-013-PROVENANCE-GRAPH';

  /**
   * Evaluates the Provenance Graph Gate without relying on external test files.
   * Performs live execution and verification of graph structures.
   */
  public static evaluateGate(
    graph: ProvenanceGraph,
    evidenceStore?: Map<string, EngineeringEvidence>
  ): {
    passed: boolean;
    verificationResult: ProvenanceVerificationResult;
    evidenceReport: ProvenanceGraphEvidenceReport;
  } {
    // 1. Execute live verification
    const verificationResult = ProvenanceGraphVerifier.verifyGraph(graph, evidenceStore);

    // 2. Determine gate pass criteria:
    // MUST pass structural integrity, must have NO violations, must have 0 broken references / cycles
    const passed =
      verificationResult.status === 'PASS' &&
      verificationResult.violations.length === 0 &&
      verificationResult.invalidNodes === 0 &&
      verificationResult.invalidEdges === 0;

    // 3. Generate real evidence report (No hardcoded values)
    const evidenceReport: ProvenanceGraphEvidenceReport = {
      patchId: 'PATCH-013',
      artifactType: 'PROVENANCE_GRAPH',
      graphHash: verificationResult.graphHash,
      nodeCount: graph.nodeCount,
      edgeCount: graph.edgeCount,
      verifiedNodeCount: verificationResult.verifiedNodes,
      verifiedEdgeCount: verificationResult.verifiedEdges,
      verificationStatus: verificationResult.status,
      violations: verificationResult.violations,
      missingEvidence: verificationResult.missingEvidence,
      brokenReferences: verificationResult.brokenReferences,
      generatedAt: new Date().toISOString(),
      engineeringClockSource: 'SystemEngineeringClock',
      testSummary: {
        gateId: this.GATE_ID,
        passed,
        checkedNodes: verificationResult.verifiedNodes + verificationResult.invalidNodes,
        checkedEdges: verificationResult.verifiedEdges + verificationResult.invalidEdges
      }
    };

    return {
      passed,
      verificationResult,
      evidenceReport
    };
  }

  /**
   * High-level helper: serialize graph
   */
  public static serializeGraph(graph: ProvenanceGraph): string {
    return ProvenanceGraphSerializer.serializeGraph(graph.getNodes(), graph.getEdges());
  }

  /**
   * High-level helper: deserialize graph with deterministic identity re-validation
   */
  public static deserializeGraph(serializedJson: string): ProvenanceGraph {
    const raw = JSON.parse(serializedJson);
    if (!raw.nodes || !Array.isArray(raw.nodes) || !raw.edges || !Array.isArray(raw.edges)) {
      throw new Error('Invalid serialized graph payload: missing nodes or edges array');
    }
    return new ProvenanceGraph(raw.nodes, raw.edges);
  }
}
