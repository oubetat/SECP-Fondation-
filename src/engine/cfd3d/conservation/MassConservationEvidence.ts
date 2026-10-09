/**
 * SECP Industrial OS v2 — Mass Conservation Framework
 * PATCH-057: Conservation Evidence Generator
 */

import { MassConservationReport } from './MassConservationReport';
import { MassConservationStatus } from './MassConservationTypes';

export interface MassConservationEvidenceRecord {
  readonly caseId: string;
  readonly meshHash: string;
  readonly fieldStateHash: string;
  readonly boundaryConditionHash: string;
  readonly materialStateHash: string;
  readonly policyHash: string;
  readonly totalInflow: number;
  readonly totalOutflow: number;
  readonly accumulation: number;
  readonly globalImbalance: number;
  readonly maxLocalImbalance: number;
  readonly verdict: MassConservationStatus;
  readonly diagnostics: string[];
  readonly timestamp: string;
  readonly provenanceSignature: string;
}

export class MassConservationEvidence {
  
  public static generate(
    caseId: string,
    report: MassConservationReport,
    boundaryConditionHash: string,
    materialStateHash: string,
    policyHash: string
  ): MassConservationEvidenceRecord {
    const payload = `${caseId}|${report.meshHash}|${report.fieldStateHash}|${report.globalImbalance}|${report.status}`;
    const provenanceSignature = this.computeHash(payload);

    return {
      caseId,
      meshHash: report.meshHash,
      fieldStateHash: report.fieldStateHash,
      boundaryConditionHash,
      materialStateHash,
      policyHash,
      totalInflow: report.totalInflow,
      totalOutflow: report.totalOutflow,
      accumulation: report.accumulation,
      globalImbalance: report.globalImbalance,
      maxLocalImbalance: report.maxLocalImbalance,
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
    return `secp057-hash-${Math.abs(hash).toString(16)}`;
  }
}
