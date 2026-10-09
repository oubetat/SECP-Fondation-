/**
 * PATCH-SECP-076: Cross-Kernel Solver & Numerical Integrity Verification Tests
 * Zero-dependency, deterministic test suite executing:
 * - Independent reference calculations (matVec, residual, energy, direct Cholesky, Gaussian, PCG)
 * - Dual-path production vs reference agreement
 * - Residual recomputation & forgery detection
 * - Scaling invariance across [1e-6, 1.0, 1e6]
 * - Load perturbation physical correlation
 * - Boundary condition perturbation & singularity rejection
 * - 7/7 Solver mutations rejection (M1 to M7)
 * - Deterministic multi-run reproducibility
 * - 12-Stage Merkle cryptographic hash chain construction & tamper detection
 * - Master Gate execution (SECP-076 PASS & FINAL-CLOSED)
 */

import { describe, test, expect } from 'vitest';
import { SECP076SolverIntegrityKernel } from '../SECP076SolverIntegrityKernel';
import { SECP076CrossKernelVerifier } from '../SECP076CrossKernelVerifier';
import { SECP076PerturbationEngine } from '../SECP076PerturbationEngine';
import { SECP076ReproducibilityEngine } from '../SECP076ReproducibilityEngine';
import { HardAcceptanceGate076 } from '../HardAcceptanceGate076';

export interface SECP076TestResultItem {
  id: number;
  name: string;
  passed: boolean;
  message?: string;
}

export class SECP076SolverIntegrityTestSuite {

