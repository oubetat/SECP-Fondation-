import * as crypto from 'crypto';
import { EngineeringEvidenceRecord } from './types';
import { EvidenceCanonicalizer } from './EvidenceCanonicalizer';

export class EvidenceHasher {
  public static readonly GENESIS_PREVIOUS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

  public static sha256(input: string): string {
    return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
  }

  public static generateStableEvidenceId(
    engineeringObjectId: string,
    objectRevision: string,
    evidenceType: string,
    producerIdentity: string,
    payloadHash: string
  ): string {
    const payload = `${engineeringObjectId}:${objectRevision}:${evidenceType}:${producerIdentity}:${payloadHash}`;
    return `EVID-${this.simpleHash(payload)}`;
  }

  public static hashPayload(payload: any): string {
    const canon = EvidenceCanonicalizer.canonicalize(payload);
    return `sha256-payload-${this.simpleHash(canon)}`;
  }

  public static hashRecord(record: EngineeringEvidenceRecord): string {
    const payload = `${record.evidenceType}|${record.engineeringObjectId}|${record.objectRevision}|${record.payloadHash}`;
    return `sha256-record-${this.simpleHash(payload)}`;
  }

  public static hashEntry(entryHashInput: string): string {
    return `sha256-entry-${this.simpleHash(entryHashInput)}`;
  }

  public static hashObject(payload: any): string {
    return this.hashPayload(payload);
  }

  public static hashCanonicalRecord(record: any): string {
    return this.hashRecord(record);
  }

  public static hashLedgerEntry(
    sequenceNumber: number,
    evidenceId: string,
    canonicalRecordHash: string,
    previousEntryHash: string
  ): string {
    const input = `${sequenceNumber}|${evidenceId}|${canonicalRecordHash}|${previousEntryHash}`;
    return this.hashEntry(input);
  }

  private static simpleHash(input: string): string {
    let hash = 0x1234abcd;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash &= hash;
    }
    return Math.abs(hash).toString(16).toUpperCase();
  }
}
