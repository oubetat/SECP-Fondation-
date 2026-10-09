/**
 * SECP Industrial OS v2 — CFD Convergence Auditor & False-Convergence Detector
 * Phase 15 (PATCH-174)
 *
 * Evaluates iteration logs, residual decay paths, stagnation, divergence, and
 * prevents false-convergence where residuals drop while conservation laws are breached.
 */

import { CfdIterationLog3D, CfdSolution3D } from '../../cfd3d/Fvm3DTypes';
import { CFDVerdict, CFDMassBalanceRecord } from './types';

export interface ConvergenceDiagnosis {
  verdict: CFDVerdict;
  isMonotonic: boolean;
  isStagnated: boolean;
  isDiverged: boolean;
  isFalseConvergenceDetected: boolean;
  residualContinuity: number;
  residualMomentum: number;
  iterationsCompleted: number;
  decayRatio: number;
  details: string;
}

export class CFDConvergenceAuditor {
  /**
   * Analyzes solver iteration logs and verifies true vs false convergence
   */
  public static diagnoseConvergence(
    solution: CfdSolution3D,
    massBalance: CFDMassBalanceRecord,
    continuityTol: number = 1e-3,
    momentumTol: number = 1e-3
  ): ConvergenceDiagnosis {
    const history = solution.iterationHistory || [];
    const n = history.length;

    if (n === 0) {
      return {
        verdict: 'NUMERICAL_FAILURE',
        isMonotonic: false,
        isStagnated: false,
        isDiverged: false,
        isFalseConvergenceDetected: false,
        residualContinuity: 999,
        residualMomentum: 999,
        iterationsCompleted: 0,
        decayRatio: 1.0,
        details: 'No iteration logs produced by CFD solver.'
      };
    }

    const firstLog = history[0];
    const lastLog = history[n - 1];

    const initialCont = Math.max(firstLog.continuityResidual, 1e-12);
    const finalCont = lastLog.continuityResidual;
    const finalMom = Math.max(lastLog.uMomentumResidual, lastLog.vMomentumResidual, lastLog.wMomentumResidual);

    const decayRatio = finalCont / initialCont;

    // Check Divergence (residuals > 1e4 or NaN/Infinity)
    let isDiverged = false;
    for (const log of history) {
      if (
        isNaN(log.continuityResidual) ||
        !isFinite(log.continuityResidual) ||
        log.continuityResidual > 1e4 ||
        log.maxVelocityMS > 1e5
      ) {
        isDiverged = true;
        break;
      }
    }

    if (isDiverged) {
      return {
        verdict: 'DIVERGED',
        isMonotonic: false,
        isStagnated: false,
        isDiverged: true,
        isFalseConvergenceDetected: false,
        residualContinuity: finalCont,
        residualMomentum: finalMom,
        iterationsCompleted: n,
        decayRatio,
        details: `Divergence detected: Residuals exceeded stability limits or produced non-finite values.`
      };
    }

    // Check Stagnation (last 30 iterations have < 1% variance in residuals while above tolerance)
    let isStagnated = false;
    if (n >= 40 && finalCont > continuityTol) {
      const window = history.slice(-20);
      const avg = window.reduce((acc, l) => acc + l.continuityResidual, 0) / window.length;
      const maxDev = Math.max(...window.map(l => Math.abs(l.continuityResidual - avg)));
      if (maxDev / avg < 0.05) {
        isStagnated = true;
      }
    }

    // Check Monotonicity (broadly non-increasing trend over windows)
    let monotonicCount = 0;
    for (let i = 1; i < n; i++) {
      if (history[i].continuityResidual <= history[i - 1].continuityResidual * 1.05) {
        monotonicCount++;
      }
    }
    const isMonotonic = monotonicCount / Math.max(n - 1, 1) >= 0.75;

    // False-Convergence Detection:
    // If residuals indicate convergence (< tol) BUT mass imbalance is high (> 5%), flag false convergence
    let isFalseConvergenceDetected = false;
    if (finalCont <= continuityTol && finalMom <= momentumTol && !massBalance.isConserved) {
      isFalseConvergenceDetected = true;
    }

    let verdict: CFDVerdict = 'NOT_CONVERGED';

    if (isFalseConvergenceDetected) {
      verdict = 'CONSERVATION_FAILURE';
    } else if (finalCont <= continuityTol && finalMom <= momentumTol && massBalance.isConserved) {
      verdict = 'CONVERGED';
    } else if (isStagnated) {
      verdict = 'STAGNATED';
    } else {
      verdict = 'NOT_CONVERGED';
    }

    const details = isFalseConvergenceDetected
      ? `FALSE CONVERGENCE DETECTED: Residuals met numerical tolerance (${finalCont.toExponential(2)} <= ${continuityTol}) but physical mass balance failed (${massBalance.relativeImbalancePercent.toFixed(2)}% > tolerance).`
      : verdict === 'CONVERGED'
      ? `Converged in ${n} iterations with continuity residual ${finalCont.toExponential(4)} and mass balance ${massBalance.relativeImbalancePercent.toFixed(4)}%.`
      : isStagnated
      ? `Residual stagnation observed over final iterations (${finalCont.toExponential(4)}).`
      : `Solver reached max iterations (${n}) without satisfying tolerances.`;

    return {
      verdict,
      isMonotonic,
      isStagnated,
      isDiverged,
      isFalseConvergenceDetected,
      residualContinuity: finalCont,
      residualMomentum: finalMom,
      iterationsCompleted: n,
      decayRatio,
      details
    };
  }
}
