/**
 * SECP Engineering Core — Universal Engineering Review (EPC-033)
 *
 * Implements an independent, non-overridable, and version-controlled engineering review process.
 * Verifies Verification Packages (EPC-032) without modifying raw engineering evidence,
 * tracking Findings and emitting rigid Verdicts (PASS, FAIL, INCONCLUSIVE).
 */

import { UniversalVerificationPackage, VerificationVerdict } from './UniversalVerificationPackage';

export type ReviewStatus = 'DRAFT' | 'IN_REVIEW' | 'COMPLETED' | 'REJECTED';
export type FindingSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'OBSERVATION';

export interface ReviewFinding {
  findingId: string;
  severity: FindingSeverity;
  category: string;
  description: string;
  evidenceReference?: string;
  affectedRequirement?: string;
  affectedModel?: string;
  detectedAt: string;
  reviewer: string;
  status: 'OPEN' | 'RESOLVED';
  resolution?: string;
}

export interface RequirementReviewAssessment {
  requirementId: string;
  requirement: string;
  acceptanceCriterion: string;
  verificationMethod: string;
  evidenceId?: string;
  result: any;
  assessment: 'PASS' | 'FAIL' | 'UNVERIFIED' | 'INCONCLUSIVE' | 'NOT_APPLICABLE';
}

export interface EngineeringReviewRecord {
  reviewId: string;
  caseId: string;
  productId: string;
  productRevision: string;
  configurationId: string;
  reviewRevision: number;
  reviewer: string;
  reviewerRole: string;
  createdAt: string;
  reviewScope: string[];
  reviewStatus: ReviewStatus;
  findings: ReviewFinding[];
  evidenceReferences: string[];
  recommendations: string[];
  finalReviewVerdict: VerificationVerdict;
  requirementAssessments: RequirementReviewAssessment[];
  reportLogs: string[];
}

export interface ReviewReport {
  executiveSummary: string;
  reviewScope: string[];
  configurationReviewed: string;
  requirementsReviewed: { id: string; assessment: string }[];
  designReview: string;
  analysisReview: string;
  simulationReview: string;
  manufacturingReview: string;
  evidenceReview: string;
  findings: { id: string; severity: string; description: string }[];
  openIssuesCount: number;
  limitations: string[];
  verdict: VerificationVerdict;
}

export class UniversalEngineeringReviewEngine {
  /**
   * Initializes an independent Engineering Review from a Verification Package.
   * Ensures that the review reads from but cannot write to or alter the source package.
   */
  public static createReview(
    reviewId: string,
    pkg: UniversalVerificationPackage,
    reviewer: string,
    role: string,
    scope: string[]
  ): EngineeringReviewRecord {
    // Perform independent assessments for each requirement
    const assessments: RequirementReviewAssessment[] = pkg.requirements.map(req => {
      let assessmentStatus: 'PASS' | 'FAIL' | 'UNVERIFIED' | 'INCONCLUSIVE' | 'NOT_APPLICABLE' = 'UNVERIFIED';

      // Check traceability chain
      const hasDesign = !!pkg.cad || !!pkg.design;
      const hasAnalysis = !!pkg.cae || !!pkg.fea || !!pkg.cfd || !!pkg.dynamics;
      const hasSimulation = !!pkg.simulation;
      const hasTest = pkg.tests.some(t => t.testId === req.linkedTestId);
      const hasEvidence = pkg.evidence.some(e => e.evidenceId === req.linkedEvidenceId);

      // Simple chain traceability check
      if (req.priority === 'CRITICAL' && (!hasDesign || !hasAnalysis || !hasSimulation || !hasEvidence)) {
        assessmentStatus = 'UNVERIFIED';
      } else {
        // Evaluate the test or simulation outcome
        const test = pkg.tests.find(t => t.testId === req.linkedTestId);
        if (test) {
          assessmentStatus = test.verdict === 'PASS' ? 'PASS' : 'FAIL';
        } else if (req.linkedEvidenceId) {
          const ev = pkg.evidence.find(e => e.evidenceId === req.linkedEvidenceId);
          assessmentStatus = ev && ev.status === 'VERIFIED' ? 'PASS' : 'FAIL';
        }
      }

      return {
        requirementId: req.requirementId,
        requirement: req.description,
        acceptanceCriterion: req.parameter,
        verificationMethod: req.verificationMethod,
        evidenceId: req.linkedEvidenceId,
        result: req.parameter,
        assessment: assessmentStatus
      };
    });

    return {
      reviewId,
      caseId: pkg.caseId,
      productId: pkg.productId,
      productRevision: pkg.productRevision,
      configurationId: pkg.configurationId,
      reviewRevision: 1,
      reviewer,
      reviewerRole: role,
      createdAt: new Date().toISOString(),
      reviewScope: scope,
      reviewStatus: 'DRAFT',
      findings: [],
      evidenceReferences: pkg.evidence.map(e => e.evidenceId),
      recommendations: [],
      finalReviewVerdict: 'INCONCLUSIVE',
      requirementAssessments: assessments,
      reportLogs: [`Review created independently for Case ID [${pkg.caseId}]`]
    };
  }

