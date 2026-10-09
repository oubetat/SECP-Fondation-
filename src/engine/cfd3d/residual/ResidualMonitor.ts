/**
 * SECP Industrial OS v2 — Residual Framework
 * PATCH-056: Residual Monitor
 */

import { ResidualSample, ResidualEquation } from './ResidualTypes';

export interface MonitorResult {
  readonly stagnant: boolean;
  readonly diverged: boolean;
  readonly oscillating: boolean;
  readonly reductionFactor: number;
  readonly diagnostics: string[];
}

export class ResidualMonitor {
  
  public static monitor(
    history: ResidualSample[],
    stagnationWindow: number = 20,
    stagnationTolerance: number = 1e-12,
    divergenceThreshold: number = 1e6
  ): MonitorResult {
    const diagnostics: string[] = [];
    let stagnant = false;
    let diverged = false;
    let oscillating = false;
    let reductionFactor = 1.0;

    if (history.length === 0) {
      return { stagnant, diverged, oscillating, reductionFactor, diagnostics };
    }

    const latest = history[history.length - 1];
    const initial = history[0];

    // 1. Divergence Check
    if (!latest.finite) {
      diverged = true;
      diagnostics.push('NON_FINITE_RESIDUAL');
    } else if (latest.absoluteResidual.l2 > initial.absoluteResidual.l2 * divergenceThreshold) {
      diverged = true;
      diagnostics.push('DIVERGENCE_DETECTED');
    }

    // 2. Reduction Factor
    if (history.length >= 2) {
      const prev = history[history.length - 2];
      if (prev.absoluteResidual.l2 > 0) {
        reductionFactor = latest.absoluteResidual.l2 / prev.absoluteResidual.l2;
      }
    }

    // 3. Stagnation Check
    if (history.length >= stagnationWindow) {
      const windowStart = history[history.length - stagnationWindow];
      const diff = Math.abs(latest.absoluteResidual.l2 - windowStart.absoluteResidual.l2);
      if (diff < stagnationTolerance * Math.max(latest.absoluteResidual.l2, 1.0)) {
        stagnant = true;
        diagnostics.push('STAGNATION_DETECTED');
      }
    }

    // 4. Oscillation Check
    if (history.length >= 4) {
      let flips = 0;
      for (let i = history.length - 1; i >= 2; i--) {
        const d1 = history[i].absoluteResidual.l2 - history[i - 1].absoluteResidual.l2;
        const d2 = history[i - 1].absoluteResidual.l2 - history[i - 2].absoluteResidual.l2;
        if (d1 * d2 < 0) flips++;
        // Limit window for oscillation check
        if (history.length - i > 10) break;
      }
      if (flips >= 2) {
        oscillating = true;
        diagnostics.push('OSCILLATORY_BEHAVIOR_DETECTED');
      }
    }

    return { stagnant, diverged, oscillating, reductionFactor, diagnostics };
  }
}
