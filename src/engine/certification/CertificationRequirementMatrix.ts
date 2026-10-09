/**
 * SECP Industrial OS v3 — Certification Requirement Matrix
 * Defines the mandatory claims and evidence required for each certification level.
 */

import { CertificationRequirement, RequirementMatrix, CertificationLevel, CertificationDomain } from './CertificationTypes';

export const BASELINE_REQUIREMENTS: CertificationRequirement[] = [
  // Level 1: Verified (Internal)
  { id: 'REQ-GEO-INT', description: 'Internal B-Rep Integrity Pass', mandatory: true, domain: 'GEOMETRY', minLevel: CertificationLevel.LEVEL_1_VERIFIED },
  { id: 'REQ-MSH-VAL', description: 'Internal Mesh Quality Thresholds Pass', mandatory: true, domain: 'MESH', minLevel: CertificationLevel.LEVEL_1_VERIFIED },
  { id: 'REQ-SLV-CNV', description: 'Internal Solver Convergence Pass', mandatory: true, domain: 'SOLVER', minLevel: CertificationLevel.LEVEL_1_VERIFIED },
  
  // Level 2: Validated (Reference)
  { id: 'REQ-REF-CMP', description: 'Result Comparison with Independent Reference', mandatory: true, domain: 'RESULT', minLevel: CertificationLevel.LEVEL_2_VALIDATED },
  { id: 'REQ-TOL-CTR', description: 'Tolerance Contract Compliance', mandatory: true, domain: 'RESULT', minLevel: CertificationLevel.LEVEL_2_VALIDATED },
  
  // Level 3: Reproducible
  { id: 'REQ-DET-RT', description: 'Deterministic Execution Proof (PATCH-182)', mandatory: true, domain: 'REPRODUCIBILITY', minLevel: CertificationLevel.LEVEL_3_REPRODUCIBLE },
  { id: 'REQ-PKG-REP', description: 'Package Replay Success (PATCH-183)', mandatory: true, domain: 'REPRODUCIBILITY', minLevel: CertificationLevel.LEVEL_3_REPRODUCIBLE },
  
  // Level 4: Externally Validated
  { id: 'REQ-EXT-VAL', description: 'Third-party Oracle Certification (PATCH-185)', mandatory: true, domain: 'EXTERNAL_VALIDATION', minLevel: CertificationLevel.LEVEL_4_EXTERNALLY_VALIDATED },
  { id: 'REQ-IND-REPLAY', description: 'Independent Environment Replay Success', mandatory: true, domain: 'EXTERNAL_VALIDATION', minLevel: CertificationLevel.LEVEL_4_EXTERNALLY_VALIDATED },
  
  // Level 5: Fully Certified
  { id: 'REQ-FULL-EVID', description: 'Complete Evidence Ledger Binding', mandatory: true, domain: 'ENGINEERING_FULL', minLevel: CertificationLevel.LEVEL_5_CERTIFIED },
  { id: 'REQ-GOV-GATE', description: 'Final Governance Board Approval', mandatory: true, domain: 'ENGINEERING_FULL', minLevel: CertificationLevel.LEVEL_5_CERTIFIED }
];

export class CertificationRequirementMatrix {
  public static getMatrixForDomain(domain: CertificationDomain, targetLevel: CertificationLevel): RequirementMatrix {
    const requirements = BASELINE_REQUIREMENTS.filter(r => 
      (r.domain === domain || r.domain === 'ENGINEERING_FULL') && 
      r.minLevel <= targetLevel
    );

    return {
      matrixId: `MAT-${domain}-${targetLevel}`,
      domain,
      targetLevel,
      requirements
    };
  }
}
