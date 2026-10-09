/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-161: Evidence Canonicalizer & Deterministic Serializer
 */

import { CanonicalSerializer } from '../../serialization/CanonicalSerializer';
import { EngineeringEvidenceRecord, EvidenceLedgerEntry } from './types';

export class EvidenceCanonicalizer {
  /**
   * Deterministically normalizes an arbitrary JavaScript object/value.
   * Sorts object keys recursively, normalizes floating points, and ensures invariant representation.
   */
  public static normalizeValue(val: unknown): any {
    if (val === null || val === undefined) {
      return null;
    }
    if (typeof val === 'number') {
      if (Object.is(val, -0)) return 0;
      if (!Number.isFinite(val)) {
        throw new Error(`[EvidenceCanonicalizer] Non-finite number (${val}) cannot be canonicalized`);
      }
      return val;
    }
    if (typeof val === 'boolean' || typeof val === 'string') {
      return val;
    }
    if (Array.isArray(val)) {
      return val.map(item => this.normalizeValue(item));
    }
    if (typeof val === 'object') {
      const keys = Object.keys(val as Record<string, any>).sort();
      const result: Record<string, any> = {};
      for (const k of keys) {
        const item = (val as any)[k];
        if (typeof item !== 'function' && typeof item !== 'symbol' && item !== undefined) {
          result[k] = this.normalizeValue(item);
        }
      }
      return result;
    }
    return String(val);
  }

  /**
   * Serializes any payload to a deterministic canonical JSON string.
   */
  public static canonicalize(data: unknown): string {
    const normalized = this.normalizeValue(data);
    return JSON.stringify(normalized);
  }

  /**
   * Generates the canonical record representation for hashing.
   * Strips dynamic mutable fields if any, keeping pure immutable truth fields.
   */
  public static canonicalizeRecord(record: EngineeringEvidenceRecord): string {
    const coreRepresentation = {
      evidenceId: record.evidenceId,
      evidenceType: record.evidenceType,
      engineeringObjectId: record.engineeringObjectId,
      objectRevision: record.objectRevision,
      projectId: record.projectId,
      organizationId: record.organizationId,
      producerIdentity: record.producerIdentity,
      producerType: record.producerType,
      sourceSystem: record.sourceSystem,
      sourceVersion: record.sourceVersion,
      inputReferences: record.inputReferences || [],
      outputReferences: record.outputReferences || [],
      parentEvidence: record.parentEvidence || null,
      dependencyEvidence: record.dependencyEvidence || [],
      payloadHash: record.payloadHash,
      resultHash: record.resultHash,
      metadataHash: record.metadataHash,
      timestamp: record.timestamp,
      eventId: record.eventId || null,
      correlationId: record.correlationId || null,
      policyContext: record.policyContext ? {
        policyId: record.policyContext.policyId || null,
        policyVersion: record.policyContext.policyVersion || null,
        evaluationVerdict: record.policyContext.evaluationVerdict || null,
        governanceDecisionId: record.policyContext.governanceDecisionId || null
      } : null,
      supersedes: record.supersedes || null
    };

    return this.canonicalize(coreRepresentation);
  }

  /**
   * Generates the canonical string for a ledger entry link.
   */
  public static canonicalizeEntry(
    sequenceNumber: number,
    evidenceId: string,
    canonicalRecordHash: string,
    previousEntryHash: string
  ): string {
    const entryData = {
      sequenceNumber,
      evidenceId,
      canonicalRecordHash,
      previousEntryHash
    };
    return this.canonicalize(entryData);
  }
}
