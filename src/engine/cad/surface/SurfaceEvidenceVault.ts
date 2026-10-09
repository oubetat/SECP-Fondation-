/**
 * SECP CAD Kernel — Surface Evidence Vault
 */

import { EvidenceRecord } from '../../cad-kernel/document/CADDocument';

export class SurfaceEvidenceVault {
  private static records: EvidenceRecord[] = [];

  public static addRecord(record: EvidenceRecord) {
    this.records.push(record);
  }

  public static getRecordsByFeature(featureId: string): EvidenceRecord[] {
    return this.records.filter(r => (r.payload as any)?.featureId === featureId);
  }

  public static clear() {
    this.records = [];
  }

  public static generateVerificationChain(): string {
    return this.records
      .map(r => `[${r.timestamp}] ${r.verdict} | ${r.sourceSystem} | Hash: ${r.canonicalHash.substring(0, 8)}`)
      .join('\n');
  }
}
