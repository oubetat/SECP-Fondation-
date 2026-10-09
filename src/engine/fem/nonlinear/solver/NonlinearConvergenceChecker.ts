/**
 * SECP Industrial OS v3 — Nonlinear Convergence Checker (PATCH-238)
 *
 * Evaluates multi-criterion convergence policies:
 * 1. Force Residual Norm: ||R|| / (||F_ext|| + \epsilon) <= \varepsilon_F
 * 2. Displacement Increment Norm: ||\Delta u|| / (||u|| + \epsilon) <= \varepsilon_U
 * 3. Energy Norm: |\Delta u^T * R| / (|u^T * F_ext| + \epsilon) <= \varepsilon_E
 *
 * Explicit policy: 'CONVERGED' or 'NOT_CONVERGED'. Never converts failure into PASS.
 */

import {
  ConvergenceStatus,
  NonlinearConvergenceTolerances
} from '../types/NonlinearStructuralTypes';

export interface ConvergenceCheckResult {
  status: ConvergenceStatus;
  forceResidualNorm: number;
  relativeForceResidual: number;
  displacementIncrementNorm: number;
  relativeDisplacement: number;
  energyNorm: number;
  relativeEnergyNorm: number;
  forceConverged: boolean;
  displacementConverged: boolean;
  energyConverged: boolean;
  isConverged: boolean;
  isDiverging: boolean;
  summaryMessage: string;
}

export class NonlinearConvergenceChecker {
  /**
   * Evaluates convergence status against active tolerances
   */
  public static evaluate(
    residualVector: number[],
    fExternal: number[],
    deltaDisplacement: number[],
    currentDisplacement: number[],
    tolerances: NonlinearConvergenceTolerances
  ): ConvergenceCheckResult {
    const dofCount = residualVector.length;

    // 1. Force Residual Norms
    let rSquareSum = 0;
    let fExtSquareSum = 0;
    for (let i = 0; i < dofCount; i++) {
      rSquareSum += residualVector[i] * residualVector[i];
      fExtSquareSum += fExternal[i] * fExternal[i];
    }
    const forceResidualNorm = Math.sqrt(rSquareSum);
    const fExtNorm = Math.sqrt(fExtSquareSum);
    const relativeForceResidual = forceResidualNorm / (fExtNorm + 1e-12);

    // 2. Displacement Increment Norms
    let deltaUSquareSum = 0;
    let uSquareSum = 0;
    for (let i = 0; i < dofCount; i++) {
      deltaUSquareSum += deltaDisplacement[i] * deltaDisplacement[i];
      uSquareSum += currentDisplacement[i] * currentDisplacement[i];
    }
    const displacementIncrementNorm = Math.sqrt(deltaUSquareSum);
    const uNorm = Math.sqrt(uSquareSum);
    const relativeDisplacement = displacementIncrementNorm / (uNorm + 1e-12);

    // 3. Energy Norm |\Delta u^T * R|
    let energyNorm = 0;
    let extWorkReference = 0;
    for (let i = 0; i < dofCount; i++) {
      energyNorm += Math.abs(deltaDisplacement[i] * residualVector[i]);
      extWorkReference += Math.abs(currentDisplacement[i] * fExternal[i]);
    }
    const relativeEnergyNorm = energyNorm / (extWorkReference + 1e-12);

    // Evaluate against tolerances
    const forceConverged =
      relativeForceResidual <= tolerances.forceTolerance || forceResidualNorm < 1e-8;
    const displacementConverged =
      relativeDisplacement <= tolerances.displacementTolerance || displacementIncrementNorm < 1e-8;
    const energyConverged =
      relativeEnergyNorm <= tolerances.energyTolerance || energyNorm < 1e-10;

    const isConverged = forceConverged && displacementConverged && energyConverged;
    const isDiverging =
      forceResidualNorm > 1e12 ||
      !Number.isFinite(forceResidualNorm) ||
      !Number.isFinite(displacementIncrementNorm);

    const status: ConvergenceStatus = isConverged
      ? 'CONVERGED'
      : isDiverging
      ? 'DIVERGING'
      : 'NOT_CONVERGED';

    const summaryMessage = isConverged
      ? 'CONVERGED: Force, displacement, and energy norms within tolerance.'
      : isDiverging
      ? 'DIVERGING: Residual norm exploded or encountered NaN/Inf.'
      : `NOT_CONVERGED: ForceRel=${relativeForceResidual.toExponential(3)}, DispRel=${relativeDisplacement.toExponential(3)}, Energy=${energyNorm.toExponential(3)}`;

    return {
      status,
      forceResidualNorm,
      relativeForceResidual,
      displacementIncrementNorm,
      relativeDisplacement,
      energyNorm,
      relativeEnergyNorm,
      forceConverged,
      displacementConverged,
      energyConverged,
      isConverged,
      isDiverging,
      summaryMessage
    };
  }
}
