/**
 * SECP Industrial OS — Certificate Completeness Checker
 * 
 * Verifies that all domains required by the CertificationScope
 * have authoritative, uncorrupted evidence present in the certificate payload.
 */

import { CertificationScope, EvidenceLeafRecord } from './types';
import { EngineeringEvidenceRecord } from '../../evidence/ledger/types';

export interface CompletenessResult {
  isComplete: boolean;
  missing: string[];
}

export class CertificateCompletenessChecker {
  public static checkCompleteness(
    scope: CertificationScope[] | string[],
    evidence: (EngineeringEvidenceRecord | EvidenceLeafRecord | any)[]
  ): CompletenessResult {
    if (!scope || scope.length === 0) {
      return { isComplete: false, missing: ['EMPTY_CERTIFICATION_SCOPE'] };
    }

    const presentEvidenceTypes = new Set<string>();
    if (evidence && Array.isArray(evidence)) {
      for (const e of evidence) {
        if (e && e.evidenceType) {
          presentEvidenceTypes.add(String(e.evidenceType).toUpperCase());
        }
      }
    }

    const missing: string[] = [];

    for (const sc of scope) {
      const scopeKey = String(sc).toUpperCase();

      switch (scopeKey) {
        case CertificationScope.GEOMETRY:
        case CertificationScope.GEOMETRY_INTEGRITY:
          if (!this.hasAny(presentEvidenceTypes, ['CAD', 'GEOMETRY', 'TOPOLOGY', 'BREP'])) {
            missing.push(scopeKey);
          }
          break;

        case CertificationScope.SIMULATION_RESULT:
        case CertificationScope.STRUCTURAL:
          if (!this.hasAny(presentEvidenceTypes, ['SIMULATION', 'FEA', 'CFD', 'SIMULATION_RESULT'])) {
            missing.push(scopeKey);
          }
          break;

        case CertificationScope.MANUFACTURING:
          if (!this.hasAny(presentEvidenceTypes, ['MANUFACTURING', 'CAM', 'TOOLPATH', 'CAM_TOOLPATH'])) {
            missing.push(scopeKey);
          }
          break;

        case CertificationScope.CAM_TOOLPATH:
          if (!this.hasAny(presentEvidenceTypes, ['CAM', 'CAM_TOOLPATH', 'TOOLPATH'])) {
            missing.push(scopeKey);
          }
          break;

        case CertificationScope.DFM:
          if (!this.hasAny(presentEvidenceTypes, ['DFM', 'MANUFACTURABILITY'])) {
            missing.push(scopeKey);
          }
          break;

        case CertificationScope.PHYSICAL_METROLOGY:
          if (!this.hasAny(presentEvidenceTypes, ['METROLOGY', 'CMM', 'INSPECTION'])) {
            missing.push(scopeKey);
          }
          break;

        case CertificationScope.REPRODUCIBILITY:
          if (!this.hasAny(presentEvidenceTypes, ['VERIFICATION', 'REPRODUCIBILITY', 'VALIDATION'])) {
            missing.push(scopeKey);
          }
          break;

        default:
          if (!presentEvidenceTypes.has(scopeKey)) {
            missing.push(scopeKey);
          }
          break;
      }
    }

    return {
      isComplete: missing.length === 0,
      missing
    };
  }

  private static hasAny(types: Set<string>, candidates: string[]): boolean {
    return candidates.some(c => types.has(c));
  }
}
