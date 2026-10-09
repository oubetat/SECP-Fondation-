/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Boundary Condition Evidence Generator
 */

import {
  BoundaryConditionVerdict,
  BoundaryDiagnosticCode
} from './BoundaryConditionTypes';
import { BoundaryConditionReportData } from './BoundaryConditionReport';

export interface BoundaryConditionEvidenceRecord {
  readonly caseId: string;
  readonly boundaryConditionId: string;
  readonly boundaryPatchId: string;
  readonly meshHash: string;
  readonly geometryHash: string;
  readonly fieldHash: string;
  readonly materialHash: string;
  readonly physicsModelHash: string;
  readonly formulationHash: string;
  readonly policyHash: string;
  readonly conditionType: string;
  readonly units: string;
  readonly applicabilityValid: boolean;
  readonly compatibilityValid: boolean;
  readonly coverageComplete: boolean;
  readonly diagnostics: readonly string[];
  readonly diagnosticCodes: readonly BoundaryDiagnosticCode[];
  readonly verdict: BoundaryConditionVerdict;
  readonly timestamp: string;
  readonly provenanceSignature: string;
}

export class BoundaryConditionEvidence {
  public static generate(
    caseId: string,
    report: BoundaryConditionReportData,
    meshHash: string,
    geometryHash: string,
    materialHash: string,
    physicsModelHash: string,
    policyHash: string
  ): BoundaryConditionEvidenceRecord {
    const formulationHash = this.computeHash(`formulation:${report.systemConstrained}`);
    const payload = `${caseId}|${meshHash}|${geometryHash}|${report.verdict}|${report.coverageComplete}`;
    const provenanceSignature = this.computeHash(payload);

    return {
      caseId,
      boundaryConditionId: 'bc-set-060',
      boundaryPatchId: 'patch-set-060',
      meshHash,
      geometryHash,
      fieldHash: this.computeHash(`fields:${report.conditionCount}`),
      materialHash,
      physicsModelHash,
      formulationHash,
      policyHash,
      conditionType: 'BOUNDARY_CONDITION_SET',
      units: 'SI',
      applicabilityValid: report.verdict === BoundaryConditionVerdict.VALID,
      compatibilityValid: report.verdict === BoundaryConditionVerdict.VALID,
      coverageComplete: report.coverageComplete,
      diagnostics: report.diagnostics,
      diagnosticCodes: report.diagnosticCodes,
      verdict: report.verdict,
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
    return `secp060-hash-${Math.abs(hash).toString(16)}`;
  }
}
