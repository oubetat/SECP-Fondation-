/**
 * SECP Industrial OS — M10.6: Explainable Engineering Reasoning Types
 * 
 * Formal representation of auditable engineering reasoning traces, structured step sequences,
 * evidence & contradiction tracking, assumption vs fact boundaries, constraint evaluations,
 * M10.5 uncertainty integration, and strict authority invariants.
 * 
 * Governing Invariants:
 * 1. AI Explanation != Engineering Proof != Verification != Canonical Truth != Release Authorization.
 * 2. Strictly advisory: authorityTag = ADVISORY_EVIDENCE, isCanonicalTruth = false, isCanonicalRelease = false.
 * 3. Structured, deterministic reasoning steps (no hidden or unrecorded reasoning state).
 * 4. Explicit separation of Canonical Facts vs Engineering Assumptions vs AI Inferences.
 * 5. Constraint status preservation: UNKNOWN never silently becomes SATISFIED.
 * 6. Contradictory evidence preservation (SUPPORTING, CONTRADICTING, NEUTRAL).
 * 7. Zero Identity Drift upon serialization and rehydration.
 */

export type ReasoningStepRole =
  | 'OBSERVATION'
  | 'INPUT'
  | 'ASSUMPTION'
  | 'TRANSFORMATION'
  | 'CALCULATED_METRIC'
  | 'COMPARISON'
  | 'INFERENCE'
  | 'CONSTRAINT_CHECK'
  | 'EVIDENCE_REFERENCE'
  | 'VERIFICATION_REFERENCE'
  | 'CONCLUSION'
  | 'LIMITATION';

export type ConstraintEvaluationStatus =
  | 'SATISFIED'
  | 'VIOLATED'
  | 'UNKNOWN'
  | 'NOT_EVALUATED';

export type EvidenceRelationshipType =
  | 'SUPPORTING'
  | 'CONTRADICTING'
  | 'NEUTRAL';

export type EngineeringAssumptionCategory =
  | 'CANONICAL_FACT'
  | 'ENGINEERING_ASSUMPTION'
  | 'AI_INFERENCE';

export type ExplainabilityStatus =
  | 'COMPLETE'
  | 'PARTIAL'
  | 'LIMITED'
  | 'UNVERIFIED'
  | 'CONFLICTED'
  | 'INSUFFICIENT_EVIDENCE';

export interface ReasoningStep {
  readonly stepId: string;
  readonly sequenceNumber: number;
  readonly role: ReasoningStepRole;
  readonly description: string;
  readonly inputsUsed: readonly string[];
  readonly outputsProduced: readonly string[];
  readonly evidenceRef?: string;
  readonly verificationRef?: string;
  readonly constraintRef?: string;
  readonly status?: string;
}

export interface ReasoningAssumption {
  readonly assumptionId: string;
  readonly statement: string;
  readonly category: EngineeringAssumptionCategory;
  readonly rationale: string;
  readonly isCanonicalFact: boolean; // Must be false if category != CANONICAL_FACT
}

export interface ReasoningConstraint {
  readonly constraintId: string;
  readonly name: string;
  readonly thresholdValue: number | string;
  readonly actualValue?: number | string;
  readonly unit?: string;
  readonly status: ConstraintEvaluationStatus;
  readonly rationale?: string;
}

export interface ReasoningEvidenceBinding {
  readonly evidenceId: string;
  readonly relationship: EvidenceRelationshipType;
  readonly claimReference: string;
  readonly summary: string;
  readonly evidenceHash?: string;
}

export interface EngineeringReasoningTrace {
  readonly reasoningId: string; // Deterministic: REASON-AI-<hash>
  readonly schemaVersion: '1.0.0-M10.6';
  readonly claimId: string;
  readonly evidenceId: string;
  readonly uncertaintyAssessmentId?: string;
  readonly verificationId?: string;
  readonly contextHash: string;
  readonly revisionId?: string;
  readonly canonicalRevisionHash?: string;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly executionHash: string;
  readonly inputs: Readonly<Record<string, any>>;
  readonly assumptions: readonly ReasoningAssumption[];
  readonly constraints: readonly ReasoningConstraint[];
  readonly reasoningSteps: readonly ReasoningStep[];
  readonly intermediateFindings: readonly string[];
  readonly evidenceBindings: readonly ReasoningEvidenceBinding[];
  readonly uncertaintyRef?: Readonly<Record<string, any>>;
  readonly verificationRef?: Readonly<Record<string, any>>;
  readonly conclusion: string;
  readonly limitations: readonly string[];
  readonly explanationStatus: ExplainabilityStatus;
  readonly authorityTag: 'ADVISORY_EVIDENCE'; // Invariant: Strictly advisory
  readonly isCanonicalTruth: false; // Invariant: Reasoning is never canonical truth
  readonly isCanonicalRelease: false; // Invariant: Reasoning never authorizes release
  readonly reasoningContentHash: string;
  readonly createdAt: string;
}

export interface ReasoningValidationError {
  readonly code:
    | 'MISSING_REQUIRED_FIELD'
    | 'INVALID_STEP_ORDERING'
    | 'INVALID_STEP_ROLE'
    | 'MISSING_STEP_REFERENCE'
    | 'INVALID_ASSUMPTION_CATEGORY'
    | 'CONSTRAINT_UNKNOWN_OVERRIDDEN'
    | 'EVIDENCE_ID_MISMATCH'
    | 'CONTEXT_HASH_MISMATCH'
    | 'CONTRADICTION_UNHANDLED'
    | 'AUTHORITY_ESCALATION_ATTEMPT'
    | 'UNVERIFIED_CLAIM_ESCALATION';
  readonly message: string;
  readonly path?: string;
}

export interface ReasoningValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ReasoningValidationError[];
}
