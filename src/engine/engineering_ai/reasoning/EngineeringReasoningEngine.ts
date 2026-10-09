import {
  EngineeringReasoningTrace,
  ReasoningStep,
  ReasoningAssumption,
  ReasoningConstraint,
  ReasoningEvidenceBinding,
  ExplainabilityStatus,
  ReasoningValidationResult,
  ReasoningValidationError,
  ReasoningStepRole
} from './types';
import { IndependentVerificationSerializer } from '../verification/IndependentVerificationSerializer';
import { AIEvidenceEnvelope } from '../evidence/EngineeringAIEvidenceBinder';
import { UncertaintyAssessment } from '../uncertainty/types';
import { TwinEvidenceGraphEngine } from '../../twin_evidence/TwinEvidenceGraphEngine';
import { EvidenceCanonicalizer } from '../../twin_evidence/EvidenceCanonicalizer';

export interface CreateReasoningTraceParams {
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
  readonly explanationStatus?: ExplainabilityStatus;
  readonly createdAt?: string;
}

export interface RehydratedReasoningResult {
  readonly valid: boolean;
  readonly trace: EngineeringReasoningTrace;
  readonly recomputedContentHash: string;
  readonly details: string;
}

/**
 * EngineeringReasoningEngine (M10.6)
 * 
 * Formal Explainable Engineering Reasoning Engine.
 * Constructs, validates, canonicalizes, and rehydrates auditable engineering reasoning traces.
 * 
 * Governing Invariants:
 * 1. AI Explanation != Engineering Proof != Verification != Canonical Truth != Release Authorization.
 * 2. Strictly advisory authority: authorityTag = ADVISORY_EVIDENCE, isCanonicalTruth = false, isCanonicalRelease = false.
 * 3. Deterministic identity: REASON-AI-<hash of canonical components>.
 * 4. Explicit separation: Canonical Facts vs Engineering Assumptions vs AI Inferences.
 * 5. Constraint status preservation: UNKNOWN never silently becomes SATISFIED.
 * 6. Contradictory evidence preservation: SUPPORTING, CONTRADICTING, NEUTRAL.
 * 7. Zero Identity Drift upon serialization and rehydration.
 */
export class EngineeringReasoningEngine {
  public static readonly SCHEMA_VERSION = '1.0.0-M10.6';

  /**
   * Deterministically computes the reasoning trace identity.
   */
  public static computeReasoningId(
    modelId: string,
    contextHash: string,
    executionHash: string,
    evidenceId: string,
    claimId: string,
    conclusion: string,
    inputs: Record<string, any> = {},
    canonicalRevisionHash: string = '',
    revisionId: string = ''
  ): string {
    const inputsJson = IndependentVerificationSerializer.canonicalJson(inputs || {});
    const raw = `SECP_REASONING_TRACE|${modelId}|${contextHash}|${executionHash}|${evidenceId}|${claimId}|${conclusion}|${canonicalRevisionHash}|${revisionId}|${inputsJson}`;
    return `REASON-AI-${IndependentVerificationSerializer.hash(raw).substring(0, 24)}`;
  }

  /**
   * Derives the explainability status automatically based on the actual engineering state.
   */
  public static deriveExplainabilityStatus(
    evidenceBindings: readonly ReasoningEvidenceBinding[],
    constraints: readonly ReasoningConstraint[],
    verificationRef?: Readonly<Record<string, any>>,
    uncertaintyRef?: Readonly<Record<string, any>>
  ): ExplainabilityStatus {
    // 1. Contradictions exist
    const hasContradiction = evidenceBindings.some(b => b.relationship === 'CONTRADICTING');
    if (hasContradiction) {
      return 'CONFLICTED';
    }

    // 2. Missing or unverified evidence
    if (evidenceBindings.length === 0) {
      return 'INSUFFICIENT_EVIDENCE';
    }

    // 3. Constraint violations or unknown constraint states
    const hasViolatedConstraint = constraints.some(c => c.status === 'VIOLATED');
    const hasUnknownConstraint = constraints.some(c => c.status === 'UNKNOWN');
    if (hasViolatedConstraint || hasUnknownConstraint) {
      return 'LIMITED';
    }

    // 4. Verification missing or unverified
    if (!verificationRef || verificationRef.verdict !== 'VERIFIED') {
      return 'UNVERIFIED';
    }

    // 5. Complete and verified
    return 'COMPLETE';
  }

