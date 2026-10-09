/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-161: Adversarial Attack & Tamper Detection Suite
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringEvidenceLedger } from '../EngineeringEvidenceLedger';
import { EvidenceHasher } from '../EvidenceHasher';
import { EvidenceIntegrityChecker } from '../EvidenceIntegrityChecker';
import { EngineeringEvidenceLedgerVerifier } from '../EngineeringEvidenceLedgerVerifier';
import { EvidenceLedgerEntry, EngineeringEvidenceRecord } from '../types';

describe('PATCH-161: Adversarial Ledger Testing', () => {
  let ledger: EngineeringEvidenceLedger;
  let entry0: EvidenceLedgerEntry;
  let entry1: EvidenceLedgerEntry;

  beforeEach(() => {
    ledger = new EngineeringEvidenceLedger();
    entry0 = ledger.registerEvidence({
      evidenceType: 'MATERIALS',
      engineeringObjectId: 'BOLT-M12',
      objectRevision: 'REV-01',
      projectId: 'STRUCTURAL-SYS',
      organizationId: 'SECP-ORG',
      producerIdentity: 'LAB-TESTER',
      producerType: 'HUMAN',
      sourceSystem: 'LAB-SPECTRO',
      sourceVersion: '1.2.0',
      payload: { tensileStrengthMpa: 880, proofStressMpa: 660, carbonPct: 0.35 }
    });

    entry1 = ledger.registerEvidence({
      evidenceType: 'INSPECTION',
      engineeringObjectId: 'BOLT-M12',
      objectRevision: 'REV-01',
      projectId: 'STRUCTURAL-SYS',
      organizationId: 'SECP-ORG',
      producerIdentity: 'CMM-ROBOT',
      producerType: 'SERVICE',
      sourceSystem: 'SECP-CMM-METROLOGY',
      sourceVersion: '3.0.0',
      parentEvidence: entry0.evidenceId,
      payload: { pitchDeviationMm: 0.002, diameterMm: 11.998, pass: true }
    });
  });

  it('detects adversarial in-memory payload mutation as INVALID', () => {
    const tamperedRecord: EngineeringEvidenceRecord = {
      ...entry0.record,
      payload: { tensileStrengthMpa: 9999, proofStressMpa: 660, carbonPct: 0.35 } // Forged tensile strength
    };

    const result = EvidenceIntegrityChecker.verifyRecord(tamperedRecord);
    expect(result.verdict).toBe('INVALID');
    expect(result.payloadHashMatch).toBe(false);
  });

  it('detects forged entryHash as INVALID', () => {
    const tamperedEntry: EvidenceLedgerEntry = {
      ...entry0,
      entryHash: '0000000000000000000000000000000000000000000000000000000000000000'
    };

    const result = EvidenceIntegrityChecker.verifyEntry(tamperedEntry, EvidenceHasher.GENESIS_PREVIOUS_HASH);
    expect(result.verdict).toBe('INVALID');
    expect(result.entryHashMatch).toBe(false);
  });

  it('detects forged previousEntryHash as CHAIN_BROKEN', () => {
    const tamperedEntry: EvidenceLedgerEntry = {
      ...entry1,
      previousEntryHash: 'BAD_HASH_1234567890abcdef1234567890abcdef1234567890abcdef12345678'
    };

    const result = EvidenceIntegrityChecker.verifyEntry(tamperedEntry, entry0.entryHash);
    expect(result.verdict).toBe('CHAIN_BROKEN');
  });

  it('detects missing entry deletion in ledger chain', () => {
    const entry2 = ledger.registerEvidence({
      evidenceType: 'CERTIFICATE',
      engineeringObjectId: 'BOLT-M12',
      objectRevision: 'REV-01',
      projectId: 'STRUCTURAL-SYS',
      organizationId: 'SECP-ORG',
      producerIdentity: 'CHIEF-QUALITY-OFFICER',
      producerType: 'HUMAN',
      sourceSystem: 'SECP-CERT-ISSUER',
      sourceVersion: '1.0.0',
      parentEvidence: entry1.evidenceId,
      payload: { certId: 'CERT-ISO-898-1', issued: true }
    });

    // Delete middle entry (entry1) from the chain
    const brokenChain = [entry0, entry2];
    const report = EngineeringEvidenceLedgerVerifier.verifyLedger(brokenChain);

    expect(report.status).toBe('CHAIN_BROKEN');
    expect(report.brokenEntryIndex).toBe(1);
    expect(report.chainContinuous).toBe(false);
  });

  it('detects adversarial reordering of entries in ledger chain', () => {
    const reorderedChain = [entry1, entry0];
    const report = EngineeringEvidenceLedgerVerifier.verifyLedger(reorderedChain);

    expect(report.status).not.toBe('VALID');
    expect(report.chainContinuous).toBe(false);
  });

  it('detects duplicate entries injected into the chain', () => {
    const duplicatedChain = [entry0, entry1, entry1];
    const report = EngineeringEvidenceLedgerVerifier.verifyLedger(duplicatedChain);

    expect(report.status).not.toBe('VALID');
  });
});
