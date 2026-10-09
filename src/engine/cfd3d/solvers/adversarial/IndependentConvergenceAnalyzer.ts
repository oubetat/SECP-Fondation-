/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-075: Independent Convergence Analyzer
 */

import { ConvergencePolicy } from './AdversarialTypes';

export interface ConvergenceAuditResult {
  readonly isConverged: boolean;
  readonly finalResidual: number;
  readonly iterationCount: number;
  readonly isStagnant: boolean;
  readonly isOscillating: boolean;
  readonly isDiverging: boolean;
  readonly hasResidualReset: boolean;
  readonly isPrematurelyTerminated: boolean;
  readonly reasons: readonly string[];
}

export class IndependentConvergenceAnalyzer {
  public static auditResidualHistory(
    residualHistory: readonly number[],
    policy: ConvergencePolicy,
    solverClaimedConverged: boolean
  ): ConvergenceAuditResult {
    const reasons: string[] = [];

    if (residualHistory.length === 0) {
      return {
        isConverged: false,
        finalResidual: Infinity,
        iterationCount: 0,
        isStagnant: false,
        isOscillating: false,
        isDiverging: false,
        hasResidualReset: false,
        isPrematurelyTerminated: true,
        reasons: ['Residual history is empty.']
      };
    }

    const n = residualHistory.length;
    const finalResidual = residualHistory[n - 1];
    let isStagnant = false;
    let isOscillating = false;
    let isDiverging = false;
    let hasResidualReset = false;
    let isPrematurelyTerminated = false;

    // Check divergence: residual growing continuously over last iterations
    if (n >= 4) {
      if (
        residualHistory[n - 1] > residualHistory[n - 2] &&
        residualHistory[n - 2] > residualHistory[n - 3] &&
        residualHistory[n - 1] > 1.0
      ) {
        isDiverging = true;
        reasons.push('Residual history exhibits numerical divergence.');
      }
    }

    // Check stagnation: no significant relative drop over stagnation window
    const window = Math.min(policy.stagnationWindow, n);
    if (window >= 4) {
      const windowStart = residualHistory[n - window];
      const windowEnd = residualHistory[n - 1];
      const relDrop = Math.abs(windowStart - windowEnd) / (Math.abs(windowStart) + 1e-12);
      if (relDrop < policy.stagnationTolerance && finalResidual > policy.residualThreshold) {
        isStagnant = true;
        reasons.push(`Residual stagnated with relative variation ${relDrop.toExponential(2)} over ${window} iterations.`);
      }
    }

    // Check oscillation: frequent sign changes of derivative
    if (n >= 6) {
      let signChanges = 0;
      for (let i = 2; i < n; i++) {
        const d1 = residualHistory[i - 1] - residualHistory[i - 2];
        const d2 = residualHistory[i] - residualHistory[i - 1];
        if (d1 * d2 < 0) {
          signChanges++;
        }
      }
      if (signChanges > policy.allowedOscillationCount && finalResidual > policy.residualThreshold) {
        isOscillating = true;
        reasons.push(`Residual oscillates excessively (${signChanges} slope reversals).`);
      }
    }

    // Check abrupt reset attack (e.g. drop of > 3 orders of magnitude in a single step)
    for (let i = 1; i < n; i++) {
      const prev = residualHistory[i - 1];
      const curr = residualHistory[i];
      if (prev > 1e-4 && curr < 1e-7 && curr / prev < 1e-3) {
        hasResidualReset = true;
        reasons.push(`Abrupt artificial residual reset detected at iteration ${i + 1} (${prev.toExponential(2)} -> ${curr.toExponential(2)}).`);
      }
    }

    // Check premature termination
    if (n < policy.minIterations && finalResidual > policy.residualThreshold) {
      isPrematurelyTerminated = true;
      reasons.push(`Premature termination before minimum iterations (${n} < ${policy.minIterations}).`);
    }

    const satisfiesThreshold = finalResidual <= policy.residualThreshold;

    if (!satisfiesThreshold) {
      reasons.push(`Final residual ${finalResidual.toExponential(2)} exceeds threshold ${policy.residualThreshold.toExponential(2)}.`);
    }

    const isConverged =
      satisfiesThreshold &&
      !isDiverging &&
      !isOscillating &&
      !hasResidualReset &&
      !isPrematurelyTerminated;

    return {
      isConverged,
      finalResidual,
      iterationCount: n,
      isStagnant,
      isOscillating,
      isDiverging,
      hasResidualReset,
      isPrematurelyTerminated,
      reasons
    };
  }
}
