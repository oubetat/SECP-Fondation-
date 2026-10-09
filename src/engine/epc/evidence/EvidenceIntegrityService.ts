/**
 * SECP Industrial OS — EPC-010: Evidence Integrity Service
 */

import * as crypto from 'crypto';
import { CanonicalSerializer } from '../../serialization/CanonicalSerializer';
import { 
  EvidenceIntegrityRecord, 
  IntegrityStatus, 
  IntegrityVerificationResult 
} from './EvidenceIntegrityTypes';

export class EvidenceIntegrityService {
  public static readonly DEFAULT_ALGORITHM = 'SHA-256';
  public static readonly CANONICAL_VERSION = CanonicalSerializer.SCHEMA_VERSION;

  /**
   * Computes a deterministic hash for any evidence payload.
   */
  public static computeHash(payload: unknown): string {
    const serialization = CanonicalSerializer.serialize(payload);
    return crypto
      .createHash('sha256')
      .update(serialization.canonicalString, 'utf8')
      .digest('hex');
  }

  /**
   * Creates an integrity record for evidence.
   */
  public static createIntegrityRecord(
    evidenceId: string,
    revision: string,
    payload: unknown,
    createdBy: string,
    sourceReference: string
  ): EvidenceIntegrityRecord {
    const hash = this.computeHash(payload);
    
    return {
      evidenceId,
      evidenceRevision: revision,
      hashAlgorithm: this.DEFAULT_ALGORITHM,
      contentHash: hash,
      canonicalizationVersion: this.CANON_VERSION,
      createdAt: new Date().toISOString(),
      createdBy,
      sourceReference,
      hashScope: ['PAYLOAD', 'REVISION']
    };
  }

  private static get CANON_VERSION(): string {
    return CanonicalSerializer.SCHEMA_VERSION;
  }

  /**
   * Verifies a payload against an expected SHA-256 canonical hash string.
   */
  public static verifyHash(
    payload: unknown,
    expectedHash: string
  ): { isValid: boolean; computedHash: string } {
    const computedHash = this.computeHash(payload);
    return {
      isValid: computedHash === expectedHash,
      computedHash
    };
  }

  /**
   * Verifies the integrity of a payload against a stored record.
   */
  public static verifyIntegrity(
    payload: unknown,
    record?: EvidenceIntegrityRecord
  ): IntegrityVerificationResult {
    if (!record) {
      return { status: IntegrityStatus.MISSING, details: 'No integrity record found' };
    }

    if (record.hashAlgorithm !== this.DEFAULT_ALGORITHM) {
      return { status: IntegrityStatus.UNVERIFIABLE, details: `Unsupported algorithm: ${record.hashAlgorithm}` };
    }

    try {
      const currentHash = this.computeHash(payload);
      const isValid = currentHash === record.contentHash;

      return {
        status: isValid ? IntegrityStatus.VALID : IntegrityStatus.TAMPERED,
        recalculatedHash: currentHash,
        storedHash: record.contentHash,
        details: isValid ? undefined : 'Hash mismatch detected'
      };
    } catch (e) {
      return {
        status: IntegrityStatus.UNVERIFIABLE,
        details: e instanceof Error ? e.message : 'Unknown canonicalization error'
      };
    }
  }
}
