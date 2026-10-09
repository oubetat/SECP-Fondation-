/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-161: Engineering Evidence Ledger Verifier
 */

import { EvidenceHasher } from './EvidenceHasher';
import { EvidenceIntegrityChecker } from './EvidenceIntegrityChecker';
import { EvidenceLineageResolver } from './EvidenceLineageResolver';
import {
  EvidenceLedgerEntry,
  EvidenceLedgerVerdict,
  LedgerVerificationReport,
  EntryVerificationDetail
} from './types';

export class EngineeringEvidenceLedgerVerifier {
  /**
   * Verifies the complete ledger chain from sequence 0 to N-1.
   */
  public static verifyLedger(entries: readonly EvidenceLedgerEntry[]): LedgerVerificationReport {
    const violations: string[] = [];
    const entryDetails: EntryVerificationDetail[] = [];
    const verifiedAt = new Date().toISOString();

    if (entries.length === 0) {
      return {
        status: 'VALID',
        totalEntries: 0,
        verifiedEntries: 0,
        genesisValid: true,
        chainContinuous: true,
        violations: [],
        entryDetails: [],
        verifiedAt
      };
    }

    let expectedPrevHash = EvidenceHasher.GENESIS_PREVIOUS_HASH;
    let overallStatus: EvidenceLedgerVerdict = 'VALID';
    let chainContinuous = true;
    let genesisValid = true;
    let brokenEntryIndex: number | undefined = undefined;

    const seenIds = new Set<string>();

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // 1. Sequence number check
      if (entry.sequenceNumber !== i) {
        chainContinuous = false;
        if (overallStatus === 'VALID') overallStatus = 'CHAIN_BROKEN';
        if (brokenEntryIndex === undefined) brokenEntryIndex = i;
        violations.push(`Sequence discontinuity at index ${i}: expected sequence ${i}, found ${entry.sequenceNumber}`);
      }

      // 2. Duplicate check
      if (seenIds.has(entry.evidenceId)) {
        if (overallStatus === 'VALID') overallStatus = 'INVALID';
        violations.push(`Duplicate evidence ID detected in ledger: ${entry.evidenceId} at index ${i}`);
      }
      seenIds.add(entry.evidenceId);

      // 3. Genesis check
      if (i === 0 && entry.previousEntryHash !== EvidenceHasher.GENESIS_PREVIOUS_HASH) {
        genesisValid = false;
        if (overallStatus === 'VALID') overallStatus = 'CHAIN_BROKEN';
        if (brokenEntryIndex === undefined) brokenEntryIndex = 0;
        violations.push(`Genesis entry has invalid previousHash: ${entry.previousEntryHash}`);
      }

      // 4. Entry integrity check
      const checkResult = EvidenceIntegrityChecker.verifyEntry(entry, expectedPrevHash);

      entryDetails.push({
        entryIndex: i,
        evidenceId: entry.evidenceId,
        status: checkResult.verdict,
        calculatedHash: checkResult.recomputedEntryHash || '',
        expectedHash: entry.entryHash,
        reason: checkResult.details.join('; ') || undefined
      });

      if (checkResult.verdict !== 'VALID') {
        if (overallStatus === 'VALID') {
          overallStatus = checkResult.verdict;
        }
        if (brokenEntryIndex === undefined) {
          brokenEntryIndex = i;
        }
        violations.push(`Entry verification failed at index ${i} (${entry.evidenceId}): ${checkResult.details.join(', ')}`);
      }

      // Roll forward expected previous hash
      expectedPrevHash = entry.entryHash;
    }

    return {
      status: overallStatus,
      totalEntries: entries.length,
      verifiedEntries: entryDetails.filter(e => e.status === 'VALID').length,
      genesisValid,
      chainContinuous,
      brokenEntryIndex,
      violations,
      entryDetails,
      verifiedAt
    };
  }

  /**
   * Scans for broken chains or missing parent references in a set of entries.
   */
  public static findBrokenChains(entries: readonly EvidenceLedgerEntry[]): {
    brokenIndexes: number[];
    missingParents: { evidenceId: string; parentId: string }[];
  } {
    const report = this.verifyLedger(entries);
    const brokenIndexes: number[] = [];
    if (report.brokenEntryIndex !== undefined) {
      brokenIndexes.push(report.brokenEntryIndex);
    }

    const idMap = new Set(entries.map(e => e.evidenceId));
    const missingParents: { evidenceId: string; parentId: string }[] = [];

    for (const e of entries) {
      if (e.record.parentEvidence && !idMap.has(e.record.parentEvidence)) {
        missingParents.push({
          evidenceId: e.evidenceId,
          parentId: e.record.parentEvidence
        });
      }
    }

    return {
      brokenIndexes,
      missingParents
    };
  }
}
