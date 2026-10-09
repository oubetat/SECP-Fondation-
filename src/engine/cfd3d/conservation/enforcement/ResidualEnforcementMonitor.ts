/**
 * SECP Industrial OS v2 — Residual Enforcement Monitor
 * Phase 16 (PATCH-175)
 *
 * Converts residuals from a passive diagnostic readout into an active solver control signal.
 * Tracks absolute, normalized, RMS, and maximum residuals; detects stagnation,
 * oscillations, and explosive divergence to guide relaxation and time-step adaptation.
 */

import {
  ResidualEnforcementMetrics,
  ResidualRegime
} from './ConservationEnforcementTypes';

export class ResidualEnforcementMonitor {
  private initialResidual: number = 0;
  private history: number[] = [];
  private stagnationCount: number = 0;
  private oscillationCount: number = 0;

  public reset(): void {
    this.initialResidual = 0;
    this.history = [];
    this.stagnationCount = 0;
    this.oscillationCount = 0;
  }

  public evaluate(
    iteration: number,
    residuals: number[]
  ): ResidualEnforcementMetrics {
    let sumAbs = 0.0;
    let sumSq = 0.0;
    let maxRes = 0.0;

    const n = Math.max(1, residuals.length);
    for (let i = 0; i < residuals.length; i++) {
      const val = Math.abs(residuals[i]);
      if (!Number.isFinite(val) || Number.isNaN(val)) {
        return {
          absoluteResidual: Infinity,
          normalizedResidual: Infinity,
          rmsResidual: Infinity,
          maxResidual: Infinity,
          regime: 'PHYSICALLY_INVALID',
          stagnationCounter: 0,
          oscillationCounter: 0,
          divergenceFactor: Infinity,
          passed: false
        };
      }
      sumAbs += val;
      sumSq += val * val;
      if (val > maxRes) {
        maxRes = val;
      }
    }

    const absoluteResidual = sumAbs / n;
    const rmsResidual = Math.sqrt(sumSq / n);

    if (iteration === 1 || this.initialResidual === 0) {
      this.initialResidual = Math.max(1e-12, maxRes);
    }

    const normalizedResidual = maxRes / this.initialResidual;
    this.history.push(maxRes);

    // Analyze dynamic regime
    let regime: ResidualRegime = 'CONVERGING';
    let divergenceFactor = 1.0;

    if (this.history.length >= 2) {
      const prev = this.history[this.history.length - 2];
      divergenceFactor = maxRes / Math.max(1e-12, prev);

      // Divergence check
      if (divergenceFactor > 1.8) {
        regime = 'DIVERGING';
      } else if (Math.abs(maxRes - prev) / Math.max(1e-12, prev) < 0.005) {
        this.stagnationCount++;
        if (this.stagnationCount >= 4) {
          regime = 'STAGNATING';
        }
      } else {
        this.stagnationCount = Math.max(0, this.stagnationCount - 1);
      }

      // Oscillation check over last 4 points
      if (this.history.length >= 4) {
        const h = this.history;
        const d1 = h[h.length - 1] - h[h.length - 2];
        const d2 = h[h.length - 2] - h[h.length - 3];
        const d3 = h[h.length - 3] - h[h.length - 4];
        if ((d1 > 0 && d2 < 0 && d3 > 0) || (d1 < 0 && d2 > 0 && d3 < 0)) {
          this.oscillationCount++;
          if (this.oscillationCount >= 2) {
            regime = 'OSCILLATING';
          }
        } else {
          this.oscillationCount = Math.max(0, this.oscillationCount - 1);
        }
      }
    }

    const passed = (regime === 'CONVERGING' || regime === 'STAGNATING') && maxRes < 0.5;

    return {
      absoluteResidual,
      normalizedResidual,
      rmsResidual,
      maxResidual: maxRes,
      regime,
      stagnationCounter: this.stagnationCount,
      oscillationCounter: this.oscillationCount,
      divergenceFactor,
      passed
    };
  }
}
