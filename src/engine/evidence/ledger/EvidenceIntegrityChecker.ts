/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-161: Evidence Integrity Checker & Independent Recomputation Engine
 */

import { EvidenceCanonicalizer } from './EvidenceCanonicalizer';
import { EvidenceHasher } from './EvidenceHasher';
import {
  EngineeringEvidenceRecord,
  EvidenceLedgerEntry,
  EvidenceLedgerVerdict,
  PolicyContext
} from './types';
import { EngineeringIdentityService } from '../../identity/EngineeringIdentityService';

export interface IntegrityCheckResult {
  readonly verdict: EvidenceLedgerVerdict;
  readonly payloadHashMatch: boolean;
  readonly resultHashMatch: boolean;
  readonly metadataHashMatch: boolean;
  readonly canonicalRecordHashMatch: boolean;
  readonly entryHashMatch: boolean;
  readonly recomputedPayloadHash: string;
  readonly recomputedCanonicalRecordHash: string;
  readonly recomputedEntryHash?: string;
  readonly details: readonly string[];
}

export class EvidenceIntegrityChecker {
  /**
   * Performs complete independent recomputation of an evidence record.
   * Does NOT blindly trust pre-stored hash values.
   */
  public static verifyRecord(record: EngineeringEvidenceRecord): IntegrityCheckResult {
    const details: string[] = [];

    // 1. Recompute payload hash
    const recomputedPayloadHash = EvidenceHasher.hashObject(record.payload);
    const payloadHashMatch = recomputedPayloadHash === record.payloadHash;
    if (!payloadHashMatch) {
      details.push(`Payload hash mismatch: recorded [${record.payloadHash}] != recomputed [${recomputedPayloadHash}]`);
    }

    // 2. Recompute metadata hash
    const metadataPayload = {
      evidenceType: record.evidenceType,
      engineeringObjectId: record.engineeringObjectId,
      objectRevision: record.objectRevision,
      projectId: record.projectId,
      organizationId: record.organizationId,
      producerIdentity: record.producerIdentity,
      producerType: record.producerType,
      sourceSystem: record.sourceSystem,
      sourceVersion: record.sourceVersion,
      timestamp: record.timestamp
    };
    const recomputedMetadataHash = EvidenceHasher.hashObject(metadataPayload);
    const metadataHashMatch = recomputedMetadataHash === record.metadataHash;
    if (!metadataHashMatch) {
      details.push(`Metadata hash mismatch: recorded [${record.metadataHash}] != recomputed [${recomputedMetadataHash}]`);
    }

    // 3. Recompute result hash (if payload has result, check consistency)
    const resultObj = record.payload?.result || record.payload;
    const recomputedResultHash = EvidenceHasher.hashObject(resultObj);
    const resultHashMatch = recomputedResultHash === record.resultHash;
    if (!resultHashMatch) {
      details.push(`Result hash mismatch: recorded [${record.resultHash}] != recomputed [${recomputedResultHash}]`);
    }

    // 4. Recompute canonical record hash
    const recomputedCanonicalRecordHash = EvidenceHasher.hashCanonicalRecord(record);

    let verdict: EvidenceLedgerVerdict = 'VALID';
    if (!payloadHashMatch || !metadataHashMatch || !resultHashMatch) {
      verdict = 'INVALID';
    }

    return {
      verdict,
      payloadHashMatch,
      resultHashMatch,
      metadataHashMatch,
      canonicalRecordHashMatch: true,
      entryHashMatch: true,
      recomputedPayloadHash,
      recomputedCanonicalRecordHash,
      details
    };
  }

  /**
   * Verifies a full ledger entry including previousHash linkage.
   */
  public static verifyEntry(
    entry: EvidenceLedgerEntry,
    expectedPreviousHash: string
  ): IntegrityCheckResult {
    const recordCheck = this.verifyRecord(entry.record);
    const details = [...recordCheck.details];

    // Verify canonicalRecordHash recorded in entry
    const recomputedCanonicalRecordHash = EvidenceHasher.hashCanonicalRecord(entry.record);
    const canonicalRecordHashMatch = recomputedCanonicalRecordHash === entry.canonicalRecordHash;
    if (!canonicalRecordHashMatch) {
      details.push(`Entry canonicalRecordHash mismatch: recorded [${entry.canonicalRecordHash}] != recomputed [${recomputedCanonicalRecordHash}]`);
    }

    // Verify previousEntryHash
    const prevHashMatch = entry.previousEntryHash === expectedPreviousHash;
    if (!prevHashMatch) {
      details.push(`Previous hash mismatch at sequence ${entry.sequenceNumber}: expected [${expectedPreviousHash}] != recorded [${entry.previousEntryHash}]`);
    }

    // Recompute entry hash
    const recomputedEntryHash = EvidenceHasher.hashLedgerEntry(
      entry.sequenceNumber,
      entry.evidenceId,
      recomputedCanonicalRecordHash,
      entry.previousEntryHash
    );
    const entryHashMatch = recomputedEntryHash === entry.entryHash;
    if (!entryHashMatch) {
      details.push(`Entry hash mismatch at sequence ${entry.sequenceNumber}: recorded [${entry.entryHash}] != recomputed [${recomputedEntryHash}]`);
    }

    let verdict: EvidenceLedgerVerdict = recordCheck.verdict;
    if (!prevHashMatch) {
      verdict = 'CHAIN_BROKEN';
    } else if (!canonicalRecordHashMatch || !entryHashMatch) {
      verdict = 'INVALID';
    }

    return {
      verdict,
      payloadHashMatch: recordCheck.payloadHashMatch,
      resultHashMatch: recordCheck.resultHashMatch,
      metadataHashMatch: recordCheck.metadataHashMatch,
      canonicalRecordHashMatch,
      entryHashMatch,
      recomputedPayloadHash: recordCheck.recomputedPayloadHash,
      recomputedCanonicalRecordHash,
      recomputedEntryHash,
      details
    };
  }

  /**
   * Validates Revision and Object binding.
   */
  public static verifyBinding(
    record: EngineeringEvidenceRecord,
    targetObjectId: string,
    targetRevision: string
  ): { verdict: EvidenceLedgerVerdict; reason?: string } {
    if (record.engineeringObjectId !== targetObjectId) {
      return {
        verdict: 'OBJECT_MISMATCH',
        reason: `Evidence bound to object [${record.engineeringObjectId}], requested for [${targetObjectId}]`
      };
    }
    if (record.objectRevision !== targetRevision) {
      return {
        verdict: 'REVISION_MISMATCH',
        reason: `Evidence bound to revision [${record.objectRevision}], requested for [${targetRevision}]`
      };
    }
    return { verdict: 'VALID' };
  }
}
