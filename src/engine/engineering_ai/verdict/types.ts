export type EngineeringVerdict =
  | 'SAFE'
  | 'UNSAFE'
  | 'PASS'
  | 'FAIL'
  | 'QUALIFIED'
  | 'NOT_QUALIFIED'
  | 'COMPLIANT'
  | 'NON_COMPLIANT'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACCEPTED'
  | 'REJECTED_FOR_PRODUCTION'
  | 'PRODUCTION_READY'
  | 'DESIGN_VALID'
  | 'DESIGN_INVALID'
  | 'MANUFACTURABLE'
  | 'NOT_MANUFACTURABLE'
  | 'MATERIAL_QUALIFIED'
  | 'MATERIAL_NOT_QUALIFIED'
  | 'SIMULATION_VALID'
  | 'SIMULATION_INVALID';

export type AIHallucinationType =
  | 'UNSUPPORTED_VERDICT'
  | 'UNSUPPORTED_CLAIM'
  | 'FABRICATED_NUMBER'
  | 'FABRICATED_SOURCE'
  | 'FABRICATED_STANDARD'
  | 'FABRICATED_PROPERTY'
  | 'CONTEXT_HALLUCINATION'
  | 'REVISION_HALLUCINATION'
  | 'UNIT_HALLUCINATION'
  | 'CAUSALITY_HALLUCINATION'
  | 'CONFIDENCE_HALLUCINATION'
  | 'COMPLIANCE_HALLUCINATION'
  | 'SAFETY_HALLUCINATION';

export type BlockReasonTaxonomy =
  | 'NO_EVIDENCE'
  | 'INSUFFICIENT_EVIDENCE'
  | 'INVALID_EVIDENCE'
  | 'EXPIRED_EVIDENCE'
  | 'REVOKED_EVIDENCE'
  | 'REVISION_MISMATCH'
  | 'CONTEXT_MISMATCH'
  | 'MATERIAL_MISMATCH'
  | 'UNRESOLVED_CONFLICT'
  | 'INSUFFICIENT_INDEPENDENCE'
  | 'INSUFFICIENT_COVERAGE'
  | 'UNCERTAINTY_TOO_HIGH'
  | 'UNSUPPORTED_CLAIM'
  | 'AUTHORIZATION_REQUIRED'
  | 'FABRICATED_NUMBER'
  | 'FABRICATED_STANDARD';

export interface VerdictEvidenceProfile {
  verdictType: EngineeringVerdict;
  requiredEvidenceTypes: string[];
  minimumEvidenceCount: number;
  minimumAuthority: string;
  minimumVerification: boolean;
  minimumCoverage: number;
  minimumIndependence: boolean;
  maximumEvidenceAge?: number;
  requiredContext?: Record<string, any>;
}

export interface VerdictResponse {
  verdictState: 'ALLOWED' | 'BLOCKED' | 'AUTHORIZATION_REQUIRED';
  verdict?: EngineeringVerdict;
  reason?: BlockReasonTaxonomy;
  evidenceStatus: 'INSUFFICIENT' | 'VALIDATED' | 'MISSING' | 'CONFLICTED';
  evidenceIds: string[];
  supportScore: number;
  coverage: number;
  uncertainty: number;
  conflicts: string[];
  assumptions: any[];
  verificationState: string;
  authorizationState: 'AUTHORIZED' | 'UNAUTHORIZED' | 'PENDING_REVIEW';
}

export interface AIHallucinationEvent {
  eventId: string;
  sessionId: string;
  modelId: string;
  modelVersion: string;
  hallucinationType: AIHallucinationType;
  claim: string;
  evidenceState: string;
  detectedBy: string;
  timestamp: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  blocked: boolean;
}
