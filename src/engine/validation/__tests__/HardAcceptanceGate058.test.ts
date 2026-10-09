/**
 * SECP Industrial OS v3 — PROMPT-058: Hard Acceptance Gate 058 Test Suite
 *
 * Validates the complete Feature Regeneration Proof architecture:
 * 1. 20 Negative Proofs (RG-NEG-001 ... RG-NEG-020)
 * 2. 8 Positive Proofs (RG-POS-001 ... RG-POS-008)
 * 3. 17 Sub-Gates (GATE-A ... GATE-Q)
 * 4. Master Regeneration Proof with full dependency graph propagation.
 */

import { describe, it, expect } from 'vitest';
import { HardAcceptanceGate058 } from '../HardAcceptanceGate058';
import { RegenerationNegativeProofs } from '../../regeneration-proof/RegenerationNegativeProofs';
import { RegenerationPositiveProofs } from '../../regeneration-proof/RegenerationPositiveProofs';
import { RegenerationProofVerifier } from '../../regeneration-proof/RegenerationProofVerifier';
import { FeatureHistory } from '../../cad-kernel/history/FeatureHistory';

describe('PROMPT-058 — Feature Regeneration Proof Acceptance Gate', () => {
  describe('A. Negative Proof Suite (RG-NEG-001 ... RG-NEG-020)', () => {
    it('executes and verifies all 20 negative proofs reject fake or invalid regeneration', async () => {
      const result = await RegenerationNegativeProofs.executeAllNegativeProofs();
      const failed = result.results.filter(r => !r.passed);
      if (failed.length > 0) {
        console.log('FAILED NEGATIVE PROOFS:', failed);
      }
      expect(result.allPassed).toBe(true);
      expect(result.passCount).toBe(20);
      expect(result.totalCount).toBe(20);

      // Verify specific key negative proofs
      const neg001 = result.results.find(r => r.proofId === 'RG-NEG-001');
      expect(neg001?.passed).toBe(true);
      expect(neg001?.rejectedPattern).toBe('regenerate() called without downstream execution');

      const neg002 = result.results.find(r => r.proofId === 'RG-NEG-002');
      expect(neg002?.passed).toBe(true);
      expect(neg002?.rejectedPattern).toBe('document.revision++');

      const neg004 = result.results.find(r => r.proofId === 'RG-NEG-004');
      expect(neg004?.passed).toBe(true);
      expect(neg004?.rejectedPattern).toBe('Cached Geometry Reuse on Parameter Mutation');

      const neg005 = result.results.find(r => r.proofId === 'RG-NEG-005');
      expect(neg005?.passed).toBe(true);

      const neg016 = result.results.find(r => r.proofId === 'RG-NEG-016');
      expect(neg016?.passed).toBe(true);
      expect(neg016?.rejectedPattern).toBe('Circular Dependency Graph Cycle');

      const neg019 = result.results.find(r => r.proofId === 'RG-NEG-019');
      expect(neg019?.passed).toBe(true);
    });
  });

  describe('B. Positive Proof Suite (RG-POS-001 ... RG-POS-008)', () => {
    it('executes and verifies all 8 positive proofs with real multi-tier regeneration and verification', async () => {
      const result = await RegenerationPositiveProofs.executeAllPositiveProofs();
      const failed = result.results.filter(r => !r.passed);
      if (failed.length > 0) {
        console.log('FAILED POSITIVE PROOFS:', failed);
      }
      expect(result.allPassed).toBe(true);
      expect(result.passCount).toBe(8);
      expect(result.totalCount).toBe(8);

      // Verify Master Evidence Package
      expect(result.masterEvidencePackage).toBeDefined();
      expect(result.masterEvidencePackage?.verdict).toBe('PASS');
      expect(result.masterEvidencePackage?.merkleRoot).toBeDefined();
      expect(result.masterEvidencePackage?.merkleRoot.length).toBe(64);
      expect(result.masterEvidencePackage?.cryptographicSignature).toMatch(/^0x/);
      expect(result.masterEvidencePackage?.evaluatorExecutions.length).toBeGreaterThanOrEqual(4);
    }, 30000);
  });

  describe('C. Independent Regeneration Proof Verifier', () => {
    it('strictly verifies that unmutated definitions fail the mutation check', () => {
      const history = new FeatureHistory('DOC-TEST-VERIF');
      const featA = history.addFeature('EXTRUDE', 'FEAT_A', {
        type: 'EXTRUDE',
        name: 'FEAT_A',
        parameters: { depth: 25 },
        inputReferences: [],
        dependencyIds: []
      });
      history.regenerate({ forceAll: true });

      const fakeResult = {
        success: true,
        executedFeatureIds: [featA.id],
        skippedFeatureIds: [],
        failedFeatureIds: [],
        diagnostics: [],
        totalFeatures: 1
      };

      // Both before and after have identical definition (no actual mutation)
      const verif = RegenerationProofVerifier.verifyRegeneration(
        featA.id,
        history,
        history,
        fakeResult as any
      );

      expect(verif.passed).toBe(false);
      expect(verif.upstreamMutated).toBe(false);
      expect(verif.differences.some(d => d.category === 'MUTATION')).toBe(true);
    });
  });

  describe('D. Hard Acceptance Gate 058 Master Execution', () => {
    it('executes Gate 058 successfully with 100% score and zero critical failures', async () => {
      const report = await HardAcceptanceGate058.executeGate();

      expect(report.gateId).toBe('GATE-SECP-058');
      expect(report.promptId).toBe('PROMPT-058');
      expect(report.verdict).toBe('PASS');
      expect(report.score).toBe(100);
      expect(report.criticalFailuresDetected.length).toBe(0);
      expect(report.passedCount).toBe(28); // 20 negative + 8 positive
      expect(report.totalCount).toBe(28);

      // Verify all 17 sub-gates (GATE A through GATE Q)
      const gateKeys = Object.keys(report.gates);
      expect(gateKeys.length).toBe(17);
      for (const [key, gate] of Object.entries(report.gates)) {
        expect(gate.passed, `Sub-gate ${key} (${gate.name}) should pass`).toBe(true);
      }

      // Verify Provenance Ledger Entry
      expect(report.provenanceLedgerEntry.ledgerIndex).toBe(58);
      expect(report.provenanceLedgerEntry.parentGate).toBe('GATE-SECP-057');
      expect(report.provenanceLedgerEntry.merkleRoot).toBeDefined();
    }, 30000);
  });
});
