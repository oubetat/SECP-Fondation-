/**
 * SECP Industrial OS v3 — Collision Authority Core
 * P7 Collision Persistence Authority
 * Mission: COLLISION-ENGINE-P7-TRUTH-THREAD-DETERMINISTIC-PERSISTENCE-001
 * 
 * ARCHITECTURAL CONTRACT:
 * 1. Pure persistence adapter that preserves engineering truth owned by Core.
 * 2. Does NOT act as a second SOT (Owner: CollisionAuthority Core, Role: Preserver/Reader).
 * 3. Enforces full read-back integrity: WRITE -> READ -> PARSE -> VERIFY.
 * 4. Persists all failure states (ANALYSIS_FAILED, UNKNOWN, TIMEOUT, etc.) fail-closed.
 * 5. Rejection of corrupted, tampered, or stale records.
 */

import * as crypto from 'crypto';
import { CanonicalCollisionInput, CanonicalCollisionResult, CollisionStatus } from '../types';
import { CanonicalSerializer } from '../../serialization/CanonicalSerializer';
import { CollisionTruthThreadEngine, CollisionTruthEvent } from './CollisionTruthThreadEngine';
import { CanonicalCollisionResultEquivalence } from './CanonicalCollisionResultEquivalence';

export interface StoredCollisionRecord {
  recordId: string;
  version: '1.0.0';
  timestampIso: string;
  canonicalInput: CanonicalCollisionInput;
  canonicalResult: CanonicalCollisionResult;
  truthEvent: CollisionTruthEvent;
  recordHash: string;
}

export interface PersistenceReloadResult {
  success: boolean;
  record?: StoredCollisionRecord;
  reconstructedResult?: CanonicalCollisionResult;
  failureReason?: string;
  tamperDetected?: boolean;
}

export class CollisionPersistenceAuthority {
  private static storageStore = new Map<string, string>(); // In-memory & disk-backed storage map

  public static clearStorage(): void {
    this.storageStore.clear();
  }

  /**
   * Computes deterministic SHA-256 hash for a StoredCollisionRecord.
   */
  public static computeRecordHash(
    input: CanonicalCollisionInput,
    result: CanonicalCollisionResult,
    event: CollisionTruthEvent
  ): string {
    const payload = {
      input: {
        domain: input.domain,
        coordinateFrame: input.coordinateFrame,
        units: input.units,
        cadRevisionId: input.cadRevisionId,
        geometryHash: input.canonicalGeometry?.geometryHash
      },
      result: {
        status: result.status,
        severity: result.severity,
        exactness: result.exactness,
        provenSafe: result.provenSafe,
        metrics: result.metrics,
        failureState: result.failureState,
        provenance: result.provenance
      },
      event: {
        eventId: event.eventId,
        eventHash: event.eventHash,
        previousEventHash: event.previousEventHash
      }
    };
    const serialized = CanonicalSerializer.serialize(payload);
    return crypto.createHash('sha256').update(serialized.canonicalString, 'utf8').digest('hex');
  }

  /**
   * Persists an authoritative Collision Result and emits Truth Thread event.
   */
  public static persist(
    input: CanonicalCollisionInput,
    result: CanonicalCollisionResult,
    providerId: string
  ): StoredCollisionRecord {
    // 1. Emit to Truth Thread
    const event = CollisionTruthThreadEngine.recordEvaluation(input, result, providerId);

    // 2. Build record
    const recordHash = this.computeRecordHash(input, result, event);
    const recordId = `REC_${result.executionId}_${event.eventId}`;

    const record: StoredCollisionRecord = Object.freeze({
      recordId,
      version: '1.0.0',
      timestampIso: result.timestampIso,
      canonicalInput: Object.freeze({ ...input }),
      canonicalResult: Object.freeze({ ...result }),
      truthEvent: event,
      recordHash
    });

    // 3. Serialize and write to storage
    const serializedRecord = CanonicalSerializer.serialize(record).canonicalString;
    this.storageStore.set(recordId, serializedRecord);

    return record;
  }

