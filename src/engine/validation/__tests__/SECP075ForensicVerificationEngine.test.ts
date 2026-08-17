/**
 * PATCH-SECP-075.4 Unit, Clean-Room & Cryptographic Audit Tests
 * Deterministic regression and adversarial tests for the SECP075.4 Independent Clean-Room Kernel,
 * 7-Stage Merkle-like Hash Chain, Blind Mutation Classification, and Negative-Control Calibration.
 */

import { describe, test, expect } from 'vitest';
import { SECP075LinearAlgebra } from '../SECP075LinearAlgebra';
import { SECP075ForensicVerificationEngine } from '../SECP075ForensicVerificationEngine';
import { SECP075AdversarialEngine } from '../SECP075AdversarialEngine';
import { SECP075CleanRoomKernel } from '../SECP075CleanRoomKernel';
import { SECP075CryptographicChain } from '../SECP075CryptographicChain';
import { HardAcceptanceGate075 } from '../HardAcceptanceGate075';

export class SECP075ForensicVerificationTestSuite {
  public static runAll(): { passed: boolean; results: { name: string; passed: boolean; message?: string }[] } {
    const results: { name: string; passed: boolean; message?: string }[] = [];

    // Test 1: Vector norm & dot product
    try {
      const v = [3, 4];
      const norm = SECP075LinearAlgebra.vectorNorm(v);
      const passedNorm = Math.abs(norm - 5) < 1e-10;

      const a = [1, 2, 3];
      const b = [4, 5, 6];
      const dot = SECP075LinearAlgebra.dot(a, b);
      const passedDot = dot === 32;

      results.push({
        name: 'vectorNorm and dot product',
        passed: passedNorm && passedDot,
        message: `norm=${norm}, dot=${dot}`
      });
    } catch (e: any) {
      results.push({ name: 'vectorNorm and dot product', passed: false, message: e.message });
    }

    // Test 2: Matrix symmetry & asymmetry detection
    try {
      const sym = [
        [2, 1],
        [1, 3]
      ];
      const symErr = SECP075LinearAlgebra.symmetryError(sym);

      const asym = [
        [2, 1],
        [3, 3]
      ];
      const asymErr = SECP075LinearAlgebra.symmetryError(asym);

      const passed = symErr < 1e-12 && asymErr > 0.1;
      results.push({
        name: 'symmetryError detection',
        passed,
        message: `symErr=${symErr.toExponential(3)}, asymErr=${asymErr.toExponential(3)}`
      });
    } catch (e: any) {
      results.push({ name: 'symmetryError detection', passed: false, message: e.message });
    }

    // Test 3: Cholesky SPD & Indefinite rejection
    try {
      const spd = [
        [4, 2],
        [2, 5]
      ];
      const resSPD = SECP075LinearAlgebra.choleskySPD(spd);

      const indefinite = [
        [1, 2],
        [2, 1]
      ];
      const resIndef = SECP075LinearAlgebra.choleskySPD(indefinite);

      const passed = resSPD.positiveDefinite === true && resIndef.positiveDefinite === false;
      results.push({
        name: 'choleskySPD positive-definite check and rejection',
        passed,
        message: `spd=${resSPD.positiveDefinite}, indefinite=${resIndef.positiveDefinite}`
      });
    } catch (e: any) {
      results.push({ name: 'choleskySPD positive-definite check and rejection', passed: false, message: e.message });
    }

    // Test 4: Conditioning and eigenvalue estimation
    try {
      const A = [
        [4, 0],
        [0, 2]
      ];
      const cond = SECP075LinearAlgebra.estimateConditioning(A);
      const passed =
        Math.abs(cond.lambdaMax - 4) < 1e-2 &&
        Math.abs(cond.lambdaMin - 2) < 1e-2 &&
        Math.abs(cond.conditionNumber - 2) < 1e-2;

      results.push({
        name: 'estimateConditioning spectral bounds',
        passed,
        message: `lMin=${cond.lambdaMin.toFixed(3)}, lMax=${cond.lambdaMax.toFixed(3)}, cond=${cond.conditionNumber.toFixed(3)}`
      });
    } catch (e: any) {
      results.push({ name: 'estimateConditioning spectral bounds', passed: false, message: e.message });
    }

    // Test 5: Independent Clean-Room Reference Kernel (SECP-075.4)
    try {
      const nodes = [
        { id: 1, x: 0, y: 0 }, { id: 2, x: 1, y: 0 },
        { id: 3, x: 1, y: 1 }, { id: 4, x: 0, y: 1 }
      ];
      const elements = [{ id: 1, nodeIds: [1, 2, 3, 4] as [number, number, number, number], thickness: 1.0 }];
      const mat = { E: 200e9, nu: 0.3 };
      const bcs = [{ nodeId: 1, fixX: true, fixY: true }, { nodeId: 4, fixX: true, fixY: true }];
      const loads = [{ nodeId: 2, fx: 1000, fy: 0 }];

      const sol = SECP075CleanRoomKernel.assembleAndSolve(nodes, elements, mat, bcs, loads);
      const passed =
        sol.freeDofs.length === 4 &&
        sol.spectral.isPositiveDefinite &&
        sol.relativeResidual < 1e-12 &&
        sol.strainEnergy > 0;

      results.push({
        name: 'Independent Clean-Room Zero-Dependency Solver',
        passed,
        message: `dim=${sol.freeDofs.length}, energy=${sol.strainEnergy.toExponential(3)}, relRes=${sol.relativeResidual.toExponential(3)}`
      });
    } catch (e: any) {
      results.push({ name: 'Independent Clean-Room Zero-Dependency Solver', passed: false, message: e.message });
    }

    // Test 6: 7-Stage Merkle Hash Chain Integrity & Tamper-Detection (SECP-075.4)
    try {
      const chain = SECP075CryptographicChain.buildHashChain({
        inputs: { test: 1 },
        mesh: { nodes: [1], elements: [1] },
        material: { E: 200e9, nu: 0.3 },
        bcs: [1],
        matrixSummary: { rows: 2, cols: 2, sampleSum: 10, frobeniusNorm: 20 },
        metrics: { cond: 2.0 },
        verdict: { passed: true, testCount: 10, failedCount: 0 }
      });

      const validBefore = SECP075CryptographicChain.verifyChainIntegrity(chain);

      // Mutate a link to test tamper detection
      const tamperedChain = JSON.parse(JSON.stringify(chain));
      tamperedChain.links[2].stepHash = 'CORRUPTED_HASH';
      const invalidAfter = !SECP075CryptographicChain.verifyChainIntegrity(tamperedChain);

      const passed = validBefore && invalidAfter && chain.finalChainHash.startsWith('SECP075-CHAIN-');

      results.push({
        name: '7-Stage Cryptographic Hash Chain & Tamper Rejection',
        passed,
        message: `validBefore=${validBefore}, tamperDetected=${invalidAfter}, chain=${chain.finalChainHash}`
      });
    } catch (e: any) {
      results.push({ name: '7-Stage Cryptographic Hash Chain & Tamper Rejection', passed: false, message: e.message });
    }

    // Test 7: Adversarial Suite, Blind Detection & Negative Controls (SECP-075.4)
    try {
      const adv = SECP075AdversarialEngine.runAdversarialSuite();
      const allMutations = adv.mutations.every(m => m.detected && m.verdictConsistent);
      const allBlind = adv.blindMutations.every(b => b.correctlyIdentified);
      const allNeg = adv.negativeControls.every(n => n.verdictConsistent);

      results.push({
        name: 'Adversarial Suite (Mutations, Blind & Negative Controls)',
        passed: adv.passed && allMutations && allBlind && allNeg,
        message: `${adv.mutations.length} mutations, ${adv.blindMutations.length} blind defects, ${adv.negativeControls.length} negative controls calibrated.`
      });
    } catch (e: any) {
      results.push({ name: 'Adversarial Suite (Mutations, Blind & Negative Controls)', passed: false, message: e.message });
    }

    // Test 8: Full Forensic Audit Suite with Non-Trivial Spectral & Clean-Room Cross-Check
    try {
      const audit = SECP075ForensicVerificationEngine.runForensicAudit();
      const nonTrivialSpectral =
        audit.spectral !== undefined &&
        audit.spectral.conditionNumber > 1.05 &&
        audit.spectral.lambdaMax > audit.spectral.lambdaMin;

      const hasProvenance = audit.provenanceHash && audit.provenanceHash.startsWith('SECP075-CHAIN-');
      const cleanRoomEquiv = audit.cleanRoom && audit.cleanRoom.isCleanRoomIdentical;

      results.push({
        name: 'SECP075.4 Forensic Verification Engine Audit & Clean-Room Equivalence',
        passed: audit.passed && audit.failedTests.length === 0 && Boolean(nonTrivialSpectral) && Boolean(hasProvenance) && Boolean(cleanRoomEquiv),
        message: `${audit.tests.length} tests run, failed: ${audit.failedTests.length}, κ(K)=${audit.spectral?.conditionNumber.toFixed(2)}, Chain=${audit.provenanceHash}`
      });
    } catch (e: any) {
      results.push({ name: 'SECP075.4 Forensic Verification Engine Audit & Clean-Room Equivalence', passed: false, message: e.message });
    }

    // Test 9: Hard Acceptance Gate 075.4 & SECP-075 FINAL-CLOSED
    try {
      const gate = HardAcceptanceGate075.runGate();
      results.push({
        name: 'HardAcceptanceGate075.4 execution (SECP-075 FINAL-CLOSED)',
        passed: gate.passed && gate.benchmarkPassed && gate.orchestrationPassed && gate.adversarialPassed && gate.cleanRoomPassed && gate.hashChainPassed,
        message: `passed=${gate.passed}, benchmark=${gate.benchmarkPassed}, orch=${gate.orchestrationPassed}, cleanRoom=${gate.cleanRoomPassed}, hashChain=${gate.hashChainPassed}`
      });
    } catch (e: any) {
      results.push({ name: 'HardAcceptanceGate075.4 execution (SECP-075 FINAL-CLOSED)', passed: false, message: e.message });
    }

    const allPassed = results.every(r => r.passed);
    return { passed: allPassed, results };
  }
}

describe('SECP075 Forensic Verification Test Suite', () => {
  const { results } = SECP075ForensicVerificationTestSuite.runAll();
  for (const r of results) {
    test(r.name, () => {
      expect(r.passed).toBe(true);
    });
  }
});
