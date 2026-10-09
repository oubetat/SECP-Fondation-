/**
 * SECP Industrial OS v2 — Turbulence Stability & Positivity Monitor
 * Phase 16 (PATCH-176: Turbulence Benchmark → Advanced Turbulence Framework)
 */

import { Fvm3DMesh } from '../../Fvm3DTypes';
import {
  TurbulenceState,
  TurbulenceValidationResult,
  TurbulenceStabilityConstraints
} from '../types/TurbulenceTypes';

export class TurbulenceStabilityMonitor {
  private static readonly EPS_POS = 1e-10;
  private static readonly MAX_MUT_RATIO_DEFAULT = 10000.0;

  /**
   * Enforce strict positivity on k, epsilon, omega, and nut
   * k >= EPS_POS, eps >= EPS_POS, omega >= EPS_POS, nut >= 0
   */
  public static enforcePositivity(
    states: TurbulenceState[],
    molecularViscosity: number,
    maxNutRatio: number = this.MAX_MUT_RATIO_DEFAULT
  ): { correctedCount: number; maxNutClamped: number } {
    let correctedCount = 0;
    let maxNutClamped = 0;
    const maxNutAllowed = maxNutRatio * molecularViscosity;

    for (let c = 0; c < states.length; c++) {
      const s = states[c];
      let neededCorrection = false;

      // Turbulent kinetic energy positivity
      if (s.k < this.EPS_POS || isNaN(s.k) || !isFinite(s.k)) {
        s.k = this.EPS_POS;
        neededCorrection = true;
      }

      // Epsilon positivity
      if (s.epsilon !== undefined) {
        if (s.epsilon < this.EPS_POS || isNaN(s.epsilon) || !isFinite(s.epsilon)) {
          s.epsilon = this.EPS_POS;
          neededCorrection = true;
        }
      }

      // Omega positivity
      if (s.omega !== undefined) {
        if (s.omega < this.EPS_POS || isNaN(s.omega) || !isFinite(s.omega)) {
          s.omega = this.EPS_POS;
          neededCorrection = true;
        }
      }

      // Nut positivity and upper bound limiter
      if (s.nut < 0 || isNaN(s.nut) || !isFinite(s.nut)) {
        s.nut = 0;
        neededCorrection = true;
      } else if (s.nut > maxNutAllowed) {
        s.nut = maxNutAllowed;
        maxNutClamped++;
        neededCorrection = true;
      }

      if (s.intermittencyGamma !== undefined) {
        s.intermittencyGamma = Math.min(1.0, Math.max(0.0, s.intermittencyGamma));
      }

      if (neededCorrection) {
        correctedCount++;
      }
    }

    return { correctedCount, maxNutClamped };
  }

  /**
   * Validate physical bounds and integrity of the turbulence field
   */
  public static validate(
    states: TurbulenceState[],
    molecularViscosity: number,
    _mesh: Fvm3DMesh,
    maxNutRatio: number = this.MAX_MUT_RATIO_DEFAULT
  ): TurbulenceValidationResult {
    let violations = 0;
    let unphysicalViscosity = false;
    let maxNutRatioObserved = 0;
    let worstCellId = 0;
    const details: string[] = [];

    for (let c = 0; c < states.length; c++) {
      const s = states[c];
      const nutRatio = s.nut / (molecularViscosity || 1e-5);

      if (nutRatio > maxNutRatioObserved) {
        maxNutRatioObserved = nutRatio;
        worstCellId = c;
      }

      if (s.k < 0 || isNaN(s.k) || (s.epsilon !== undefined && s.epsilon < 0) || (s.omega !== undefined && s.omega < 0)) {
        violations++;
      }

      if (nutRatio > maxNutRatio * 1.5) {
        unphysicalViscosity = true;
      }
    }

    if (violations > 0) {
      details.push(`Detected ${violations} positivity violations in turbulence transport variables.`);
    }
    if (unphysicalViscosity) {
      details.push(`Unphysical turbulent viscosity ratio detected: max nut/nu = ${maxNutRatioObserved.toFixed(1)} > limit ${maxNutRatio}`);
    }

    return {
      isValid: violations === 0 && !unphysicalViscosity,
      hasPositivityViolation: violations > 0,
      hasUnphysicalViscosity: unphysicalViscosity,
      hasResidualDivergence: false,
      positivityViolationsCount: violations,
      maxNutRatioObserved,
      worstCellId,
      details
    };
  }

  /**
   * Compute dynamic turbulence time-step stability limit
   */
  public static computeStabilityConstraints(
    states: TurbulenceState[],
    _mesh: Fvm3DMesh,
    currentCFL: number
  ): TurbulenceStabilityConstraints {
    let minTurbTimeScale = Infinity;

    for (let c = 0; c < states.length; c++) {
      const s = states[c];
      let tauTurb = 1.0;
      if (s.omega && s.omega > 1e-4) {
        tauTurb = 1.0 / s.omega;
      } else if (s.k && s.epsilon && s.epsilon > 1e-4) {
        tauTurb = s.k / s.epsilon;
      }

      if (tauTurb < minTurbTimeScale) {
        minTurbTimeScale = tauTurb;
      }
    }

    const maxAllowableDt = Math.max(1e-6, Math.min(0.05, minTurbTimeScale * 0.5));
    const isElevated = currentCFL > 2.0;

    return {
      maxAllowableTimestepS: maxAllowableDt,
      recommendedCFL: isElevated ? 1.0 : Math.min(currentCFL, 2.5),
      relaxationDampingFactor: isElevated ? 0.6 : 0.8,
      isStagnating: false,
      isOscillating: false,
      divergenceRiskLevel: isElevated ? 'ELEVATED' : 'SAFE'
    };
  }
}
