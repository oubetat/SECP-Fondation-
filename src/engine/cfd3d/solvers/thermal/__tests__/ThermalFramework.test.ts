/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-066: Heat Transfer Framework Tests
 */

import { describe, it, expect } from 'vitest';
import { ThermalFlowModel } from '../ThermalFlowModel';
import { IndependentThermalVerifier } from '../IndependentThermalVerifier';

describe('PATCH-066: Heat Transfer Core Framework Tests', () => {
  const model = new ThermalFlowModel();

  it('Verify Fourier Law and Heat Flux Calculation', () => {
    const temperature = [300.0];
    const u = [10.0];
    const v = [0.0];
    const w = [0.0];
    const density = [1.2];
    const gradT: [number, number, number][] = [[-100.0, 0.0, 0.0]]; // 100 K/m cooling gradient
    const source = [0.0];

    const state = model.solveThermal(temperature, u, v, w, density, gradT, source);

    expect(state.thermalConductivity[0]).toBeGreaterThan(0);
    expect(state.heatFluxX[0]).toBeGreaterThan(0); // -k * gradT_x = -0.0262 * -100 = +2.62 W/m^2
    expect(state.heatFluxX[0]).toBeCloseTo(2.62, 2);
  });

  it('Verify Dimensionless Metrics (Prandtl, Peclet, Nusselt)', () => {
    const temperature = [300.0];
    const u = [10.0];
    const v = [0.0];
    const w = [0.0];
    const density = [1.2];
    const gradT: [number, number, number][] = [[0.0, 0.0, 0.0]];
    const source = [0.0];

    const state = model.solveThermal(temperature, u, v, w, density, gradT, source);
    const metrics = model.computeMetrics(10.0, 0.1, 1.8e-5, state);

    expect(metrics.Prandtl).toBeCloseTo(0.69, 1);
    expect(metrics.Reynolds).toBeCloseTo(1.2 * 10.0 * 0.1 / 1.8e-5, 1);
    expect(metrics.Nusselt).toBeGreaterThan(0);
  });

  it('Verify Independent Thermal Verifier', () => {
    const state = model.solveThermal([300.0], [0], [0], [0], [1.2], [[0,0,0]], [0]);
    const verifyResult = IndependentThermalVerifier.verify(state);

    expect(verifyResult.isValid).toBe(true);
    expect(verifyResult.temperaturePositivityPassed).toBe(true);
  });
});