  public static runAll(): { passed: boolean; results: SECP076TestResultItem[] } {
    const results: SECP076TestResultItem[] = [];

    const K_sample = [
      [4, -1, 0, 0],
      [-1, 4, -1, 0],
      [0, -1, 4, -1],
      [0, 0, -1, 4]
    ];
    const f_sample = [100, 200, 200, 100];

    // Test 1: Independent Kernel Matrix-Vector, Residual, and Energy
    try {
      const x = [10, 20, 20, 10];
      const Ax = SECP076SolverIntegrityKernel.matVec(K_sample, x);
      const passedAx = Ax[0] === 20 && Ax[1] === 50 && Ax[2] === 50 && Ax[3] === 20;

      const res = SECP076SolverIntegrityKernel.computeResidual(K_sample, x, f_sample);
      const passedRes = res.r[0] === -80 && res.r[1] === -150 && res.relativeResidual > 0.1;

      const energy = SECP076SolverIntegrityKernel.computeEnergy(K_sample, x);
      const passedEnergy = Math.abs(energy - 1200) < 1e-10;

      results.push({
        id: 1,
        name: 'SECP076SolverIntegrityKernel: matVec, residual, energy calculation',
        passed: passedAx && passedRes && passedEnergy,
        message: `energy=${energy}, relRes=${res.relativeResidual.toFixed(4)}`
      });
    } catch (e: any) {
      results.push({ id: 1, name: 'SECP076SolverIntegrityKernel: matVec, residual, energy calculation', passed: false, message: e.message });
    }

    // Test 2: Reference Solvers (Cholesky, Gaussian, PCG)
    try {
      const chol = SECP076SolverIntegrityKernel.solveDirectCholesky(K_sample, f_sample);
      const gauss = SECP076SolverIntegrityKernel.solveDirectGaussian(K_sample, f_sample);
      const pcg = SECP076SolverIntegrityKernel.solveIndependentPCG(K_sample, f_sample, 1e-12, 1000);

      let maxDiff = 0.0;
      for (let i = 0; i < 4; i++) {
        const d1 = Math.abs(chol.x[i] - gauss.x[i]);
        const d2 = Math.abs(chol.x[i] - pcg.x[i]);
        if (d1 > maxDiff) maxDiff = d1;
        if (d2 > maxDiff) maxDiff = d2;
      }

      const res = SECP076SolverIntegrityKernel.computeResidual(K_sample, chol.x, f_sample);
      const passed = chol.success && gauss.success && pcg.converged && maxDiff < 1e-10 && res.relativeResidual < 1e-12;

      results.push({
        id: 2,
        name: 'Pure Reference Solvers Agreement (Cholesky, Gaussian, PCG)',
        passed,
        message: `maxDiff=${maxDiff.toExponential(3)}, relRes=${res.relativeResidual.toExponential(3)}`
      });
    } catch (e: any) {
      results.push({ id: 2, name: 'Pure Reference Solvers Agreement', passed: false, message: e.message });
    }

    // Test 3: Cross-Kernel Dual-Path Production vs Reference Agreement
    try {
      const verifyResult = SECP076CrossKernelVerifier.verifySystem(K_sample, f_sample);
      const passed =
        verifyResult.passed &&
        verifyResult.stabilityClass === 'STABLE' &&
        verifyResult.discrepancy.relativeDiff < 1e-10 &&
        verifyResult.discrepancy.relativeEnergyDiff < 1e-10;

      results.push({
        id: 3,
        name: 'Dual-Path Production vs Reference Cross-Kernel Verification',
        passed,
        message: `solDiff=${verifyResult.discrepancy.relativeDiff.toExponential(3)}, class=${verifyResult.stabilityClass}`
      });
    } catch (e: any) {
      results.push({ id: 3, name: 'Dual-Path Cross-Kernel Verification', passed: false, message: e.message });
    }

    // Test 4: Residual Forgery and False Convergence Rejection
    try {
      const forgedResult = SECP076CrossKernelVerifier.verifySystem(K_sample, f_sample, {
        mockProductionCorruptions: {
          forgedConvergence: true,
          forgedResidualZero: true,
          corruptSolutionIdx: 0,
          corruptSolutionDelta: 10.0
        }
      });
      const passed = !forgedResult.passed && !forgedResult.checks.residualPass && !forgedResult.checks.solutionDiscrepancyPass;

      results.push({
        id: 4,
        name: 'Residual Forgery & False Convergence Detection',
        passed,
        message: `passedVerdict=${forgedResult.passed} (expected false)`
      });
    } catch (e: any) {
      results.push({ id: 4, name: 'Residual Forgery Detection', passed: false, message: e.message });
    }

    // Test 5: Scaling Invariance
    try {
      const scaling = SECP076PerturbationEngine.testScalingInvariance(K_sample, f_sample, [1e-6, 1.0, 1e6], 1e-6);
      results.push({
        id: 5,
        name: 'Scaling Invariance Across Scales [1e-6, 1.0, 1e6]',
        passed: scaling.passed,
        message: `maxDiscrepancy=${scaling.maxDiscrepancy.toExponential(3)}`
      });
    } catch (e: any) {
      results.push({ id: 5, name: 'Scaling Invariance', passed: false, message: e.message });
    }

    // Test 6: Load Perturbation
    try {
      const loadPerturb = SECP076PerturbationEngine.testLoadPerturbation(K_sample, f_sample, 0.05);
      results.push({
        id: 6,
        name: 'Load Perturbation & Energy Response Correlation',
        passed: loadPerturb.passed,
        message: `energyCorrelated=${loadPerturb.energyChangeCorrelated}, deltaNorm=${loadPerturb.solutionDeltaNorm.toExponential(3)}`
      });
    } catch (e: any) {
      results.push({ id: 6, name: 'Load Perturbation', passed: false, message: e.message });
    }

    // Test 7: 7-Solver Mutation Suite (M1 to M7)
    try {
      const mutations = SECP076PerturbationEngine.runSolverMutationSuite(K_sample, f_sample);
      const allBlocked = mutations.length === 7 && mutations.every(m => m.detected && m.verdictConsistent);
      results.push({
        id: 7,
        name: 'Solver Mutation Suite (M1 to M7 Rejection Proof)',
        passed: allBlocked,
        message: `${mutations.filter(m => m.detected).length}/7 Mutations Rejected`
      });
    } catch (e: any) {
      results.push({ id: 7, name: 'Solver Mutation Suite', passed: false, message: e.message });
    }

    // Test 8: Reproducibility Engine Multi-Run Determinism
    try {
      const repro = SECP076ReproducibilityEngine.auditReproducibility(K_sample, f_sample, 3, 1e-14);
      results.push({
        id: 8,
        name: 'Multi-Run Deterministic Reproducibility Audit (3 Runs)',
        passed: repro.passed && repro.isDeterministic,
        message: `maxDiff=${repro.maxCrossRunDiscrepancy.toExponential(2)}`
      });
    } catch (e: any) {
      results.push({ id: 8, name: 'Reproducibility Audit', passed: false, message: e.message });
    }

    // Test 9: 12-Stage Merkle Cryptographic Hash Chain Integrity & Tamper Detection
    try {
      const gateReport = HardAcceptanceGate076.runGate();
      const validInitial = gateReport.hashChain.isValidChain && gateReport.hashChain.links.length === 12;

      // Tamper test
      const tamperedChain = { ...gateReport.hashChain, links: [...gateReport.hashChain.links] };
      tamperedChain.links[3] = { ...tamperedChain.links[3], stepHash: 'CORRUPTED_HASH' };
      const tamperedDetected = !HardAcceptanceGate076.verifyChainIntegrity(tamperedChain);

      results.push({
        id: 9,
        name: '12-Stage Merkle Hash Chain & Tamper Detection',
        passed: validInitial && tamperedDetected,
        message: `links=${gateReport.hashChain.links.length}, tamperDetected=${tamperedDetected}`
      });
    } catch (e: any) {
      results.push({ id: 9, name: 'Hash Chain Integrity', passed: false, message: e.message });
    }

    // Test 10: Master Gate Orchestration SECP-076 PASS & FINAL-CLOSED
    try {
      const gateReport = HardAcceptanceGate076.runGate();
      const passed =
        gateReport.passed &&
        gateReport.gateStatus === 'SECP-076 FINAL-CLOSED' &&
        gateReport.parentGateStatus === 'SECP-075 FINAL-CLOSED' &&
        gateReport.mandatoryTests.length === 16 &&
        gateReport.mandatoryTests.every(t => t.passed) &&
        gateReport.evidenceRecord.mutationsRejectedCount === 7;

      results.push({
        id: 10,
        name: 'Master Hard Acceptance Gate 076 FINAL-CLOSED',
        passed,
        message: `status=${gateReport.gateStatus}, 16/16 Invariants Passed`
      });
    } catch (e: any) {
      results.push({ id: 10, name: 'Master Gate 076 Execution', passed: false, message: e.message });
    }

    const allPassed = results.every(r => r.passed);
    return { passed: allPassed, results };
  }
}

describe('SECP076 Solver Integrity Test Suite', () => {
  const { results } = SECP076SolverIntegrityTestSuite.runAll();
  for (const r of results) {
    test(r.name, () => {
      expect(r.passed).toBe(true);
    });
  }
});
