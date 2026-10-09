import {
  CrossDomainDependency,
  CrossDomainInferenceTrace,
  DomainReconciliationFinding,
  ReconciliationStatus,
  FreshnessState,
  DependencyRelationship,
  CrossDomainValidationError,
  CrossDomainValidationResult
} from './types';
import { EngineeringDomain, EngineeringServiceType } from '../../crossdomain/CrossDomainTypes';
import { IndependentVerificationSerializer } from '../verification/IndependentVerificationSerializer';
import { EngineeringReasoningTrace } from '../reasoning/types';
import { UncertaintyAssessment } from '../uncertainty/types';
import { AIEvidenceEnvelope } from '../evidence/EngineeringAIEvidenceBinder';
import { TwinEvidenceGraphEngine } from '../../twin_evidence/TwinEvidenceGraphEngine';
import { EvidenceCanonicalizer } from '../../twin_evidence/EvidenceCanonicalizer';

export interface CreateCrossDomainInferenceParams {
  readonly contextId: string;
  readonly contextHash: string;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly executionHash: string;
  readonly dependencies: readonly CrossDomainDependency[];
  readonly findings: readonly DomainReconciliationFinding[];
  readonly reasoningTrace?: EngineeringReasoningTrace;
  readonly uncertaintyAssessment?: UncertaintyAssessment;
  readonly createdAt?: string;
}

/**
 * CrossDomainIntelligenceEngine (M10.7)
 * 
 * Manages cross-domain engineering intelligence, dependency freshness, 
 * truth reconciliation, and conflict preservation.
 * 
 * Governing Invariants:
 * 1. AI Intelligence != Engineering Authority.
 * 2. UNKNOWN != CURRENT; STALE != CURRENT.
 * 3. Deterministic cross-domain identity.
 * 4. No silent conflict resolution.
 */
export class CrossDomainIntelligenceEngine {
  public static readonly SCHEMA_VERSION = '1.0.0-M10.7';

  /**
   * Deterministically computes a dependency identity.
   */
  public static computeDependencyId(
    sourceDomain: string,
    sourceRevisionHash: string,
    sourceResultHash: string,
    sourceContextHash: string,
    relationship: string
  ): string {
    const raw = `SECP_DEP|${sourceDomain}|${sourceRevisionHash}|${sourceResultHash}|${sourceContextHash}|${relationship}`;
    return `DEP-${IndependentVerificationSerializer.hash(raw).substring(0, 20)}`;
  }

  /**
   * Deterministically computes the cross-domain inference identity.
   */
  public static computeInferenceId(
    modelId: string,
    contextHash: string,
    executionHash: string,
    dependencyGroupHash: string
  ): string {
    const raw = `SECP_CD_INF|${modelId}|${contextHash}|${executionHash}|${dependencyGroupHash}`;
    return `CD-INF-AI-${IndependentVerificationSerializer.hash(raw).substring(0, 24)}`;
  }

  /**
   * Derives the reconciliation status from dependencies and findings.
   */
  public static deriveReconciliationStatus(
    dependencies: readonly CrossDomainDependency[],
    findings: readonly DomainReconciliationFinding[]
  ): ReconciliationStatus {
    // 1. Check for missing or stale mandatory dependencies
    const hasMissing = dependencies.some(d => d.freshness === 'MISSING');
    if (hasMissing) return 'MISSING_DEPENDENCY';

    const hasStale = dependencies.some(d => d.freshness === 'STALE');
    if (hasStale) return 'STALE_DEPENDENCY';

    const hasUnknown = dependencies.some(d => d.freshness === 'UNKNOWN');
    if (hasUnknown) return 'UNKNOWN';

    // 2. Check for conflicts in findings
    const hasConflict = findings.some(f => f.status === 'CONFLICT');
    if (hasConflict) return 'CONFLICTED';

    // 3. Partial or full agreement
    const hasIncomplete = findings.some(f => f.status === 'INCOMPLETE' || f.status === 'UNKNOWN');
    if (hasIncomplete) return 'PARTIALLY_RECONCILED';

    if (findings.length === 0) return 'INSUFFICIENT_EVIDENCE';

    return 'RECONCILED';
  }

