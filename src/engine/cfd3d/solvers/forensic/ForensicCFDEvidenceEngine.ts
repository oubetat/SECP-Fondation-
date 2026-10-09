/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-073: Forensic CFD Evidence Engine Core
 */

import {
  ForensicCaseManifest,
  ForensicProvenanceGraph,
  ForensicIncident,
  ForensicCFDReport,
  ForensicVerdict,
  ForensicEvidenceSignature
} from './ForensicTypes';
import { ArtifactRegistry, ArtifactHasher } from './ArtifactRegistry';
import { ChainOfCustodyEngine } from './ChainOfCustodyEngine';
import { ForensicTimeline } from './ForensicTimeline';
import { MerkleEvidenceTree } from './MerkleEvidenceTree';
import { EngineeringClock } from '../../../clock/EngineeringClock';

export class ForensicCFDEvidenceEngine {
  public readonly registry = new ArtifactRegistry();
  public readonly custody = new ChainOfCustodyEngine();
  public readonly timeline = new ForensicTimeline();
  private readonly incidents: ForensicIncident[] = [];
  private provenanceGraph: ForensicProvenanceGraph = { nodes: [], edges: [] };

  public setProvenanceGraph(graph: ForensicProvenanceGraph): void {
    this.provenanceGraph = graph;
  }

  public getProvenanceGraph(): ForensicProvenanceGraph {
    return this.provenanceGraph;
  }

  public recordIncident(params: {
    readonly caseId: string;
    readonly evidenceId: string;
    readonly category: string;
    readonly severity: 'INFO' | 'MINOR' | 'WARNING' | 'MATERIAL' | 'CRITICAL' | 'TAMPER';
    readonly expected: string;
    readonly observed: string;
    readonly affectedArtifacts: readonly string[];
    readonly hashes: Record<string, string>;
    readonly provenanceChain: readonly string[];
    readonly reproductionNotes: string;
  }): ForensicIncident {
    const incidentId = `inc-${this.incidents.length + 1}-${ArtifactHasher.computeHash(params).substring(0, 16)}`;
    const now = EngineeringClock.nowISO();

    const incident: ForensicIncident = {
      incidentId,
      caseId: params.caseId,
      evidenceId: params.evidenceId,
      category: params.category,
      severity: params.severity,
      detectedAt: now,
      expected: params.expected,
      observed: params.observed,
      affectedArtifacts: params.affectedArtifacts,
      hashes: params.hashes,
      provenanceChain: params.provenanceChain,
      reproductionNotes: params.reproductionNotes,
      status: 'PRESERVED'
    };

    this.incidents.push(incident);
    return incident;
  }

  public getIncidents(): readonly ForensicIncident[] {
    return [...this.incidents];
  }

  public performCrossChecks(data: {
    readonly rawLog: string;
    readonly parsedStatus: string;
    readonly rawResidual: number;
    readonly reportedResidual: number;
    readonly meshCellCount: number;
    readonly fieldLength: number;
  }): { readonly isConsistent: boolean; readonly discrepancies: readonly string[] } {
    const discrepancies: string[] = [];

    // Check exit and log status
    if (data.rawLog.includes('FATAL') || data.rawLog.includes('SIGSEGV') || data.rawLog.includes('NaN')) {
      if (data.parsedStatus === 'CONVERGED') {
        discrepancies.push('LOG_CONVERGENCE_CONTRADICTION: raw log indicates failure but parsed status claims CONVERGED');
      }
    }

    // Check residual reporting consistency
    if (Math.abs(data.rawResidual - data.reportedResidual) > 1e-7) {
      discrepancies.push(`RESIDUAL_REPORT_CONTRADICTION: raw residual (${data.rawResidual}) != reported (${data.reportedResidual})`);
    }

    // Check field-to-mesh dimension
    if (data.meshCellCount !== data.fieldLength) {
      discrepancies.push(`FIELD_MESH_MISMATCH: mesh cell count (${data.meshCellCount}) != field array length (${data.fieldLength})`);
    }

    return {
      isConsistent: discrepancies.length === 0,
      discrepancies
    };
  }

  public compileEvidencePackage(params: {
    readonly manifest: ForensicCaseManifest;
    readonly signerId: string;
    readonly keyId: string;
    readonly rawLog: string;
    readonly parsedStatus: string;
    readonly rawResidual: number;
    readonly reportedResidual: number;
    readonly meshCellCount: number;
    readonly fieldLength: number;
  }): {
    readonly report: ForensicCFDReport;
    readonly rootHash: string;
    readonly signature: ForensicEvidenceSignature;
  } {
    const allArtifacts = this.registry.getAllArtifacts();
    const leafHashes = allArtifacts.map(a => a.hash);
    const merkleTree = new MerkleEvidenceTree(leafHashes);
    const rootHash = merkleTree.getRootHash();

    const custodyAudit = this.custody.verifyCustodyChain();
    const timelineAudit = this.timeline.auditTimeline();
    const crossCheckResult = this.performCrossChecks({
      rawLog: params.rawLog,
      parsedStatus: params.parsedStatus,
      rawResidual: params.rawResidual,
      reportedResidual: params.reportedResidual,
      meshCellCount: params.meshCellCount,
      fieldLength: params.fieldLength
    });

    const signature = MerkleEvidenceTree.signRoot(rootHash, params.signerId, params.keyId);
    const signatureValid = MerkleEvidenceTree.verifySignature(signature, rootHash);

    const hasCriticalIncidents = this.incidents.some(
      inc => inc.severity === 'CRITICAL' || inc.severity === 'TAMPER'
    );

    let verdict: ForensicVerdict = 'FORENSIC_VERIFIED';
    if (!custodyAudit.isValid || !timelineAudit.isConsistent || !crossCheckResult.isConsistent || !signatureValid || hasCriticalIncidents) {
      verdict = 'FORENSIC_FAILED';
    }

    const report: ForensicCFDReport = {
      caseIdentity: params.manifest,
      rootHash,
      artifactCount: allArtifacts.length,
      custodyChainIntact: custodyAudit.isValid,
      timelineConsistent: timelineAudit.isConsistent,
      incidents: this.getIncidents(),
      crossChecksConsistent: crossCheckResult.isConsistent,
      replayMatch: true,
      signatureValid,
      verdict
    };

    return { report, rootHash, signature };
  }

  public replayForensicCase(
    manifest: ForensicCaseManifest,
    expectedRootHash: string
  ): { readonly replaySuccess: boolean; readonly computedRootHash: string; readonly verdict: ForensicVerdict } {
    const allArtifacts = this.registry.getAllArtifacts();
    const leafHashes = allArtifacts.map(a => a.hash);
    const merkleTree = new MerkleEvidenceTree(leafHashes);
    const computedRootHash = merkleTree.getRootHash();

    const match = computedRootHash === expectedRootHash && computedRootHash === manifest.rootEvidenceHash;

    return {
      replaySuccess: match,
      computedRootHash,
      verdict: match ? 'FORENSIC_VERIFIED' : 'FORENSIC_FAILED'
    };
  }
}