  /**
   * Validates structural requirements, step ordering, assumption categories, constraint statuses,
   * evidence bindings, and authority boundary invariants.
   */
  public static validateReasoningTrace(trace: Partial<EngineeringReasoningTrace>): ReasoningValidationResult {
    const errors: ReasoningValidationError[] = [];

    // 1. Mandatory Structural Fields
    if (!trace.claimId) {
      errors.push({ code: 'MISSING_REQUIRED_FIELD', message: 'claimId is required.', path: 'claimId' });
    }
    if (!trace.evidenceId) {
      errors.push({ code: 'MISSING_REQUIRED_FIELD', message: 'evidenceId is required.', path: 'evidenceId' });
    }
    if (!trace.contextHash) {
      errors.push({ code: 'MISSING_REQUIRED_FIELD', message: 'contextHash is required.', path: 'contextHash' });
    }
    if (!trace.executionHash) {
      errors.push({ code: 'MISSING_REQUIRED_FIELD', message: 'executionHash is required.', path: 'executionHash' });
    }
    if (!trace.modelId) {
      errors.push({ code: 'MISSING_REQUIRED_FIELD', message: 'modelId is required.', path: 'modelId' });
    }
    if (!trace.conclusion) {
      errors.push({ code: 'MISSING_REQUIRED_FIELD', message: 'conclusion is required.', path: 'conclusion' });
    }

    // 2. Authority Boundary Invariants
    if (trace.authorityTag !== 'ADVISORY_EVIDENCE') {
      errors.push({
        code: 'AUTHORITY_ESCALATION_ATTEMPT',
        message: `authorityTag must be strictly ADVISORY_EVIDENCE, received ${trace.authorityTag}`,
        path: 'authorityTag'
      });
    }
    if (trace.isCanonicalTruth !== false) {
      errors.push({
        code: 'AUTHORITY_ESCALATION_ATTEMPT',
        message: 'isCanonicalTruth must be strictly false. Explanation cannot establish canonical truth.',
        path: 'isCanonicalTruth'
      });
    }
    if (trace.isCanonicalRelease !== false) {
      errors.push({
        code: 'AUTHORITY_ESCALATION_ATTEMPT',
        message: 'isCanonicalRelease must be strictly false. Explanation cannot authorize release.',
        path: 'isCanonicalRelease'
      });
    }

    // 3. Reasoning Steps Validation & Ordering
    if (!trace.reasoningSteps || trace.reasoningSteps.length === 0) {
      errors.push({ code: 'MISSING_REQUIRED_FIELD', message: 'reasoningSteps must be non-empty.', path: 'reasoningSteps' });
    } else {
      let expectedSeq = 1;
      const validRoles: ReasoningStepRole[] = [
        'OBSERVATION', 'INPUT', 'ASSUMPTION', 'TRANSFORMATION',
        'CALCULATED_METRIC', 'COMPARISON', 'INFERENCE', 'CONSTRAINT_CHECK',
        'EVIDENCE_REFERENCE', 'VERIFICATION_REFERENCE', 'CONCLUSION', 'LIMITATION'
      ];

      for (let i = 0; i < trace.reasoningSteps.length; i++) {
        const step = trace.reasoningSteps[i];
        if (step.sequenceNumber !== expectedSeq) {
          errors.push({
            code: 'INVALID_STEP_ORDERING',
            message: `Step sequenceNumber out of order at index ${i}: expected ${expectedSeq}, got ${step.sequenceNumber}`,
            path: `reasoningSteps[${i}].sequenceNumber`
          });
        }
        expectedSeq++;

        if (!validRoles.includes(step.role)) {
          errors.push({
            code: 'INVALID_STEP_ROLE',
            message: `Invalid step role '${step.role}' at index ${i}`,
            path: `reasoningSteps[${i}].role`
          });
        }

        if (step.role === 'EVIDENCE_REFERENCE' && !step.evidenceRef) {
          errors.push({
            code: 'MISSING_STEP_REFERENCE',
            message: `Step with role EVIDENCE_REFERENCE must provide evidenceRef at index ${i}`,
            path: `reasoningSteps[${i}].evidenceRef`
          });
        }

        if (step.role === 'VERIFICATION_REFERENCE' && !step.verificationRef) {
          errors.push({
            code: 'MISSING_STEP_REFERENCE',
            message: `Step with role VERIFICATION_REFERENCE must provide verificationRef at index ${i}`,
            path: `reasoningSteps[${i}].verificationRef`
          });
        }
      }
    }

    // 4. Assumptions & Category Rules
    if (trace.assumptions) {
      for (let i = 0; i < trace.assumptions.length; i++) {
        const ass = trace.assumptions[i];
        if ((ass.category === 'ENGINEERING_ASSUMPTION' || ass.category === 'AI_INFERENCE') && ass.isCanonicalFact) {
          errors.push({
            code: 'INVALID_ASSUMPTION_CATEGORY',
            message: `Assumption with category '${ass.category}' cannot claim isCanonicalFact=true at index ${i}`,
            path: `assumptions[${i}].isCanonicalFact`
          });
        }
      }
    }

    // 5. Constraints Rules
    if (trace.constraints) {
      const validConstraintStatuses = ['SATISFIED', 'VIOLATED', 'UNKNOWN', 'NOT_EVALUATED'];
      for (let i = 0; i < trace.constraints.length; i++) {
        const c = trace.constraints[i];
        if (!validConstraintStatuses.includes(c.status)) {
          errors.push({
            code: 'MISSING_REQUIRED_FIELD',
            message: `Invalid constraint status '${c.status}' at index ${i}`,
            path: `constraints[${i}].status`
          });
        }
      }
    }

    // 6. Contradictions & Explanation Status Checks
    if (trace.evidenceBindings) {
      const hasContradiction = trace.evidenceBindings.some(b => b.relationship === 'CONTRADICTING');
      if (hasContradiction && trace.explanationStatus === 'COMPLETE') {
        errors.push({
          code: 'CONTRADICTION_UNHANDLED',
          message: 'Cannot report explanationStatus as COMPLETE when contradicting evidence exists.',
          path: 'explanationStatus'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Constructs a certified, deterministic EngineeringReasoningTrace object.
   */
  public static createReasoningTrace(params: CreateReasoningTraceParams): EngineeringReasoningTrace {
    // 0. Explicit Authority Hardening (M10.8)
    // Even though types might prevent this, runtime malformed payloads or 'any' casts might attempt it.
    const p = params as any;
    if (p.isCanonicalTruth === true || p.isCanonicalRelease === true || (p.authorityTag && p.authorityTag !== 'ADVISORY_EVIDENCE')) {
      throw new Error('REASONING_VALIDATION_ERROR: [AUTHORITY_ESCALATION_ATTEMPT] Attempted to create authoritative reasoning trace.');
    }

    const derivedStatus = params.explanationStatus || this.deriveExplainabilityStatus(
      params.evidenceBindings,
      params.constraints,
      params.verificationRef,
      params.uncertaintyRef
    );

    const rawTrace: Partial<EngineeringReasoningTrace> = {
      claimId: params.claimId,
      evidenceId: params.evidenceId,
      uncertaintyAssessmentId: params.uncertaintyAssessmentId,
      verificationId: params.verificationId,
      contextHash: params.contextHash,
      revisionId: params.revisionId,
      canonicalRevisionHash: params.canonicalRevisionHash,
      modelId: params.modelId,
      modelVersion: params.modelVersion,
      executionHash: params.executionHash,
      inputs: params.inputs,
      assumptions: params.assumptions,
      constraints: params.constraints,
      reasoningSteps: params.reasoningSteps,
      intermediateFindings: params.intermediateFindings,
      evidenceBindings: params.evidenceBindings,
      uncertaintyRef: params.uncertaintyRef,
      verificationRef: params.verificationRef,
      conclusion: params.conclusion,
      limitations: params.limitations,
      explanationStatus: derivedStatus,
      authorityTag: 'ADVISORY_EVIDENCE',
      isCanonicalTruth: false,
      isCanonicalRelease: false,
      createdAt: params.createdAt || new Date().toISOString()
    };

    const validation = this.validateReasoningTrace(rawTrace);
    if (!validation.valid) {
      throw new Error(`REASONING_VALIDATION_ERROR: ${validation.errors.map(e => `[${e.code}] ${e.message}`).join('; ')}`);
    }

    const reasoningId = this.computeReasoningId(
      params.modelId,
      params.contextHash,
      params.executionHash,
      params.evidenceId,
      params.claimId,
      params.conclusion,
      params.inputs || {},
      params.canonicalRevisionHash || '',
      params.revisionId || ''
    );

    const contentPayload = {
      reasoningId,
      claimId: params.claimId,
      evidenceId: params.evidenceId,
      uncertaintyAssessmentId: params.uncertaintyAssessmentId,
      verificationId: params.verificationId,
      contextHash: params.contextHash,
      revisionId: params.revisionId,
      canonicalRevisionHash: params.canonicalRevisionHash,
      modelId: params.modelId,
      modelVersion: params.modelVersion,
      executionHash: params.executionHash,
      inputs: params.inputs,
      assumptions: params.assumptions,
      constraints: params.constraints,
      reasoningSteps: params.reasoningSteps,
      intermediateFindings: params.intermediateFindings,
      evidenceBindings: params.evidenceBindings,
      uncertaintyRef: params.uncertaintyRef,
      verificationRef: params.verificationRef,
      conclusion: params.conclusion,
      limitations: params.limitations,
      explanationStatus: derivedStatus,
      authorityTag: 'ADVISORY_EVIDENCE',
      isCanonicalTruth: false,
      isCanonicalRelease: false,
      createdAt: rawTrace.createdAt
    };

    const reasoningContentHash = IndependentVerificationSerializer.hash(
      IndependentVerificationSerializer.canonicalJson(contentPayload)
    );

    const trace: EngineeringReasoningTrace = {
      reasoningId,
      schemaVersion: this.SCHEMA_VERSION,
      claimId: params.claimId,
      evidenceId: params.evidenceId,
      uncertaintyAssessmentId: params.uncertaintyAssessmentId,
      verificationId: params.verificationId,
      contextHash: params.contextHash,
      revisionId: params.revisionId,
      canonicalRevisionHash: params.canonicalRevisionHash,
      modelId: params.modelId,
      modelVersion: params.modelVersion,
      executionHash: params.executionHash,
      inputs: Object.freeze({ ...params.inputs }),
      assumptions: Object.freeze([...params.assumptions]),
      constraints: Object.freeze([...params.constraints]),
      reasoningSteps: Object.freeze([...params.reasoningSteps]),
      intermediateFindings: Object.freeze([...params.intermediateFindings]),
      evidenceBindings: Object.freeze([...params.evidenceBindings]),
      uncertaintyRef: params.uncertaintyRef ? Object.freeze({ ...params.uncertaintyRef }) : undefined,
      verificationRef: params.verificationRef ? Object.freeze({ ...params.verificationRef }) : undefined,
      conclusion: params.conclusion,
      limitations: Object.freeze([...params.limitations]),
      explanationStatus: derivedStatus,
      authorityTag: 'ADVISORY_EVIDENCE',
      isCanonicalTruth: false,
      isCanonicalRelease: false,
      reasoningContentHash,
      createdAt: rawTrace.createdAt!
    };

    return Object.freeze(trace);
  }

  /**
   * Binds the reasoning trace to an M10.4 evidence envelope and registers/updates TwinEvidenceGraph.
   */
  public static bindToEvidenceEnvelope(
    trace: EngineeringReasoningTrace,
    envelope: AIEvidenceEnvelope,
    evidenceEngine?: TwinEvidenceGraphEngine
  ): void {
    if (trace.evidenceId !== envelope.evidenceId) {
      throw new Error(`EVIDENCE_BINDING_MISMATCH: Trace evidenceId '${trace.evidenceId}' does not match Envelope evidenceId '${envelope.evidenceId}'`);
    }

    if (trace.contextHash !== envelope.provenance.contextHash) {
      throw new Error(`EVIDENCE_BINDING_MISMATCH: Trace contextHash '${trace.contextHash}' does not match Envelope contextHash '${envelope.provenance.contextHash}'`);
    }

    if (trace.modelId !== envelope.subject.modelId) {
      throw new Error(`EVIDENCE_BINDING_MISMATCH: Trace modelId '${trace.modelId}' does not match Envelope modelId '${envelope.subject.modelId}'`);
    }

    if (evidenceEngine) {
      let node = evidenceEngine.graph.nodes.get(envelope.evidenceId);
      if (node) {
        node.attributes = {
          ...node.attributes,
          reasoningTrace: trace,
          reasoningId: trace.reasoningId,
          reasoningContentHash: trace.reasoningContentHash,
          explanationStatus: trace.explanationStatus
        };
        node.contentHash = EvidenceCanonicalizer.computeNodeHash(node);
        evidenceEngine.updateRootHash();
      }
    }
  }

  /**
   * Serializes a reasoning trace to canonical JSON.
   */
  public static serializeTrace(trace: EngineeringReasoningTrace): string {
    return IndependentVerificationSerializer.canonicalJson(trace);
  }

  /**
   * Rehydrates and strictly validates a reasoning trace from persistent storage.
   */
  public static rehydrateAndValidate(
    serializedJson: string,
    expectedEnvelope?: AIEvidenceEnvelope,
    expectedUncertainty?: UncertaintyAssessment
  ): RehydratedReasoningResult {
    let parsed: any;
    try {
      parsed = JSON.parse(serializedJson);
    } catch (e: any) {
      throw new Error(`REASONING_REHYDRATION_ERROR: Malformed JSON payload (${e.message})`);
    }

    const validation = this.validateReasoningTrace(parsed);
    if (!validation.valid) {
      throw new Error(`REASONING_REHYDRATION_ERROR: ${validation.errors.map(e => `[${e.code}] ${e.message}`).join('; ')}`);
    }

    // Recompute content hash
    const contentPayload = {
      reasoningId: parsed.reasoningId,
      claimId: parsed.claimId,
      evidenceId: parsed.evidenceId,
      uncertaintyAssessmentId: parsed.uncertaintyAssessmentId,
      verificationId: parsed.verificationId,
      contextHash: parsed.contextHash,
      revisionId: parsed.revisionId,
      canonicalRevisionHash: parsed.canonicalRevisionHash,
      modelId: parsed.modelId,
      modelVersion: parsed.modelVersion,
      executionHash: parsed.executionHash,
      inputs: parsed.inputs,
      assumptions: parsed.assumptions,
      constraints: parsed.constraints,
      reasoningSteps: parsed.reasoningSteps,
      intermediateFindings: parsed.intermediateFindings,
      evidenceBindings: parsed.evidenceBindings,
      uncertaintyRef: parsed.uncertaintyRef,
      verificationRef: parsed.verificationRef,
      conclusion: parsed.conclusion,
      limitations: parsed.limitations,
      explanationStatus: parsed.explanationStatus,
      authorityTag: 'ADVISORY_EVIDENCE',
      isCanonicalTruth: false,
      isCanonicalRelease: false,
      createdAt: parsed.createdAt
    };

    const recomputedHash = IndependentVerificationSerializer.hash(
      IndependentVerificationSerializer.canonicalJson(contentPayload)
    );

    if (recomputedHash !== parsed.reasoningContentHash) {
      throw new Error(`REASONING_REHYDRATION_ERROR: Content hash tampered: expected ${parsed.reasoningContentHash}, computed ${recomputedHash}`);
    }

    const recomputedId = this.computeReasoningId(
      parsed.modelId,
      parsed.contextHash,
      parsed.executionHash,
      parsed.evidenceId,
      parsed.claimId,
      parsed.conclusion,
      parsed.inputs || {},
      parsed.canonicalRevisionHash || '',
      parsed.revisionId || ''
    );

    if (recomputedId !== parsed.reasoningId) {
      throw new Error(`REASONING_REHYDRATION_ERROR: Reasoning ID tampered: expected ${parsed.reasoningId}, computed ${recomputedId}`);
    }

    if (expectedEnvelope) {
      if (parsed.evidenceId !== expectedEnvelope.evidenceId) {
        throw new Error(`REASONING_REHYDRATION_ERROR: Envelope evidenceId mismatch (${parsed.evidenceId} vs ${expectedEnvelope.evidenceId})`);
      }
      if (parsed.contextHash !== expectedEnvelope.provenance.contextHash) {
        throw new Error(`REASONING_REHYDRATION_ERROR: Envelope contextHash mismatch (${parsed.contextHash} vs ${expectedEnvelope.provenance.contextHash})`);
      }
    }

    if (expectedUncertainty) {
      if (parsed.uncertaintyAssessmentId && parsed.uncertaintyAssessmentId !== expectedUncertainty.assessmentId) {
        throw new Error(`REASONING_REHYDRATION_ERROR: Uncertainty assessmentId mismatch (${parsed.uncertaintyAssessmentId} vs ${expectedUncertainty.assessmentId})`);
      }
    }

    return {
      valid: true,
      trace: Object.freeze(parsed as EngineeringReasoningTrace),
      recomputedContentHash: recomputedHash,
      details: 'REASONING_REHYDRATION_VERIFIED'
    };
  }
}
