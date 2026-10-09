/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-067: Transient Flow Adversarial Tests
 */

import { describe, it, expect } from 'vitest';
import { TransientStateValidator, TransientFailureCode } from '../TransientStateValidator';

describe('PATCH-067: Transient Flow Adversarial Battery', () => {
  it('1. dt < 0 protection', () => {
    const check = TransientStateValidator.validateTimeStep(-0.1, 0.9, 1.0);
    expect(check.valid).toBe(false);
    expect(check.error).toBe(TransientFailureCode.NEGATIVE_TIMESTEP);
  });

  it('2. dt = 0 protection', () => {
    const check = TransientStateValidator.validateTimeStep(0.0, 1.0, 1.0);
    expect(check.valid).toBe(false);
    expect(check.error).toBe(TransientFailureCode.ZERO_TIMESTEP);
  });

  it('3. NaN dt protection', () => {
    const check = TransientStateValidator.validateTimeStep(NaN, 1.1, 1.0);
    expect(check.valid).toBe(false);
    expect(check.error).toBe(TransientFailureCode.NAN_TIMESTEP);
  });

  it('5. Time reversal detection', () => {
    const check = TransientStateValidator.validateTimeStep(0.1, 0.95, 1.0);
    expect(check.valid).toBe(false);
    expect(check.error).toBe(TransientFailureCode.TIME_REVERSAL);
  });
});
