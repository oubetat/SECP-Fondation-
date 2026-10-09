/**
 * SECP Industrial OS — EPC-009: Engineering Evidence Package Validator
 */

import { 
  EngineeringEvidencePackage, 
  EvidencePackageError, 
  PackageValidationResult, 
  EvidenceVerdictStatus,
  EvidencePackageLifecycle
} from './EngineeringEvidencePackageTypes';
import { EvidenceIntegrityService } from './EvidenceIntegrityService';
import { IntegrityStatus } from './EvidenceIntegrityTypes';
import { EvidenceProvenanceValidator } from './EvidenceProvenanceValidator';

export class EngineeringEvidencePackageValidator {
  /**
   * Validates the integrity and completeness of an Evidence Package.
   */
  public static validate(pkg: EngineeringEvidencePackage): PackageValidationResult {
    const errors: EvidencePackageError[] = [];
    let status: 'COMPLETE' | 'INCOMPLETE' | 'INVALID' = 'COMPLETE';

    // 1. Identity Check
    if (!pkg.packageId || !pkg.caseId || !pkg.revision) {
      errors.push(EvidencePackageError.INVALID_PACKAGE);
      status = 'INVALID';
    }

    // 2. Requirements Check
    if (pkg.requirements.length === 0) {
      errors.push(EvidencePackageError.MISSING_REQUIREMENT);
      status = 'INCOMPLETE';
    }

    // 3. Design References Check
    if (pkg.design.length === 0) {
      errors.push(EvidencePackageError.MISSING_DESIGN_REFERENCE);
      if (status !== 'INVALID') status = 'INCOMPLETE';
    }

    // 4. Analysis & Scenario Integrity
    for (const analysis of pkg.analyses) {
      if (!analysis.scenarioId) {
        errors.push(EvidencePackageError.MISSING_ANALYSIS_SCENARIO);
        status = 'INVALID';
      }
    }

    // 5. Results & Analysis Orphans
    for (const result of pkg.results) {
      const parentAnalysis = pkg.analyses.find(a => a.analysisId === result.analysisId);
      if (!parentAnalysis && result.source === 'ANALYSIS') {
        errors.push(EvidencePackageError.RESULT_ORPHANED);
        status = 'INVALID';
      }
    }

    // 6. Evidence Source Integrity
    for (const ev of pkg.evidence) {
      if (!ev.sourceReference) {
        errors.push(EvidencePackageError.EVIDENCE_SOURCE_MISSING);
        status = 'INVALID';
      }
    }

    // 7. Verdict & Evidence Linkage
    for (const verdict of pkg.verdicts) {
      if (verdict.evidenceReferences.length === 0) {
        errors.push(EvidencePackageError.VERDICT_WITHOUT_EVIDENCE);
        status = 'INVALID';
      }
      
      // Hardcoded PASS check: If status is PASS but no passing results/tests are linked
      if (verdict.status === EvidenceVerdictStatus.PASS) {
        const hasPassingEvidence = verdict.evidenceReferences.some(ref => {
          const res = pkg.results.find(r => r.resultId === ref);
          const tst = pkg.tests.find(t => t.testId === ref);
          return (res && res.status === EvidenceVerdictStatus.PASS) || (tst && tst.status === EvidenceVerdictStatus.PASS);
        });
        
        if (!hasPassingEvidence) {
          errors.push(EvidencePackageError.HARDCODED_VERDICT_DETECTED);
          status = 'INVALID';
        }
      }
    }

    // 8. Critical Requirement Rule & Traceability Chain
    const traceabilityScore = this.calculateTraceability(pkg, errors);
    if (traceabilityScore < 1.0 && status === 'COMPLETE') {
      status = 'INCOMPLETE';
    }

    // 9. Integrity & Provenance Check (EPC-010 & EPC-011)
    this.checkIntegrityAndProvenance(pkg, errors);
    if (errors.some(e => e === EvidencePackageError.INTEGRITY_FAILURE)) {
      status = 'INVALID';
    }

    // Determine Overall Verdict
    const verdict = this.deriveOverallVerdict(pkg, status);

    return {
      status,
      verdict,
      errors,
      traceabilityScore
    };
  }

