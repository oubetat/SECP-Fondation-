/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-068: Multi-Constraint Adaptive Timestep Controller
 */

import { LimiterReason } from './AdaptiveTypes';

export interface ControllerConfig {
  readonly minDt: number;
  readonly maxDt: number;
  readonly initialDt: number;
  readonly growthLimit: number;
  readonly shrinkLimit: number;
  readonly safetyFactor: number;
  readonly targetCFL: number;
  readonly targetError: number;
}

export class AdaptiveTimeStepController {
  private readonly config: ControllerConfig;

  constructor(config: ControllerConfig) {
    // Boundary check on factors
    if (config.minDt > config.maxDt) {
      throw new Error(`ADAPTIVE_CONTROLLER_ERROR: minDt (${config.minDt}) cannot be greater than maxDt (${config.maxDt})`);
    }
    if (config.growthLimit <= 1.0) {
      throw new Error(`ADAPTIVE_CONTROLLER_ERROR: growthLimit must be greater than 1.0`);
    }
    if (config.shrinkLimit <= 0.0 || config.shrinkLimit >= 1.0) {
      throw new Error(`ADAPTIVE_CONTROLLER_ERROR: shrinkLimit must be between 0.0 and 1.0`);
    }
    if (config.safetyFactor <= 0.0 || config.safetyFactor > 1.0) {
      throw new Error(`ADAPTIVE_CONTROLLER_ERROR: safetyFactor must be between 0.0 and 1.0`);
    }
    this.config = config;
  }

  public estimateInitialDt(
    dx: number,
    u_mean: number,
    soundSpeed: number,
    alpha: number
  ): { dt: number; limiter: LimiterReason } {
    // 1. Flow CFL limit: dt = CFL * dx / u_mean
    const dt_flow = u_mean > 0 ? (this.config.targetCFL * dx) / u_mean : Infinity;

    // 2. Acoustic limit: dt = CFL * dx / (u_mean + a)
    const dt_acoustic = (this.config.targetCFL * dx) / (u_mean + soundSpeed);

    // 3. Thermal diffusion limit: dt = CFL * dx^2 / alpha
    const dt_thermal = alpha > 0 ? (this.config.targetCFL * dx * dx) / alpha : Infinity;

    let dt = Math.min(dt_flow, dt_acoustic, dt_thermal);
    let limiter = LimiterReason.FLOW;

    if (dt === dt_acoustic) {
      limiter = LimiterReason.ACOUSTIC;
    } else if (dt === dt_thermal) {
      limiter = LimiterReason.THERMAL;
    }

    // Apply safety factor
    dt *= this.config.safetyFactor;

    // Boundary clamping
    if (dt < this.config.minDt) {
      dt = this.config.minDt;
    }
    if (dt > this.config.maxDt) {
      dt = this.config.maxDt;
    }

    return { dt, limiter };
  }

  public estimateNextDt(
    previousDt: number,
    measuredError: number,
    measuredCFL: number,
    limiter: LimiterReason
  ): { dt: number; limiter: LimiterReason } {
    let dt = previousDt;

    if (measuredError > 0) {
      // Error-based step update: dt_new = dt_old * safety * (tol / error)^(0.5)
      const ratio = this.config.targetError / measuredError;
      dt *= this.config.safetyFactor * Math.sqrt(ratio);
    } else if (measuredCFL > 0) {
      // CFL-based step update
      const ratio = this.config.targetCFL / measuredCFL;
      dt *= this.config.safetyFactor * ratio;
    }

    // Growth and shrink factors
    const maxAllowedGrowth = previousDt * this.config.growthLimit;
    const minAllowedShrink = previousDt * this.config.shrinkLimit;

    if (dt > maxAllowedGrowth) {
      dt = maxAllowedGrowth;
    }
    if (dt < minAllowedShrink) {
      dt = minAllowedShrink;
    }

    // Boundaries check
    if (dt < this.config.minDt) {
      throw new Error(`MIN_TIMESTEP_REACHED: Candidate timestep dt=${dt} is under minimum limit minDt=${this.config.minDt}`);
    }
    if (dt > this.config.maxDt) {
      dt = this.config.maxDt;
    }

    return { dt, limiter };
  }
}
