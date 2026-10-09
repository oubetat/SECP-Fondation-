import {
  EngineeringAIModel,
  EngineeringAIContext,
  AIInferenceRecord
} from '../types';
import {
  HardenedVerificationReport,
  VerifierIndependenceLevel
} from '../verification/types';
import { IndependentVerificationSerializer } from '../verification/IndependentVerificationSerializer';
import { TwinEvidenceGraphEngine } from '../../twin_evidence/TwinEvidenceGraphEngine';
import { TwinEvidenceNode } from '../../twin_evidence/types';

export interface AIEvidenceSubject {
  readonly modelId: string;
  readonly modelVersion: string;
  readonly revisionId?: string;
  readonly canonicalRevisionHash?: string;
  readonly geometryHash?: string;
}

export interface AIEvidenceProvenanceChain {
  readonly modelHash: string;
  readonly contextHash: string;
  readonly inputHash: string;
  readonly outputHash: string;
  readonly executionHash: string;
  readonly seed?: number;
  readonly dissimilarDigest?: string;
  readonly originRuntime: string;
  readonly timestamp: string;
}

export interface AIEvidenceEnvelope {
  readonly evidenceId: string;
  readonly evidenceType: 'AI_INFERENCE_VERIFICATION_LEAF';
  readonly schemaVersion: '1.0.0-M10.4';
  readonly subject: AIEvidenceSubject;
  readonly verification: {
    readonly verdict: string;
    readonly overallPassed: boolean;
    readonly independenceLevel: VerifierIndependenceLevel;
    readonly authorityTag: 'ADVISORY_EVIDENCE';
    readonly dissimilarDigest?: string;
    readonly verifiedAt: string;
  };
  readonly provenance: AIEvidenceProvenanceChain;
  readonly contentHash: string;
  readonly isCanonicalRelease: false; // Invariant: AI evidence is never canonical release
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RehydrationValidationResult {
  readonly valid: boolean;
  readonly envelope: AIEvidenceEnvelope;
  readonly recomputedContentHash: string;
  readonly details: string;
}

/**
 * EngineeringAIEvidenceBinder (M10.4)
 * 
 * Formal Evidence-Binding & Cross-Domain Truth Engine.
 * Connects independently verified Engineering Intelligence outputs to the SECP
 * canonical evidence graph and provenance infrastructure.
 * 
 * Governing Invariants:
 * 1. Deterministic evidence identity derived from canonical inputs.
 * 2. Zero-trust in runtime memoization: digests recomputed independently.
 * 3. Preserves verifier classification: FULLY_INDEPENDENT_DISSIMILAR.
 * 4. Preserves verifier authority: ADVISORY_EVIDENCE only (never canonical release).
 * 5. Rejects stale or cross-revision binding.
 * 6. Guarantees persistence and rehydration without identity drift.
 */
export class EngineeringAIEvidenceBinder {
  public static readonly SCHEMA_VERSION = '1.0.0-M10.4';

  /**
   * Deterministically computes the evidence leaf identity.
   */
  public static computeEvidenceId(
    modelHash: string,
    contextHash: string,
    executionHash: string,
    dissimilarDigest: string = '',
    canonicalRevisionHash: string = ''
  ): string {
    const raw = `SECP_AI_EVIDENCE_LEAF|${modelHash}|${contextHash}|${executionHash}|${dissimilarDigest}|${canonicalRevisionHash}`;
    return `EV-AI-${IndependentVerificationSerializer.hash(raw).substring(0, 24)}`;
  }

