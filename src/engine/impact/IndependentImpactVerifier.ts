import { 
  ChangeImpactAnalysis, 
  GraphSnapshot, 
  DifferentialVerificationResult 
} from './types';
import { ChangeImpactAnalyzer } from './ChangeImpactAnalyzer';
import { ImpactCanonicalizer } from './ImpactCanonicalizer';

export class IndependentImpactVerifier {
  public static verifyAnalysis(
    snapshot: GraphSnapshot,
    analysis: ChangeImpactAnalysis
  ): DifferentialVerificationResult {
    const mismatches: string[] = [];

    // 1. Verify Graph Snapshot Hash
    const computedSnapshotHash = ImpactCanonicalizer.computeGraphSnapshotHash(snapshot);
    if (computedSnapshotHash !== analysis.graphSnapshotHash) {
      mismatches.push(`SNAPSHOT_HASH_MISMATCH: Computed ${computedSnapshotHash} vs Stored ${analysis.graphSnapshotHash}`);
    }

    // 2. Verify Stale Graph Detection
    if (analysis.verdict === 'STALE') {
      return {
        verdict: 'INVALID',
        nodeMatch: false,
        edgeMatch: false,
        pathMatch: false,
        severityMatch: false,
        hashMatch: false,
        mismatches: ['STALE_GRAPH_ANALYSIS_REJECTED']
      };
    }

    // 3. Re-run Independent Traversal
    const verifierAnalyzer = new ChangeImpactAnalyzer(snapshot);
    const reComputedAnalysis = verifierAnalyzer.analyzeChange(
      analysis.ecoId,
      analysis.rootEntityIds,
      analysis.rootRevisionIds,
      {
        algorithmVersion: analysis.algorithmVersion,
        policyVersion: analysis.policyVersion,
        isSafetyCritical: analysis.nodes.some(n => n.impactClass === 'DIRECT' && n.severity === 'CRITICAL')
      }
    );

    // 4. Compare Nodes
    let nodeMatch = true;
    if (reComputedAnalysis.nodes.length !== analysis.nodes.length) {
      nodeMatch = false;
      mismatches.push(`NODE_COUNT_MISMATCH: Recomputed ${reComputedAnalysis.nodes.length} vs Stored ${analysis.nodes.length}`);
    } else {
      const storedNodeIds = new Set(analysis.nodes.map(n => n.nodeId));
      for (const node of reComputedAnalysis.nodes) {
        if (!storedNodeIds.has(node.nodeId)) {
          nodeMatch = false;
          mismatches.push(`MISSING_NODE: Recomputed node ${node.nodeId} not found in stored analysis`);
        }
      }
    }

    // 5. Compare Edges
    let edgeMatch = true;
    if (reComputedAnalysis.edges.length !== analysis.edges.length) {
      edgeMatch = false;
      mismatches.push(`EDGE_COUNT_MISMATCH: Recomputed ${reComputedAnalysis.edges.length} vs Stored ${analysis.edges.length}`);
    }

    // 6. Compare Paths
    let pathMatch = true;
    if (reComputedAnalysis.paths.length !== analysis.paths.length) {
      pathMatch = false;
      mismatches.push(`PATH_COUNT_MISMATCH: Recomputed ${reComputedAnalysis.paths.length} vs Stored ${analysis.paths.length}`);
    }

    // 7. Compare Severities
    let severityMatch = true;
    for (const reNode of reComputedAnalysis.nodes) {
      const storedNode = analysis.nodes.find(n => n.nodeId === reNode.nodeId);
      if (storedNode && storedNode.severity !== reNode.severity) {
        severityMatch = false;
        mismatches.push(`SEVERITY_MISMATCH on ${reNode.nodeId}: Recomputed ${reNode.severity} vs Stored ${storedNode.severity}`);
      }
    }

    // 8. Compare Canonical Analysis Hash
    const reComputedAnalysisHash = ImpactCanonicalizer.computeAnalysisHash(analysis);
    let hashMatch = reComputedAnalysisHash === analysis.analysisHash;

    if (!hashMatch) {
      mismatches.push(`ANALYSIS_HASH_MISMATCH: Computed ${reComputedAnalysisHash} vs Stored ${analysis.analysisHash}`);
    }

    const isMatch = nodeMatch && edgeMatch && pathMatch && severityMatch && hashMatch && mismatches.length === 0;

    let finalVerdict: DifferentialVerificationResult['verdict'] = 'MATCH';
    if (!isMatch) {
      finalVerdict = analysis.status === 'INCOMPLETE' ? 'INCOMPLETE' : 'MISMATCH';
    }

    return {
      verdict: finalVerdict,
      nodeMatch,
      edgeMatch,
      pathMatch,
      severityMatch,
      hashMatch,
      mismatches
    };
  }
}
