/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-066: Heat Transfer Adversarial Tests
 */

import { describe, it, expect } from 'vitest';
import { ThermalStateValidator, ThermalFailureCode } from '../ThermalStateValidator';
import { ThermalConductivityModel, SpecificHeatModel } from '../ThermalConductivityModel';

describe('PATCH-066: Heat Transfer Adversarial Battery', () => {
  it('1. T < 0 Kelvin boundary protection', () => {
    const check = ThermalStateValidator.validate([-300.0], [0.0262], [1005.0]);
    expect(check.valid).toBe(false);
    expect(check.error).toBe(ThermalFailureCode.NEGATIVE_TEMPERATURE);
  });

  it('2. T = 0 Kelvin boundary protection', () => {
    const check = ThermalStateValidator.validate([0.0], [0.0262], [1005.0]);
    expect(check.valid).toBe(false);
    expect(check.error).toBe(ThermalFailureCode.NEGATIVE_TEMPERATURE);
  });

  it('3. NaN Temperature protection', () => {
    const check = ThermalStateValidator.validate([NaN], [0.0262], [1005.0]);
    expect(check.valid).toBe(false);
    expect(check.error).toBe(ThermalFailureCode.NAN_DETECTED);
  });

  it('5. Conductivity k < 0 protection', () => {
    const check = ThermalStateValidator.validate([300.0], [-0.01], [1005.0]);
    expect(check.valid).toBe(false);
    expect(check.error).toBe(ThermalFailureCode.INVALID_THERMAL_PROPERTY);
  });

  it('8. Specific heat cp < 0 protection', () => {
    const check = ThermalStateValidator.validate([300.0], [0.0262], [-500.0]);
    expect(check.valid).toBe(false);
    expect(check.error).toBe(ThermalFailureCode.INVALID_THERMAL_PROPERTY);
  });

  it('Evaluate Conductivity Model Boundaries', () => {
    const cond = new ThermalConductivityModel(-1.0, 0.0);
    expect(() => cond.evaluate(300.0)).toThrow();
  });
});