  /**
   * Binds an independently verified AI inference into a canonical Evidence Envelope.
   */
  public static createEvidenceEnvelope(
    record: AIInferenceRecord,
    model: EngineeringAIModel,
    context: EngineeringAIContext,
    report: HardenedVerificationReport,
    evidenceEngine?: TwinEvidenceGraphEngine
  ): AIEvidenceEnvelope {
    // 1. Invariant: Only independently verified reports may be bound to evidence
    if (report.independenceLevel !== 'FULLY_INDEPENDENT_DISSIMILAR') {
      throw new Error(`EVIDENCE_BINDING_BREACH: Independence level must be FULLY_INDEPENDENT_DISSIMILAR, got ${report.independenceLevel}`);
    }

    if (report.authorityTag !== 'ADVISORY_EVIDENCE') {
      throw new Error(`EVIDENCE_BINDING_BREACH: Authority tag must be strictly ADVISORY_EVIDENCE, got ${report.authorityTag}`);
    }

    // 2. Invariant: Zero-trust in memoization - recompute and verify all digests
    const computedModelHash = IndependentVerificationSerializer.computeModelHash(model);
    if (computedModelHash !== model.modelHash) {
      throw new Error(`EVIDENCE_BINDING_BREACH: Model hash mismatch during evidence binding.`);
    }

    const computedContextHash = IndependentVerificationSerializer.computeContextHash(context);
    if (computedContextHash !== record.contextHash) {
      throw new Error(`EVIDENCE_BINDING_BREACH: Context hash mismatch during evidence binding.`);
    }

    const revisionId = context.configurationState?.revisionId;
    const canonicalRevisionHash = context.configurationState?.canonicalRevisionHash;
    const geometryHash = context.geometryState?.geometryHash || context.geometryState?.hash;

    // 3. Compute deterministic evidence ID and content hash
    const evidenceId = this.computeEvidenceId(
      computedModelHash,
      computedContextHash,
      record.executionHash,
      report.dissimilarDigest || '',
      canonicalRevisionHash || ''
    );

    const provenance: AIEvidenceProvenanceChain = {
      modelHash: computedModelHash,
      contextHash: computedContextHash,
      inputHash: record.inputHash,
      outputHash: record.outputHash,
      executionHash: record.executionHash,
      seed: record.seed,
      dissimilarDigest: report.dissimilarDigest,
      originRuntime: 'SECP-EngineeringAIRuntime-v2',
      timestamp: report.timestamp
    };

    const subject: AIEvidenceSubject = {
      modelId: model.modelId,
      modelVersion: model.version,
      revisionId,
      canonicalRevisionHash,
      geometryHash
    };

    const contentPayload = {
      evidenceId,
      subject,
      verificationVerdict: report.verdict,
      overallPassed: report.overallPassed,
      independenceLevel: report.independenceLevel,
      authorityTag: report.authorityTag,
      provenance
    };

    const contentHash = IndependentVerificationSerializer.hash(
      IndependentVerificationSerializer.canonicalJson(contentPayload)
    );

    const envelope: AIEvidenceEnvelope = {
      evidenceId,
      evidenceType: 'AI_INFERENCE_VERIFICATION_LEAF',
      schemaVersion: this.SCHEMA_VERSION,
      subject,
      verification: {
        verdict: report.verdict,
        overallPassed: report.overallPassed,
        independenceLevel: report.independenceLevel,
        authorityTag: 'ADVISORY_EVIDENCE',
        dissimilarDigest: report.dissimilarDigest,
        verifiedAt: report.timestamp
      },
      provenance,
      contentHash,
      isCanonicalRelease: false
    };

    // 4. Optionally register directly into the Twin Evidence Graph
    if (evidenceEngine) {
      this.registerInTwinEvidenceGraph(envelope, record, evidenceEngine);
    }

    return envelope;
  }