  /**
   * Calculates the traceability score and enforces Critical Requirement Rule.
   */
  private static calculateTraceability(pkg: EngineeringEvidencePackage, errors: EvidencePackageError[]): number {
    if (pkg.requirements.length === 0) return 0;

    let tracedCount = 0;
    let criticalUntraced = false;

    for (const req of pkg.requirements) {
      const isTraced = this.isRequirementTraced(req, pkg);
      if (isTraced) {
        tracedCount++;
      } else if (req.priority === 'CRITICAL') {
        criticalUntraced = true;
        errors.push(EvidencePackageError.CRITICAL_REQUIREMENT_UNTRACED);
      }
    }

    if (criticalUntraced) {
      errors.push(EvidencePackageError.INCOMPLETE_TRUTH_CHAIN);
    }

    return tracedCount / pkg.requirements.length;
  }

  /**
   * Verifies if a requirement has a complete truth chain:
   * Requirement -> Design -> Analysis/Test -> Evidence -> Verdict
   */
  private static isRequirementTraced(req: any, pkg: EngineeringEvidencePackage): boolean {
    // 1. Trace to Design
    const designs = pkg.design.filter(d => 
      d.parameters && Object.keys(d.parameters).some(k => k.includes(req.requirementId)) ||
      (pkg.metadata?.traceMap?.[req.requirementId]?.designId)
    );
    
    // Note: In a real implementation, this would use TraceabilityTypes.ts
    // For this core capability, we look for explicit links.
    const hasDesign = designs.length > 0 || !!pkg.metadata?.traceMap?.[req.requirementId];
    if (!hasDesign) return false;

    // 2. Trace to Analysis or Test
    const hasVerification = pkg.analyses.some(a => a.inputReferences?.includes(req.requirementId)) ||
                            pkg.tests.some(t => t.description.includes(req.requirementId));
    if (!hasVerification) return false;

    // 3. Trace to Evidence
    const hasEvidence = pkg.evidence.some(e => {
      // Direct link
      if (e.sourceReference === req.requirementId) return true;
      
      // Link via Result
      const result = pkg.results.find(r => r.resultId === e.sourceReference);
      if (result) {
        const analysis = pkg.analyses.find(a => a.analysisId === result.analysisId);
        if (analysis && analysis.inputReferences?.includes(req.requirementId)) return true;
      }

      // Link via Test
      const test = pkg.tests.find(t => t.testId === e.sourceReference);
      if (test && test.description.includes(req.requirementId)) return true;

      return false;
    });
    
    // 4. Trace to Verdict
    const hasVerdict = pkg.verdicts.some(v => v.subjectId === req.requirementId);

    return hasVerification && hasEvidence && hasVerdict;
  }

  /**
   * Checks integrity and provenance for all critical artifacts.
   */
  private static checkIntegrityAndProvenance(pkg: EngineeringEvidencePackage, errors: EvidencePackageError[]): void {
    // Check Results
    for (const res of pkg.results) {
      const integrity = EvidenceIntegrityService.verifyIntegrity(res, pkg.integrityRecords[res.resultId]);
      if (integrity.status !== IntegrityStatus.VALID) {
        errors.push(EvidencePackageError.INTEGRITY_FAILURE);
      }
      
      const prov = pkg.provenanceRecords[res.resultId];
      if (!prov || !EvidenceProvenanceValidator.validate(prov).valid) {
        errors.push(EvidencePackageError.PROVENANCE_MISSING);
      }
    }

    // Check Tests
    for (const test of pkg.tests) {
      const integrity = EvidenceIntegrityService.verifyIntegrity(test, pkg.integrityRecords[test.testId]);
      if (integrity.status !== IntegrityStatus.VALID) {
        errors.push(EvidencePackageError.INTEGRITY_FAILURE);
      }

      const prov = pkg.provenanceRecords[test.testId];
      if (!prov || !EvidenceProvenanceValidator.validate(prov).valid) {
        errors.push(EvidencePackageError.PROVENANCE_MISSING);
      }
    }
  }

  /**
   * Derives the overall verdict from individual verdicts and completeness status.
   */
  private static deriveOverallVerdict(pkg: EngineeringEvidencePackage, status: string): EvidenceVerdictStatus {
    if (status === 'INVALID') return EvidenceVerdictStatus.FAIL;
    if (pkg.verdicts.length === 0) return EvidenceVerdictStatus.INCONCLUSIVE;

    const hasFail = pkg.verdicts.some(v => v.status === EvidenceVerdictStatus.FAIL);
    if (hasFail) return EvidenceVerdictStatus.FAIL;

    const allPass = pkg.verdicts.every(v => v.status === EvidenceVerdictStatus.PASS);
    if (allPass && status === 'COMPLETE') return EvidenceVerdictStatus.PASS;

    return EvidenceVerdictStatus.INCONCLUSIVE;
  }
}