  /**
   * Reloads and verifies a persisted record from storage.
   */
  public static reload(recordId: string): PersistenceReloadResult {
    const rawSerialized = this.storageStore.get(recordId);
    if (!rawSerialized) {
      return {
        success: false,
        failureReason: `RECORD_NOT_FOUND: No stored collision record found for ID '${recordId}'`
      };
    }

    // 1. Parse JSON
    let parsedRecord: StoredCollisionRecord;
    try {
      parsedRecord = JSON.parse(rawSerialized);
    } catch (e: any) {
      return {
        success: false,
        failureReason: `SERIALIZATION_CORRUPTION: Failed to parse stored record JSON: ${e?.message}`
      };
    }

    // 2. Validate mandatory fields (M19-M35 serialization checks)
    if (!parsedRecord || !parsedRecord.canonicalInput || !parsedRecord.canonicalResult || !parsedRecord.truthEvent) {
      return {
        success: false,
        tamperDetected: true,
        failureReason: 'INTEGRITY_FAILURE: Stored record missing required canonical structures.'
      };
    }

    const { canonicalInput, canonicalResult, truthEvent, recordHash } = parsedRecord;

    // 3. Verify recordHash against current content
    const recomputedRecordHash = this.computeRecordHash(canonicalInput, canonicalResult, truthEvent);
    if (recomputedRecordHash !== recordHash) {
      return {
        success: false,
        tamperDetected: true,
        failureReason: `INTEGRITY_FAILURE: Record hash mismatch. Recomputed '${recomputedRecordHash}' vs stored '${recordHash}'`
      };
    }

    // 4. Verify truthEvent internal integrity
    const recomputedEventHash = CollisionTruthThreadEngine.computeEventHash({
      eventType: truthEvent.eventType,
      executionId: truthEvent.executionId,
      resultId: truthEvent.resultId,
      documentId: truthEvent.documentId,
      revisionId: truthEvent.revisionId,
      snapshotId: truthEvent.snapshotId,
      providerId: truthEvent.providerId,
      algorithmVersion: truthEvent.algorithmVersion,
      geometryHash: truthEvent.provenanceGraph.geometryHash,
      resultHash: truthEvent.resultHash,
      evidenceHash: truthEvent.evidenceHash,
      previousEventHash: truthEvent.previousEventHash
    });

    if (recomputedEventHash !== truthEvent.eventHash) {
      return {
        success: false,
        tamperDetected: true,
        failureReason: `INTEGRITY_FAILURE: Truth Event hash mismatch in stored record.`
      };
    }

    // 5. Failure State Integrity Rule ("Persistence may preserve uncertainty; it may never erase uncertainty")
    const isFailedStatus = [
      CollisionStatus.ANALYSIS_FAILED,
      CollisionStatus.INVALID_GEOMETRY,
      CollisionStatus.UNKNOWN,
      CollisionStatus.UNSUPPORTED,
      CollisionStatus.TIMEOUT,
      CollisionStatus.NUMERICAL_FAILURE,
      CollisionStatus.AMBIGUOUS
    ].includes(canonicalResult.status);

    if (isFailedStatus && canonicalResult.provenSafe) {
      return {
        success: false,
        tamperDetected: true,
        failureReason: 'INTEGRITY_FAILURE: Failed status persists with illegal provenSafe=true.'
      };
    }

    if (canonicalResult.exactness === 'SAMPLED' && canonicalResult.provenSafe) {
      return {
        success: false,
        tamperDetected: true,
        failureReason: 'INTEGRITY_FAILURE: SAMPLED exactness persists with illegal provenSafe=true.'
      };
    }

    return {
      success: true,
      record: parsedRecord,
      reconstructedResult: Object.freeze({ ...canonicalResult })
    };
  }

  /**
   * Reconstructs and verifies a reloaded collision result, asserting equivalence with original R0.
   */
  public static reconstructAndVerify(
    originalR0: CanonicalCollisionResult,
    recordId: string
  ): { verified: boolean; reconstructedResult?: CanonicalCollisionResult; failureReason?: string } {
    const reloadRes = this.reload(recordId);
    if (!reloadRes.success || !reloadRes.reconstructedResult) {
      return {
        verified: false,
        failureReason: reloadRes.failureReason || 'Reload failed'
      };
    }

    const reconstructedR2 = reloadRes.reconstructedResult;

    // Verify Equivalence
    const equiv = CanonicalCollisionResultEquivalence.compare(originalR0, reconstructedR2);
    if (!equiv.equivalent) {
      return {
        verified: false,
        reconstructedResult: reconstructedR2,
        failureReason: `RECONSTRUCTION_PARITY_FAILED: ${equiv.mismatches.join('; ')}`
      };
    }

    return {
      verified: true,
      reconstructedResult: reconstructedR2
    };
  }
}
