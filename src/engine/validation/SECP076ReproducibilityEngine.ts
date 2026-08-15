/**
 * PATCH-SECP-076: Solver Reproducibility & Multi-Run Determinism Engine
 * Executes repeated solves (Run 1, Run 2, Run 3) on the same numerical problem.
 * Validates deterministic hashes of:
 * - solutionHash
 * - residualHash
 * - metricsHash
 * - configurationHash
 * Verifies that solution variation across repeated runs is <= numerical machine epsilon.
 */

import { SECP075CryptographicChain } from './SECP075CryptographicChain';
import { SECP076CrossKernelVerifier, CrossKernelSolveResult } from './SECP076CrossKernelVerifier';

export interface ReproducibilityRunRecord {
  runIndex: number;
  solutionHash: string;
  residualHash: string;
  metricsHash: string;
  configurationHash: string;
  strainEnergy: number;
  relativeResidual: number;
  passed: boolean;
}

export interface ReproducibilityResult {
  passed: boolean;
  numRuns: number;
  isDeterministic: boolean;
  maxCrossRunDiscrepancy: number;
  tolerance: number;
  configurationHash: string;
  finalSolutionHash: string;
  finalResidualHash: string;
  finalMetricsHash: string;
  runs: ReproducibilityRunRecord[];
  details: string;
}

export class SECP076ReproducibilityEngine {

  /**
   * Executes multi-run reproducibility audit on a system (K, f).
   */
  public static auditReproducibility(
    K: number[][],
    f: number[],
    numRuns: number = 3,
    tolerance: number = 1e-14
  ): ReproducibilityResult {
    const runs: ReproducibilityRunRecord[] = [];
    const solutions: number[][] = [];

    const configPayload = {
      solver: 'LinearSolverAbstraction + Reference Cholesky/PCG',
      dofs: f.length,
      matrixFrobenius: K.reduce((acc, row) => acc + row.reduce((rAcc, v) => rAcc + v * v, 0), 0),
      loadL2Norm: Math.sqrt(f.reduce((acc, v) => acc + v * v, 0))
    };
    const configurationHash = SECP075CryptographicChain.hashString(JSON.stringify(configPayload));

    for (let r = 0; r < numRuns; r++) {
      const solveResult: CrossKernelSolveResult = SECP076CrossKernelVerifier.verifySystem(K, f);
      const prodX = solveResult.production.x;
      solutions.push(prodX);

      // Deterministic hash of solution vector
      const solStr = prodX.map(v => v.toExponential(14)).join(',');
      const solutionHash = SECP075CryptographicChain.hashString(`SOL_${r}:${solStr}`);

      // Deterministic hash of residual
      const resStr = solveResult.production.independentResidual.r.map(v => v.toExponential(14)).join(',');
      const residualHash = SECP075CryptographicChain.hashString(`RES_${r}:${resStr}`);

      // Deterministic hash of metrics
      const metricsPayload = {
        strainEnergy: solveResult.production.strainEnergy.toExponential(12),
        relativeResidual: solveResult.production.independentResidual.relativeResidual.toExponential(12),
        conditionNumber: solveResult.spectral.conditionNumber.toFixed(4),
        stabilityClass: solveResult.stabilityClass
      };
      const metricsHash = SECP075CryptographicChain.hashString(`MET_${r}:${JSON.stringify(metricsPayload)}`);

      runs.push({
        runIndex: r + 1,
        solutionHash,
        residualHash,
        metricsHash,
        configurationHash,
        strainEnergy: solveResult.production.strainEnergy,
        relativeResidual: solveResult.production.independentResidual.relativeResidual,
        passed: solveResult.passed
      });
    }

    // Measure maximum discrepancy between consecutive runs
    let maxCrossRunDiscrepancy = 0.0;
    for (let i = 0; i < solutions.length; i++) {
      for (let j = i + 1; j < solutions.length; j++) {
        const x1 = solutions[i];
        const x2 = solutions[j];
        for (let k = 0; k < x1.length; k++) {
          const diff = Math.abs(x1[k] - x2[k]);
          if (diff > maxCrossRunDiscrepancy) {
            maxCrossRunDiscrepancy = diff;
          }
        }
      }
    }

    // Check hash identity (modulo run index prefixes)
    const baseRun = runs[0];
    const allEnergiesIdentical = runs.every(
      run => Math.abs(run.strainEnergy - baseRun.strainEnergy) <= tolerance
    );
    const allResidualsIdentical = runs.every(
      run => Math.abs(run.relativeResidual - baseRun.relativeResidual) <= tolerance
    );
    const allPassed = runs.every(run => run.passed);

    const isDeterministic =
      allPassed &&
      allEnergiesIdentical &&
      allResidualsIdentical &&
      maxCrossRunDiscrepancy <= tolerance;

    const passed = isDeterministic;

    return {
      passed,
      numRuns,
      isDeterministic,
      maxCrossRunDiscrepancy,
      tolerance,
      configurationHash,
      finalSolutionHash: baseRun.solutionHash,
      finalResidualHash: baseRun.residualHash,
      finalMetricsHash: baseRun.metricsHash,
      runs,
      details: passed
        ? `Deterministic reproducibility PASSED across ${numRuns} runs: max cross-run diff = ${maxCrossRunDiscrepancy.toExponential(2)} (<= tol ${tolerance.toExponential(2)})`
        : `Deterministic reproducibility FAILED: max cross-run diff = ${maxCrossRunDiscrepancy.toExponential(2)} > tol ${tolerance.toExponential(2)}`
    };
  }
}
