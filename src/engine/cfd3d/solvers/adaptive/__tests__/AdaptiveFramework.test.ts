/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-068: Adaptive Time Stepping Core Framework Tests
 */

import { describe, it, expect } from 'vitest';
import { AdaptiveTimeStepController } from '../AdaptiveTimeStepController';
import { AdaptiveStepAcceptancePolicy } from '../AdaptiveStepAcceptancePolicy';
import { TemporalErrorEstimator } from '../TemporalErrorEstimator';
import { IndependentAdaptiveTimeVerifier } from '../IndependentAdaptiveTimeVerifier';
import { LimiterReason } from '../AdaptiveTypes';

describe('PATCH-068: Adaptive Time Stepping Core Framework Tests', () => {
  const config = {
    minDt: 1e-6,
    maxDt: 1.0,
    initialDt: 1e-3,
    growthLimit: 1.2,
    shrinkLimit: 0.5,
    safetyFactor: 0.9,
    targetCFL: 0.5,
    targetError: 1e-4
  };

  const controller = new AdaptiveTimeStepController(config);

  it('Verify Multi-Constraint Initial Timestep Selection', () => {
    // 1. Flow velocity = 10.0, speed of sound = 340.0, thermal alpha = 1e-5, grid dx = 0.1
    // Flow CFL Limit: 0.5 * 0.1 / 10.0 = 0.005s
    // Acoustic CFL Limit: 0.5 * 0.1 / (10.0 + 340.0) = 0.0001428s
    // Thermal limit: 0.5 * 0.1^2 / 1e-5 = 500s
    // candidate is dt_acoustic = 0.0001428s
    // applying safety factor = 0.9 * 0.0001428s = 0.0001285s
    const init = controller.estimateInitialDt(0.1, 10.0, 340.0, 1e-5);

    expect(init.limiter).toBe(LimiterReason.ACOUSTIC);
    expect(init.dt).toBeCloseTo(((0.5 * 0.1) / 350.0) * 0.9, 5);
  });

  it('Verify Adaptive Growth and Shrink Boundary Enforcements', () => {
    // Growth limit: previous = 1e-3, growthLimit = 1.2 -> max = 1.2e-3
    // Next candidate without error suggests growth (e.g. error is extremely low)
    const next = controller.estimateNextDt(1e-3, 1e-10, 0.1, LimiterReason.FLOW);
    expect(next.dt).toBeCloseTo(1.2e-3, 6);

    // Shrink limit: previous = 1e-3, shrinkLimit = 0.5 -> min = 5e-4
    // Next candidate with extremely high error suggests shrink
    const nextShrink = controller.estimateNextDt(1e-3, 1.0, 0.1, LimiterReason.FLOW);
    expect(nextShrink.dt).toBeCloseTo(5e-4, 6);
  });

  it('Verify Temporal Error Estimation via Step-Doubling', () => {
    const error = TemporalErrorEstimator.estimateStepDoublingError([1.0, 1.0], [1.02, 1.02]);
    expect(error.errorL2).toBeCloseTo(0.02, 5);
    expect(error.errorLMax).toBeCloseTo(0.02, 5);
  });

  it('Verify Step Acceptance Policy', () => {
    // Within limits
    const accept = AdaptiveStepAcceptancePolicy.evaluate(5e-5, 1e-4, 0.4, 0.5, [1.2]);
    expect(accept.accepted).toBe(true);

    // Error exceeded
    const reject = AdaptiveStepAcceptancePolicy.evaluate(2e-4, 1e-4, 0.4, 0.5, [1.2]);
    expect(reject.accepted).toBe(false);
    expect(reject.reason).toContain('TEMPORAL_ERROR_EXCEEDED');
  });
});
