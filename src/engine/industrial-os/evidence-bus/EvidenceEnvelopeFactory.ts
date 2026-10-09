/**
 * SECP Industrial OS v2 — PATCH-157: Evidence Envelope Factory
 * Constructs immutable, cryptographically verifiable Evidence Envelopes.
 */

import * as crypto from 'crypto';
import {
  ControlledEvidenceType,
  CONTROLLED_EVIDENCE_TYPES,
  EvidenceEnvelope,
  EvidenceEnvelopeIdentity,
  EvidenceEnvelopeIntegrity,
  EvidenceEnvelopeProvenance,
  EvidenceEnvelopeCorrelation,
  EvidenceEnvelopeVerification,
  EvidencePublishRequest
} from './types';

export class EvidenceEnvelopeFactory {
  private static readonly SCHEMA_VERSION = '1.0.0';

  /**
   * Deep freezes an object recursively to guarantee absolute immutability.
   */
  public static deepFreeze<T>(obj: T): T {
    if (obj && typeof obj === 'object') {
      if (!Object.isFrozen(obj)) {
        Object.freeze(obj);
      }
      Object.keys(obj).forEach(key => {
        const val = (obj as any)[key];
        if (val && typeof val === 'object') {
          EvidenceEnvelopeFactory.deepFreeze(val);
        }
      });
    }
    return obj;
  }

  /**
   * Computes deterministic SHA-256 hash of a JSON payload with sorted keys.
   */
  public static computePayloadHash(payload: Record<string, unknown>): string {
    const canonicalString = EvidenceEnvelopeFactory.canonicalJsonStringify(payload);
    return crypto.createHash('sha256').update(canonicalString).digest('hex');
  }

  /**
   * Deterministically stringifies JSON with recursively sorted object keys.
   */
  public static canonicalJsonStringify(obj: unknown): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map(item => EvidenceEnvelopeFactory.canonicalJsonStringify(item)).join(',') + ']';
    }
    const sortedKeys = Object.keys(obj).sort();
    const keyValues = sortedKeys.map(k => `"${k}":${EvidenceEnvelopeFactory.canonicalJsonStringify((obj as any)[k])}`);
    return '{' + keyValues.join(',') + '}';
  }

  /**
   * Creates an immutable EvidenceEnvelope from a publish request.
   */
  public static createEnvelope(
    request: EvidencePublishRequest,
    sequence: number,
    runSequence: number | undefined,
    previousEvidenceHash?: string,
    chainHeight: number = sequence
  ): EvidenceEnvelope {
    const evidenceId = request.evidenceId || `EVID-${crypto.randomBytes(16).toString("hex")}`;
    const timestamp = new Date().toISOString();

    if (!CONTROLLED_EVIDENCE_TYPES.includes(request.evidenceType)) {
      throw new Error(`[EvidenceEnvelopeFactory] Illegal evidence type: ${request.evidenceType}`);
    }

    if (!request.sourceCapability || request.sourceCapability.trim() === '') {
      throw new Error(`[EvidenceEnvelopeFactory] Missing sourceCapability in evidence request`);
    }

    if (!request.sourceOperation || request.sourceOperation.trim() === '') {
      throw new Error(`[EvidenceEnvelopeFactory] Missing sourceOperation in evidence request`);
    }

    // 1. Calculate payload hash
    const payloadHash = EvidenceEnvelopeFactory.computePayloadHash(request.payload || {});

    // 2. Identity block
    const identity: EvidenceEnvelopeIdentity & { targetObjectId?: string } = {
      evidenceId,
      sequence,
      runSequence,
      timestamp,
      schemaVersion: EvidenceEnvelopeFactory.SCHEMA_VERSION,
      targetObjectId: request.engineeringObjectId
    };

    // 3. Provenance block
    const provenance: EvidenceEnvelopeProvenance = {
      sourceCapability: request.sourceCapability,
      sourceOperation: request.sourceOperation,
      producerType: request.producerType || 'ENGINE',
      producerId: request.producerId || request.sourceCapability,
      engineVersion: request.engineVersion || '2.0.0',
      author: request.author || 'SYSTEM',
      environment: request.environment || 'production'
    };

    // 4. Correlation block
    const correlation: EvidenceEnvelopeCorrelation = {
      correlationId: request.correlationId || `CORR-${crypto.randomBytes(16).toString("hex")}`,
      subjectIdentityId: request.subjectIdentityId,
      sourceIdentityId: request.sourceIdentityId,
      producerIdentityId: request.producerIdentityId,
      eventId: request.eventId,
      workflowId: request.workflowId,
      runId: request.runId,
      taskId: request.taskId,
      engineeringObjectId: request.engineeringObjectId,
      parentEvidenceId: request.parentEvidenceId,
      causationId: request.causationId,
      tags: (request.tags || (request as any).correlation?.tags) ? Object.freeze([...(request.tags || (request as any).correlation?.tags)]) : undefined
    };

    // 5. Initial verification block
    const verification: EvidenceEnvelopeVerification = {
      state: 'UNVERIFIED',
      checks: Object.freeze([])
    };

    // 6. Compute overall envelope hash
    const envelopeCore = {
      evidenceId,
      evidenceType: request.evidenceType,
      sequence,
      timestamp,
      sourceCapability: provenance.sourceCapability,
      sourceOperation: provenance.sourceOperation,
      correlationId: correlation.correlationId,
      eventId: correlation.eventId,
      workflowId: correlation.workflowId,
      runId: correlation.runId,
      engineeringObjectId: correlation.engineeringObjectId,
      parentEvidenceId: correlation.parentEvidenceId,
      payloadHash,
      previousEvidenceHash: previousEvidenceHash || null
    };

    const envelopeHash = crypto
      .createHash('sha256')
      .update(EvidenceEnvelopeFactory.canonicalJsonStringify(envelopeCore))
      .digest('hex');

    const integrity: EvidenceEnvelopeIntegrity = {
      hashAlgorithm: 'SHA-256',
      payloadHash,
      envelopeHash,
      previousEvidenceHash,
      chainHeight
    };

    const envelope: EvidenceEnvelope = {
      evidenceId,
      evidenceType: request.evidenceType,
      identity: Object.freeze(identity),
      provenance: Object.freeze(provenance),
      correlation: Object.freeze(correlation),
      payload: Object.freeze({ ...request.payload }),
      integrity: Object.freeze(integrity),
      verification: Object.freeze(verification),
      metadata: request.metadata ? Object.freeze({ ...request.metadata }) : undefined
    };

    return EvidenceEnvelopeFactory.deepFreeze(envelope);
  }

  /**
   * Clones an existing envelope with updated verification state, maintaining envelope immutability.
   */
  public static withVerification(
    envelope: EvidenceEnvelope,
    verification: EvidenceEnvelopeVerification
  ): EvidenceEnvelope {
    const updated: EvidenceEnvelope = {
      ...envelope,
      verification: Object.freeze({
        ...verification,
        checks: Object.freeze([...verification.checks])
      })
    };
    return EvidenceEnvelopeFactory.deepFreeze(updated);
  }
}
