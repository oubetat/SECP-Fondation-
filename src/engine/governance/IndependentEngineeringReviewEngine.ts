
import { 
  IndependentEngineeringReview, 
  IndependentReviewer, 
  ReviewScope, 
  Finding, 
  ReviewVerdict,
  ReviewReport
} from './IndependentEngineeringReviewTypes';
import { EvidenceBus314 } from '../engineering_ai/copilot/EvidenceBus314';

export class IndependentEngineeringReviewEngine {
  private static instance: IndependentEngineeringReviewEngine;
  private evidenceBus = EvidenceBus314.getInstance();
  private reviews: Map<string, IndependentEngineeringReview> = new Map();

  private constructor() {}

  public static getInstance(): IndependentEngineeringReviewEngine {
    if (!IndependentEngineeringReviewEngine.instance) {
      IndependentEngineeringReviewEngine.instance = new IndependentEngineeringReviewEngine();
    }
    return IndependentEngineeringReviewEngine.instance;
  }

  /**
   * Initiates an independent engineering review session
   */
  public async createReview(
    projectId: string,
    reviewer: IndependentReviewer,
    scope: ReviewScope
  ): Promise<IndependentEngineeringReview> {
    const reviewId = `REV-ENG-${Date.now()}`;
    console.log(`[GOVERNANCE] Creating Independent Review ${reviewId} for Project ${projectId}...`);

    const review: IndependentEngineeringReview = {
      reviewId,
      projectId,
      reviewer,
      scope,
      findings: [],
      verdict: 'INCONCLUSIVE',
      rationale: 'Review initiated. Pending evidence analysis.',
      timestamp: new Date().toISOString(),
      evidenceHash: this.calculateEvidenceHash(scope.includedEvidenceIds)
    };

    this.reviews.set(reviewId, review);
    this.registerReviewEvidence(review);
    return review;
  }

  /**
   * Records a specific finding during the review process
   */
  public async addFinding(reviewId: string, finding: Omit<Finding, 'findingId' | 'status'>): Promise<Finding> {
    const review = this.reviews.get(reviewId);
    if (!review) throw new Error(`REVIEW_NOT_FOUND: ${reviewId}`);

    const newFinding: Finding = {
      ...finding,
      findingId: `FIND-${reviewId}-${review.findings.length + 1}`,
      status: 'OPEN'
    };

    review.findings.push(newFinding);
    console.log(`[GOVERNANCE] Added Finding ${newFinding.findingId} (Severity: ${newFinding.severity}) to Review ${reviewId}`);
    
    this.registerFindingEvidence(reviewId, newFinding);
    return newFinding;
  }

  /**
   * Finalizes the review with a verdict and rationale
   */
  public async finalizeReview(reviewId: string, verdict: ReviewVerdict, rationale: string): Promise<ReviewReport> {
    const review = this.reviews.get(reviewId);
    if (!review) throw new Error(`REVIEW_NOT_FOUND: ${reviewId}`);

    review.verdict = verdict;
    review.rationale = rationale;
    review.timestamp = new Date().toISOString();

    console.log(`[GOVERNANCE] Finalizing Review ${reviewId} with Verdict: ${verdict}`);

    const report: ReviewReport = {
      reviewId,
      summary: rationale,
      findingsCount: {
        INFO: review.findings.filter(f => f.severity === 'INFO').length,
        MINOR: review.findings.filter(f => f.severity === 'MINOR').length,
        MAJOR: review.findings.filter(f => f.severity === 'MAJOR').length,
        CRITICAL: review.findings.filter(f => f.severity === 'CRITICAL').length
      },
      verdict,
      limitations: [],
      evidencePackageHash: review.evidenceHash
    };

    this.registerVerdictEvidence(review);
    return report;
  }

  private calculateEvidenceHash(evidenceIds: string[]): string {
    // Simulated hash of the evidence package
    return `HASH-${evidenceIds.length}-${Date.now()}`;
  }

  private registerReviewEvidence(review: IndependentEngineeringReview): void {
    this.evidenceBus.registerEvidence(
      'IndependentEngineeringReviewEngine',
      review.reviewId,
      review.scope.modelRevision,
      'IndependentEngineeringReviewEngine',
      'VALIDATED',
      { type: 'REVIEW_INIT', reviewer: review.reviewer.name, scope: JSON.stringify(review.scope) }
    );
  }

  private registerFindingEvidence(reviewId: string, finding: Finding): void {
    this.evidenceBus.registerEvidence(
      'IndependentEngineeringReviewEngine',
      finding.findingId,
      'REV-FINDING',
      'IndependentEngineeringReviewEngine',
      'VALIDATED',
      { reviewId, severity: finding.severity, domain: finding.domain }
    );
  }

  private registerVerdictEvidence(review: IndependentEngineeringReview): void {
    this.evidenceBus.registerEvidence(
      'IndependentEngineeringReviewEngine',
      `VERDICT-${review.reviewId}`,
      review.scope.modelRevision,
      'IndependentEngineeringReviewEngine',
      review.verdict === 'REJECT' ? 'FAILED' : 'VALIDATED',
      { reviewId: review.reviewId, verdict: review.verdict, rationale: review.rationale }
    );
  }

  public getReview(reviewId: string): IndependentEngineeringReview | undefined {
    return this.reviews.get(reviewId);
  }
}
