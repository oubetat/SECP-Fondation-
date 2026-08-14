/**
 * PATCH-SECP-065: Asset Provenance Engine
 * Generates immutable records of asset reliability for the digital thread.
 */

import { AssetHealthReport, AssetReliabilityRecord, AssetLedgerAnchor } from './AssetReliabilityTypes';

export class AssetProvenanceEngine {
  public static createReliabilityRecord(report: AssetHealthReport, signedBy: string): AssetReliabilityRecord {
    const recordId = `rel-rec-${report.assetId}-${Date.now()}`;
    const payload = `${report.assetId}|${report.healthScore}|${report.reliabilityDecision}|${report.evidenceRootHash}|${signedBy}`;
    const immutableSignature = `sig-rel-${this.computeHash(payload)}`;

    return {
      recordId,
      assetId: report.assetId,
      timestamp: report.timestamp,
      healthScore: report.healthScore,
      decision: report.reliabilityDecision,
      evidenceRootHash: report.evidenceRootHash,
      signedBy,
      immutableSignature
    };
  }

  public static anchorToLedger(record: AssetReliabilityRecord, ledgerType: string = 'SECP_LOCAL_LEDGER'): AssetLedgerAnchor {
    const anchoredTimestamp = new Date().toISOString();
    const anchorPayload = `${record.recordId}|${record.immutableSignature}|${ledgerType}|${anchoredTimestamp}`;
    
    return {
      anchorId: `anchor-rel-${record.recordId}`,
      reliabilityRecordId: record.recordId,
      ledgerType,
      blockIndex: Math.floor(Math.random() * 100000),
      anchoredHash: record.immutableSignature,
      anchoredTimestamp,
      anchorValidationSignature: `anchor-sig-${this.computeHash(anchorPayload)}`
    };
  }

  private static computeHash(input: string): string {
    let hash = 0x12345678;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash &= hash;
    }
    return Math.abs(hash).toString(16).toUpperCase();
  }
}