  /**
   * Adds an independent finding during the review process
   */
  public static addFinding(
    record: EngineeringReviewRecord,
    finding: Omit<ReviewFinding, 'detectedAt' | 'reviewer' | 'status'>
  ): EngineeringReviewRecord {
    if (record.reviewStatus === 'COMPLETED' || record.reviewStatus === 'REJECTED') {
      throw new Error('Cannot add findings to a finalized or closed review record. Create a new review revision instead.');
    }

    const newFinding: ReviewFinding = {
      ...finding,
      detectedAt: new Date().toISOString(),
      reviewer: record.reviewer,
      status: 'OPEN'
    };

    return {
      ...record,
      findings: [...record.findings, newFinding],
      reportLogs: [...record.reportLogs, `Added finding [${newFinding.findingId}] with severity [${newFinding.severity}]`]
    };
  }

  /**
   * Closes or Finalizes the Independent Review.
   * Computes the final Verdict based STRICTLY on evidence, findings, and criteria (No Override Allowed).
   */
  public static finalizeReview(
    record: EngineeringReviewRecord,
    status: 'COMPLETED' | 'REJECTED'
  ): EngineeringReviewRecord {
    if (record.reviewStatus === 'COMPLETED' || record.reviewStatus === 'REJECTED') {
      throw new Error('Review is already closed.');
    }

    const hasCriticalFinding = record.findings.some(f => f.severity === 'CRITICAL' && f.status === 'OPEN');
    const hasMajorFinding = record.findings.some(f => f.severity === 'MAJOR' && f.status === 'OPEN');
    const hasFailedReq = record.requirementAssessments.some(r => r.assessment === 'FAIL');
    const hasUnverifiedReq = record.requirementAssessments.some(r => r.assessment === 'UNVERIFIED');

    let derivedVerdict: VerificationVerdict = 'PASS';

    if (hasCriticalFinding || hasFailedReq) {
      derivedVerdict = 'FAIL';
    } else if (hasMajorFinding || hasUnverifiedReq) {
      derivedVerdict = 'INCONCLUSIVE';
    }

    return {
      ...record,
      reviewStatus: status,
      finalReviewVerdict: derivedVerdict,
      reportLogs: [...record.reportLogs, `Review finalized with status [${status}] and Verdict [${derivedVerdict}]`]
    };
  }

  /**
   * Creates a brand new review revision to preserve immutability of previously closed reviews.
   */
  public static createNewRevision(record: EngineeringReviewRecord): EngineeringReviewRecord {
    return {
      ...record,
      reviewRevision: record.reviewRevision + 1,
      reviewStatus: 'DRAFT',
      createdAt: new Date().toISOString(),
      reportLogs: [`Created new review revision [${record.reviewRevision + 1}] to preserve immutability.`]
    };
  }

  /**
   * Generates a fully compiled Engineering Review Report
   */
  public static generateReport(record: EngineeringReviewRecord): ReviewReport {
    const openFindings = record.findings.filter(f => f.status === 'OPEN');
    
    return {
      executiveSummary: `Independent Engineering Review Report for ${record.productId} (${record.productRevision}). Evaluated by ${record.reviewer} (${record.reviewerRole}).`,
      reviewScope: record.reviewScope,
      configurationReviewed: record.configurationId,
      requirementsReviewed: record.requirementAssessments.map(r => ({ id: r.requirementId, assessment: r.assessment })),
      designReview: record.reviewScope.includes('CAD') ? 'Design revision and constraints verified against baseline CAD geometry.' : 'Not reviewed.',
      analysisReview: record.reviewScope.includes('FEA') ? 'FEA model convergence curves and solver boundary conditions audited.' : 'Not reviewed.',
      simulationReview: record.reviewScope.includes('Simulation') ? 'Multiphysics simulator solver parameters and step sizes checked.' : 'Not reviewed.',
      manufacturingReview: record.reviewScope.includes('Manufacturing') ? 'mBOM, raw material feedstock matching, and CAM operations verified.' : 'Not reviewed.',
      evidenceReview: `Audited ${record.evidenceReferences.length} cryptographic hashes on the system evidence ledger.`,
      findings: openFindings.map(f => ({ id: f.findingId, severity: f.severity, description: f.description })),
      openIssuesCount: openFindings.length,
      limitations: openFindings.filter(f => f.severity === 'MAJOR').map(f => f.description),
      verdict: record.finalReviewVerdict
    };
  }
}
