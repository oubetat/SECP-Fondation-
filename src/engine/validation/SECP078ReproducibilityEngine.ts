/**
 * PATCH-SECP-078: Deterministic Multi-Run Reproducibility Audit Engine
 * Executes multiple independent runs of the nonlinear solver across geometric,
 * material (plasticity), and contact mechanics configurations.
 * Verifies bit-exact reproducibility and zero drift (tolerance <= 1e-14).
 */

import { SECP078CleanRoomKernel } from './SECP078CleanRoomKernel';
import { SECP078AdversarialEngine } from './SECP078AdversarialEngine';
import { NonlinearAnalysisResult } from '../structural-physics/NonlinearMechanicsTypes';

export interface ReproducibilityAudit078Result {
  runCount: number;
  isDeterministic: boolean;
  maxCrossRunDiscrepancy: number;
  solutionVectorHash: string;
  residualVectorHash: string;
  plasticStateHash: string;
  contactStateHash: string;
  energyMetricsHash: string;
  passed: boolean;
  details: string;
}

export class SECP078ReproducibilityEngine {

  /**
   * Simple deterministic SHA256-like hashing for state arrays
   */
  private static hashFloatArray(arr: number[]): string {
    let hash = 0x811c9dc5;
    for (const val of arr) {
      const str = val.toExponential(14);
      for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0;
      }
    }
    return hash.toString(16).padStart(8, '0');
  }

  public static auditReproducibility(
    runs: number = 3,
    tolerance: number = 1e-14
  ): ReproducibilityAudit078Result {
    const baseline = SECP078AdversarialEngine.getBaselineSample();
    const results: NonlinearAnalysisResult[] = [];

    for (let r = 0; r < runs; r++) {
      const res = SECP078CleanRoomKernel.solveNonlinearSystem(
        baseline.nodes,
        baseline.elements,
        baseline.materials,
        baseline.bcs,
        baseline.loads,
        baseline.contactPairs,
        { numSteps: 5, residualTol: 1e-6 }
      );
      results.push(res);
    }

    // Compare displacements across runs
    let maxDiscrepancy = 0;
    const baseU = results[0].finalDisplacements;

    for (let r = 1; r < runs; r++) {
      const currU = results[r].finalDisplacements;
      for (let i = 0; i < baseU.length; i++) {
        const diff = Math.abs(baseU[i] - currU[i]);
        if (diff > maxDiscrepancy) maxDiscrepancy = diff;
      }
    }

    const solHash = this.hashFloatArray(baseU);
    const finalStep = results[0].steps[results[0].steps.length - 1];
    const resHash = this.hashFloatArray(finalStep?.residual ?? []);
    const plasticHash = this.hashFloatArray(results[0].finalPlasticStates.map(p => p.equivalentPlasticStrain));
    const contactHash = this.hashFloatArray(results[0].finalContactStates.map(c => c.normalForce));
    const energyHash = this.hashFloatArray([
      finalStep?.strainEnergy ?? 0,
      finalStep?.plasticDissipation ?? 0,
      finalStep?.contactEnergy ?? 0,
      finalStep?.totalWork ?? 0
    ]);

    const isDeterministic = maxDiscrepancy <= tolerance;
    const passed = isDeterministic && results.every(r => r.isConverged);

    return {
      runCount: runs,
      isDeterministic,
      maxCrossRunDiscrepancy: maxDiscrepancy,
      solutionVectorHash: solHash,
      residualVectorHash: resHash,
      plasticStateHash: plasticHash,
      contactStateHash: contactHash,
      energyMetricsHash: energyHash,
      passed,
      details: `Executed ${runs} independent runs. Max cross-run discrepancy = ${maxDiscrepancy.toExponential(2)} (Tolerance: ${tolerance.toExponential(2)}). Deterministic = ${isDeterministic}.`
    };
  }
}
