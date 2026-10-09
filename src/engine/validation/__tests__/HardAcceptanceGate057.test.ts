/**
 * SECP Industrial OS v3 — PROMPT-057: Hard Acceptance Gate 057 Test Suite
 *
 * Validates the complete Persistence Proof architecture:
 * 1. 20 Negative Proofs (PS-NEG-001 ... PS-NEG-020)
 * 2. 8 Positive Proofs (PS-POS-001 ... PS-POS-008)
 * 3. 15 Sub-Gates (GATE-A ... GATE-O)
 * 4. Master Persistence Proof with complete runtime memory destruction.
 */

import { describe, it, expect } from 'vitest';
import { HardAcceptanceGate057 } from '../HardAcceptanceGate057';
import { PersistenceNegativeProofs } from '../../persistence-proof/PersistenceNegativeProofs';
import { PersistencePositiveProofs } from '../../persistence-proof/PersistencePositiveProofs';
import { PersistenceProofVerifier } from '../../persistence-proof/PersistenceProofVerifier';

describe('PROMPT-057 — Persistence Proof Acceptance Gate', () => {
  describe('A. Negative Proof Suite (PS-NEG-001 ... PS-NEG-020)', () => {
    it('executes and verifies all 20 negative proofs reject fake or corrupted persistence states', async () => {
      const result = await PersistenceNegativeProofs.executeAllNegativeProofs();
      const failed = result.results.filter(r => !r.passed);
      if (failed.length > 0) {
        console.log('FAILED NEGATIVE PROOFS:', failed);
      }
      expect(result.allPassed).toBe(true);
      expect(result.passCount).toBe(20);
      expect(result.totalCount).toBe(20);

      // Verify specific negative proofs
      const neg001 = result.results.find(r => r.proofId === 'PS-NEG-001');
      expect(neg001?.passed).toBe(true);
      expect(neg001?.rejectedPattern).toBe('Viewport / Camera UI State');

      const neg006 = result.results.find(r => r.proofId === 'PS-NEG-006');
      expect(neg006?.passed).toBe(true);
      expect(neg006?.rejectedPattern).toBe('Shared Object Pointer / In-Memory Closure');

      const neg007 = result.results.find(r => r.proofId === 'PS-NEG-007');
      expect(neg007?.passed).toBe(true);

      const neg010 = result.results.find(r => r.proofId === 'PS-NEG-010');
      expect(neg010?.passed).toBe(true);
    });
  });

  describe('B. Positive Proof Suite (PS-POS-001 ... PS-POS-008)', () => {
    it('executes and verifies all 8 positive proofs with live serialization, reload, and verification', async () => {
      const result = await PersistencePositiveProofs.executeAllPositiveProofs();
      const failed = result.results.filter(r => !r.passed);
      if (failed.length > 0) {
        console.log('FAILED POSITIVE PROOFS:', failed);
      }
      expect(result.allPassed).toBe(true);
      expect(result.passCount).toBe(8);
      expect(result.totalCount).toBe(8);

      // Verify Master Package
      expect(result.masterEvidencePackage).toBeDefined();
      expect(result.masterEvidencePackage?.verdict).toBe('PASS');
      expect(result.masterEvidencePackage?.runtimeDestructionConfirmed).toBe(true);
      expect(result.masterEvidencePackage?.regenerationVerified).toBe(true);
      expect(result.masterEvidencePackage?.merkleRoot).toBeDefined();
      expect(result.masterEvidencePackage?.merkleRoot.length).toBe(64);
    });
  });

  describe('C. Independent Persistence Proof Verifier', () => {
    it('strictly identifies pointer sharing and marks it as a critical failure', () => {
      const doc = PersistencePositiveProofs.createTestDocument('DOC-VERIF-TEST');
      const verif = PersistenceProofVerifier.verifyEquivalence(doc, doc);
      expect(verif.passed).toBe(false);
      expect(verif.runtimeMemoryIsolated).toBe(false);
      expect(verif.differences.some(d => d.field === 'rootObjectReference')).toBe(true);
    });

    it('confirms 100% equivalence for independently deserialized cloned document', () => {
      const doc1 = PersistencePositiveProofs.createTestDocument('DOC-VERIF-TEST');
      const doc2 = PersistencePositiveProofs.createTestDocument('DOC-VERIF-TEST');
      const verif = PersistenceProofVerifier.verifyEquivalence(doc1, doc2);
      expect(verif.passed).toBe(true);
      expect(verif.score).toBe(100);
      expect(verif.runtimeMemoryIsolated).toBe(true);
      expect(verif.featureHistoryEquivalence).toBe(true);
    });
  });

  describe('D. Hard Acceptance Gate 057 Master Execution', () => {
    it('executes Gate 057 successfully with 100% score and zero critical failures', async () => {
      const report = await HardAcceptanceGate057.executeGate();

      expect(report.gateId).toBe('GATE-SECP-057');
      expect(report.promptId).toBe('PROMPT-057');
      expect(report.verdict).toBe('PASS');
      expect(report.score).toBe(100);
      expect(report.criticalFailuresDetected.length).toBe(0);
      expect(report.passedCount).toBe(28); // 20 negative + 8 positive
      expect(report.totalCount).toBe(28);

      // Verify all 15 sub-gates (A through O)
      const gateKeys = Object.keys(report.gates);
      expect(gateKeys.length).toBe(15);
      for (const key of gateKeys) {
        expect(report.gates[key].passed).toBe(true);
      }

      // Verify Provenance Ledger Entry 57
      expect(report.provenanceLedgerEntry.ledgerIndex).toBe(57);
      expect(report.provenanceLedgerEntry.parentGate).toBe('GATE-SECP-056');
      expect(report.provenanceLedgerEntry.merkleRoot).toBe(report.evidencePackage.merkleRoot);
    });
  });
});
