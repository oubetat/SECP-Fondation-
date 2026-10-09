/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-068: Adaptive Time Stepping Adversarial Tests
 */

import { describe, it, expect } from 'vitest';
import { AdaptiveTimeStepController } from '../AdaptiveTimeStepController';

describe('PATCH-068: Adaptive Time Stepping Adversarial Battery', () => {
  it('1. minDt > maxDt boundaries protection', () => {
    const config = {
      minDt: 1.0,
      maxDt: 1e-3,
      initialDt: 1e-3,
      growthLimit: 1.2,
      shrinkLimit: 0.5,
      safetyFactor: 0.9,
      targetCFL: 0.5,
      targetError: 1e-4
    };

    expect(() => new AdaptiveTimeStepController(config)).toThrow();
  });

  it('4. growthLimit <= 1 boundaries protection', () => {
    const config = {
      minDt: 1e-6,
      maxDt: 1.0,
      initialDt: 1e-3,
      growthLimit: 0.9,
      shrinkLimit: 0.5,
      safetyFactor: 0.9,
      targetCFL: 0.5,
      targetError: 1e-4
    };

    expect(() => new AdaptiveTimeStepController(config)).toThrow();
  });

  it('6. shrinkLimit >= 1 boundaries protection', () => {
    const config = {
      minDt: 1e-6,
      maxDt: 1.0,
      initialDt: 1e-3,
      growthLimit: 1.2,
      shrinkLimit: 1.5,
      safetyFactor: 0.9,
      targetCFL: 0.5,
      targetError: 1e-4
    };

    expect(() => new AdaptiveTimeStepController(config)).toThrow();
  });

  it('8. safetyFactor > 1 boundaries protection', () => {
    const config = {
      minDt: 1e-6,
      maxDt: 1.0,
      initialDt: 1e-3,
      growthLimit: 1.2,
      shrinkLimit: 0.5,
      safetyFactor: 1.1,
      targetCFL: 0.5,
      targetError: 1e-4
    };

    expect(() => new AdaptiveTimeStepController(config)).toThrow();
  });

  it('19. Underflow dt boundary limit check', () => {
    const config = {
      minDt: 1e-3,
      maxDt: 1.0,
      initialDt: 1e-3,
      growthLimit: 1.2,
      shrinkLimit: 0.5,
      safetyFactor: 0.9,
      targetCFL: 0.5,
      targetError: 1e-4
    };
    const controller = new AdaptiveTimeStepController(config);

    // Huge error suggests shrinking dt far below minDt of 1e-3 -> should trigger MIN_TIMESTEP_REACHED error
    expect(() => controller.estimateNextDt(1e-3, 1e12, 0.5, 'FLOW' as any)).toThrow('MIN_TIMESTEP_REACHED');
  });
});