  /**
   * Registers the Evidence Envelope as an immutable node and edge in the TwinEvidenceGraph.
   */
  public static registerInTwinEvidenceGraph(
    envelope: AIEvidenceEnvelope,
    record: AIInferenceRecord,
    engine: TwinEvidenceGraphEngine
  ): TwinEvidenceNode {
    const nodeId = envelope.evidenceId;

    const node = engine.addNode(
      nodeId,
      'VERIFICATION_RESULT',
      envelope.subject.modelId,
      envelope.subject.modelVersion,
      'IndependentAIVerifier',
      envelope.verification.verifiedAt,
      {
        evidenceEnvelope: envelope,
        contentHash: envelope.contentHash,
        dissimilarDigest: envelope.verification.dissimilarDigest,
        authorityTag: envelope.verification.authorityTag,
        verdict: envelope.verification.verdict
      }
    );

    // If an inference node already exists, create the VERIFIES edge
    const inferenceNodeId = `AI-INF-${record.inferenceId}`;
    if (engine.graph.nodes.has(inferenceNodeId)) {
      engine.addEdge(
        `EDGE-VERIF-${envelope.evidenceId}`,
        nodeId,
        inferenceNodeId,
        'VERIFIES'
      );
    }

    // If a revision node exists, link to the revision
    if (envelope.subject.revisionId) {
      const revNodeId = `REV-${envelope.subject.revisionId}`;
      if (engine.graph.nodes.has(revNodeId)) {
        engine.addEdge(
          `EDGE-REV-${envelope.evidenceId}`,
          nodeId,
          revNodeId,
          'DEPENDS_ON'
        );
      }
    }

    return node;
  }

  /**
   * Serializes an evidence envelope for persistent storage.
   */
  public static serializeEnvelope(envelope: AIEvidenceEnvelope): string {
    return IndependentVerificationSerializer.canonicalJson(envelope);
  }

  /**
   * Rehydrates and strictly validates an evidence envelope from persistent storage.
   * Performs zero-trust cryptographic verification of all digests and context invariants.
   */
  public static rehydrateAndValidate(
    serializedJson: string,
    expectedContext?: EngineeringAIContext
  ): RehydrationValidationResult {
    let parsed: any;
    try {
      parsed = JSON.parse(serializedJson);
    } catch (e: any) {
      throw new Error(`EVIDENCE_REHYDRATION_ERROR: Malformed JSON payload (${e.message})`);
    }

    // Invariant: Authority must remain strictly ADVISORY_EVIDENCE
    if (parsed.isCanonicalRelease !== false || parsed.verification?.authorityTag !== 'ADVISORY_EVIDENCE') {
      throw new Error('EVIDENCE_REHYDRATION_ERROR: Authority escalation attempt detected. AI evidence cannot claim release authority.');
    }

    if (parsed.verification?.independenceLevel !== 'FULLY_INDEPENDENT_DISSIMILAR') {
      throw new Error(`EVIDENCE_REHYDRATION_ERROR: Invalid independence level ${parsed.verification?.independenceLevel}`);
    }

    // Recompute content hash to detect tampering
    const contentPayload = {
      evidenceId: parsed.evidenceId,
      subject: parsed.subject,
      verificationVerdict: parsed.verification.verdict,
      overallPassed: parsed.verification.overallPassed,
      independenceLevel: parsed.verification.independenceLevel,
      authorityTag: parsed.verification.authorityTag,
      provenance: parsed.provenance
    };

    const recomputedHash = IndependentVerificationSerializer.hash(
      IndependentVerificationSerializer.canonicalJson(contentPayload)
    );

    if (recomputedHash !== parsed.contentHash) {
      throw new Error(`EVIDENCE_REHYDRATION_ERROR: Content hash tampered: expected ${parsed.contentHash}, computed ${recomputedHash}`);
    }

    // If expected context is provided, verify context binding
    if (expectedContext) {
      const computedCtxHash = IndependentVerificationSerializer.computeContextHash(expectedContext);
      if (computedCtxHash !== parsed.provenance.contextHash) {
        throw new Error(`EVIDENCE_REHYDRATION_ERROR: Context mismatch during rehydration. Envelope context ${parsed.provenance.contextHash} does not match active context ${computedCtxHash}`);
      }

      if (expectedContext.configurationState?.canonicalRevisionHash) {
        if (parsed.subject.canonicalRevisionHash !== expectedContext.configurationState.canonicalRevisionHash) {
          throw new Error(`EVIDENCE_REHYDRATION_ERROR: Revision hash mismatch during rehydration.`);
        }
      }
    }

    return {
      valid: true,
      envelope: parsed as AIEvidenceEnvelope,
      recomputedContentHash: recomputedHash,
      details: 'EVIDENCE_REHYDRATION_VERIFIED'
    };
  }
}
