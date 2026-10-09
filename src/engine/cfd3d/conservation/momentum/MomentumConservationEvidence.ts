/**
 * SECP Industrial OS v2 — Momentum Conservation Framework
 * PATCH-058: Momentum Conservation Evidence
 */

import { MomentumConservationReport } from './MomentumConservationReport';
import { MomentumConservationStatus, MomentumVector } from './MomentumConservationTypes';

export interface MomentumConservationEvidenceRecord {
  readonly caseId: string;
  readonly meshHash: string;
  readonly fieldStateHash: string;
  readonly boundaryConditionHash: string;
  readonly materialStateHash: string;
  readonly physicsModelHash: string;
  readonly policyHash: string;
  readonly globalImbalance: [number, number, number];
  readonly maxLocalImbalance: [number, number, number];
  readonly verdict: MomentumConservationStatus;
  readonly diagnostics: string[];
  readonly timestamp: string;
  readonly provenanceSignature: string;
}

export class MomentumConservationEvidence {

  public static generate(
    caseId: string,
    report: MomentumConservationReport,
    boundaryConditionHash: string,
    materialStateHash: string,
    physicsModelHash: string,
    policyHash: string
  ): MomentumConservationEvidenceRecord {
    const payload = `${caseId}|${report.meshHash}|${report.fieldStateHash}|${report.globalImbalanceNorm}|${report.status}`;
    const provenanceSignature = this.computeHash(payload);

    return {
      caseId,
      meshHash: report.meshHash,
      fieldStateHash: report.fieldStateHash,
      boundaryConditionHash,
      materialStateHash,
      physicsModelHash,
      policyHash,
      globalImbalance: [report.imbalanceX, report.imbalanceY, report.imbalanceZ],
      maxLocalImbalance: report.maxLocalImbalance.toArray(),
      verdict: report.status,
      diagnostics: report.diagnostics,
      timestamp: report.timestamp,
      provenanceSignature
    };
  }

  private static computeHash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = (hash << 5) - hash + data.charCodeAt(i);
      hash |= 0;
    }
    return `secp058-hash-${Math.abs(hash).toString(16)}`;
  }
}