  /**
   * Validates the cross-domain inference trace against engineering invariants.
   */
  public static validateInference(trace: Partial<CrossDomainInferenceTrace>): CrossDomainValidationResult {
    const errors: CrossDomainValidationError[] = [];

    // 1. Mandatory Fields
    if (!trace.contextHash) errors.push({ code: 'CONTEXT_DRIFT_DETECTED', message: 'contextHash is required.' });
    if (!trace.modelId) errors.push({ code: 'DEPENDENCY_IDENTITY_TAMPERED', message: 'modelId is required.' });
    if (!trace.dependencies || trace.dependencies.length === 0) {
      errors.push({ code: 'MISSING_MANDATORY_DOMAIN', message: 'At least one cross-domain dependency is required.' });
    }

    // 2. Freshness Enforcement
    if (trace.dependencies) {
      for (let i = 0; i < trace.dependencies.length; i++) {
        const dep = trace.dependencies[i];
        if (dep.freshness === 'STALE' || dep.freshness === 'INVALID') {
          errors.push({ 
            code: 'STALE_DEPENDENCY_IN_CURRENT_INFERENCE', 
            message: `Dependency ${dep.dependencyId} from ${dep.sourceDomain} is ${dep.freshness}.`,
            path: `dependencies[${i}]`
          });
        }

        // Verify deterministic dependency ID
        const recomputedDepId = this.computeDependencyId(
          dep.sourceDomain,
          dep.sourceRevisionHash,
          dep.sourceResultHash,
          dep.sourceContextHash,
          dep.relationship
        );
        if (recomputedDepId !== dep.dependencyId) {
          errors.push({
            code: 'DEPENDENCY_IDENTITY_TAMPERED',
            message: `Dependency identity tampered for ${dep.sourceDomain}: expected ${dep.dependencyId}, computed ${recomputedDepId}`,
            path: `dependencies[${i}].dependencyId`
          });
        }
      }
    }

    // 3. Truth Reconciliation: Detect silent conflict suppression
    if (trace.findings && trace.reconciliationStatus === 'RECONCILED') {
      const actualConflicts = trace.findings.filter(f => f.status === 'CONFLICT');
      if (actualConflicts.length > 0) {
        errors.push({
          code: 'CONFLICT_SILENTLY_RESOLVED',
          message: 'Status cannot be RECONCILED when explicit conflicts exist in findings.',
          path: 'reconciliationStatus'
        });
      }
    }

    // 4. Authority Boundaries
    if (trace.authorityTag !== 'ADVISORY_EVIDENCE') {
      errors.push({ code: 'AUTHORITY_ESCALATION', message: 'authorityTag must be ADVISORY_EVIDENCE.' });
    }
    if (trace.isCanonicalTruth !== false) {
      errors.push({ code: 'AUTHORITY_ESCALATION', message: 'isCanonicalTruth must be false.' });
    }
    if (trace.isCanonicalRelease !== false) {
      errors.push({ code: 'AUTHORITY_ESCALATION', message: 'isCanonicalRelease must be false.' });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Creates a certified cross-domain inference trace.
   */
  public static createInferenceTrace(params: CreateCrossDomainInferenceParams): CrossDomainInferenceTrace {
    // 0. Explicit Authority Hardening (M10.8)
    const p = params as any;
    if (p.isCanonicalTruth === true || p.isCanonicalRelease === true || (p.authorityTag && p.authorityTag !== 'ADVISORY_EVIDENCE')) {
      throw new Error('CROSS_DOMAIN_VALIDATION_ERROR: [AUTHORITY_ESCALATION] Attempted to create authoritative cross-domain inference.');
    }

    const dependencyGroupHash = IndependentVerificationSerializer.hash(
      IndependentVerificationSerializer.canonicalJson(params.dependencies.map(d => d.dependencyId).sort())
    );

    const reconciliationStatus = this.deriveReconciliationStatus(params.dependencies, params.findings);

    const rawTrace: Partial<CrossDomainInferenceTrace> = {
      contextId: params.contextId,
      contextHash: params.contextHash,
      modelId: params.modelId,
      modelVersion: params.modelVersion,
      executionHash: params.executionHash,
      dependencies: params.dependencies,
      dependencyGroupHash,
      reconciliationStatus,
      findings: params.findings,
      reasoningTraceId: params.reasoningTrace?.reasoningId,
      reasoningTrace: params.reasoningTrace,
      uncertaintyAssessmentId: params.uncertaintyAssessment?.assessmentId,
      uncertaintyAssessment: params.uncertaintyAssessment,
      authorityTag: 'ADVISORY_EVIDENCE',
      isCanonicalTruth: false,
      isCanonicalRelease: false,
      createdAt: params.createdAt || new Date().toISOString()
    };

    const validation = this.validateInference(rawTrace);
    if (!validation.valid) {
      throw new Error(`CROSS_DOMAIN_VALIDATION_ERROR: ${validation.errors.map(e => `[${e.code}] ${e.message}`).join('; ')}`);
    }

    const inferenceId = this.computeInferenceId(
      params.modelId,
      params.contextHash,
      params.executionHash,
      dependencyGroupHash
    );

    const contentPayload = {
      inferenceId,
      contextId: params.contextId,
      contextHash: params.contextHash,
      modelId: params.modelId,
      modelVersion: params.modelVersion,
      executionHash: params.executionHash,
      dependencies: params.dependencies,
      dependencyGroupHash,
      reconciliationStatus,
      findings: params.findings,
      reasoningTraceId: params.reasoningTrace?.reasoningId,
      uncertaintyAssessmentId: params.uncertaintyAssessment?.assessmentId,
      authorityTag: 'ADVISORY_EVIDENCE',
      isCanonicalTruth: false,
      isCanonicalRelease: false,
      createdAt: rawTrace.createdAt
    };

    const contentHash = IndependentVerificationSerializer.hash(
      IndependentVerificationSerializer.canonicalJson(contentPayload)
    );

    const trace: CrossDomainInferenceTrace = {
      inferenceId,
      schemaVersion: this.SCHEMA_VERSION,
      contextId: params.contextId,
      contextHash: params.contextHash,
      modelId: params.modelId,
      modelVersion: params.modelVersion,
      executionHash: params.executionHash,
      dependencies: Object.freeze([...params.dependencies]),
      dependencyGroupHash,
      reconciliationStatus,
      findings: Object.freeze([...params.findings]),
      reasoningTraceId: params.reasoningTrace?.reasoningId,
      reasoningTrace: params.reasoningTrace ? Object.freeze({ ...params.reasoningTrace }) : undefined,
      uncertaintyAssessmentId: params.uncertaintyAssessment?.assessmentId,
      uncertaintyAssessment: params.uncertaintyAssessment ? Object.freeze({ ...params.uncertaintyAssessment }) : undefined,
      authorityTag: 'ADVISORY_EVIDENCE',
      isCanonicalTruth: false,
      isCanonicalRelease: false,
      contentHash,
      createdAt: rawTrace.createdAt!
    };

    return Object.freeze(trace);
  }

  /**
   * Binds the cross-domain trace to an M10.4 evidence envelope.
   */
  public static bindToEvidenceEnvelope(
    trace: CrossDomainInferenceTrace,
    envelope: AIEvidenceEnvelope,
    evidenceEngine?: TwinEvidenceGraphEngine
  ): void {
    if (trace.contextHash !== envelope.provenance.contextHash) {
      throw new Error(`EVIDENCE_BINDING_MISMATCH: CrossDomainTrace contextHash mismatch.`);
    }

    if (evidenceEngine) {
      let node = evidenceEngine.graph.nodes.get(envelope.evidenceId);
      if (node) {
        node.attributes = {
          ...node.attributes,
          crossDomainInference: trace,
          reconciliationStatus: trace.reconciliationStatus,
          dependencyGroupHash: trace.dependencyGroupHash
        };
        node.contentHash = EvidenceCanonicalizer.computeNodeHash(node);
        evidenceEngine.updateRootHash();
      }
    }
  }

  /**
   * Rehydrates and validates a cross-domain trace from JSON.
   */
  public static rehydrateAndValidate(
    serializedJson: string,
    expectedEnvelope?: AIEvidenceEnvelope
  ): { valid: boolean; trace: CrossDomainInferenceTrace; details: string } {
    let parsed: any;
    try {
      parsed = JSON.parse(serializedJson);
    } catch (e: any) {
      throw new Error(`CROSS_DOMAIN_REHYDRATION_ERROR: Malformed JSON.`);
    }

    const validation = this.validateInference(parsed);
    if (!validation.valid) {
      throw new Error(`CROSS_DOMAIN_REHYDRATION_ERROR: ${validation.errors.map(e => `[${e.code}] ${e.message}`).join('; ')}`);
    }

    // Recompute content hash
    const contentPayload = {
      inferenceId: parsed.inferenceId,
      contextId: parsed.contextId,
      contextHash: parsed.contextHash,
      modelId: parsed.modelId,
      modelVersion: parsed.modelVersion,
      executionHash: parsed.executionHash,
      dependencies: parsed.dependencies,
      dependencyGroupHash: parsed.dependencyGroupHash,
      reconciliationStatus: parsed.reconciliationStatus,
      findings: parsed.findings,
      reasoningTraceId: parsed.reasoningTraceId,
      uncertaintyAssessmentId: parsed.uncertaintyAssessmentId,
      authorityTag: 'ADVISORY_EVIDENCE',
      isCanonicalTruth: false,
      isCanonicalRelease: false,
      createdAt: parsed.createdAt
    };

    const recomputedHash = IndependentVerificationSerializer.hash(
      IndependentVerificationSerializer.canonicalJson(contentPayload)
    );

    if (recomputedHash !== parsed.contentHash) {
      throw new Error(`CROSS_DOMAIN_REHYDRATION_ERROR: Content hash tampered.`);
    }

    if (expectedEnvelope && parsed.contextHash !== expectedEnvelope.provenance.contextHash) {
      throw new Error(`CROSS_DOMAIN_REHYDRATION_ERROR: Context drift detected during rehydration.`);
    }

    return {
      valid: true,
      trace: Object.freeze(parsed as CrossDomainInferenceTrace),
      details: 'CROSS_DOMAIN_REHYDRATION_VERIFIED'
    };
  }
}
