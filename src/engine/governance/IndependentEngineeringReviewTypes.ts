
import { EvidenceBus314 } from '../engineering_ai/copilot/EvidenceBus314';

export type ReviewerType = 'INTERNAL_PEER' | 'INDEPENDENT_INTERNAL' | 'EXTERNAL_EXPERT' | 'REGULATORY_AUTHORITY';

export type ReviewVerdict = 'ACCEPT' | 'ACCEPT_WITH_LIMITATIONS' | 'REJECT' | 'INCONCLUSIVE';

export type FindingSeverity = 'INFO' | 'MINOR' | 'MAJOR' | 'CRITICAL';

export interface Finding {
  findingId: string;
  severity: FindingSeverity;
  domain: string;
  evidenceId?: string;
  description: string;
  recommendation?: string;
  status: 'OPEN' | 'REMEDIATED' | 'VERIFIED' | 'CLOSED';
}

export interface IndependentReviewer {
  reviewerId: string;
  name: string;
  organization: string;
  role: string;
  qualification: string;
}

export interface ReviewScope {
  domain: string;
  modelRevision: string;
  operatingRange?: string;
  includedEvidenceIds: string[];
}

export interface IndependentEngineeringReview {
  reviewId: string;
  projectId: string;
  reviewer: IndependentReviewer;
  scope: ReviewScope;
  findings: Finding[];
  verdict: ReviewVerdict;
  rationale: string;
  timestamp: string;
  evidenceHash: string;
}

export interface ReviewReport {
  reviewId: string;
  summary: string;
  findingsCount: Record<FindingSeverity, number>;
  verdict: ReviewVerdict;
  limitations: string[];
  evidencePackageHash: string;
}
