/**
 * SECP Industrial OS — Engineering Truth OS
 * ThermoMechanicalQualification005.test.ts
 *
 * Test battery for SECP-PHYSICS-EXPANSION-005:
 * Independent Thermo-Mechanical Coupling Qualification.
 */

import { describe, it, expect } from 'vitest';
import { IndependentThermoMechanicalAuditor005 } from '../thermal/IndependentThermoMechanicalAuditor005';

describe('SECP-PHYSICS-EXPANSION-005 — Thermo-Mechanical Qualification Battery', () => {
  it('BM-1: Free Unconstrained Uniform Thermal Expansion', () => {
    // Lx = 0.1m, alpha = 1.2e-5 /K, Delta T = 100K => u_x = 1.2e-4 m, sigma = 0
    const { dispResult, stressResult } = IndependentThermoMechanicalAuditor005.evaluateBM1UniformExpansion(
      0.1, 1.2e-5, 100.0, 200e9, 0.3, 1.2e-4, 0.0
    );

    expect(dispResult.passed).toBe(true);
    expect(dispResult.relativeErrorPercent).toBeLessThan(0.1);
    expect(stressResult.passed).toBe(true);
  });

  it('BM-2: Fully Restrained Thermal Expansion Hydrostatic Stress', () => {
    // E = 200 GPa, nu = 0.3, alpha = 1.2e-5 /K, Delta T = 100K
    // K_bulk = 200e9 / (3 * 0.4) = 1.666667e11 Pa
    // sigma = -3 * K_bulk * alpha * Delta T = -6.0e8 Pa (-600 MPa)
    const { stressResult, reactionResult } = IndependentThermoMechanicalAuditor005.evaluateBM2FullyRestrainedExpansion(
      1.2e-5, 100.0, 200e9, 0.3, 0.01, -6.0e8, 6.0e6
    );

    expect(stressResult.passed).toBe(true);
    expect(stressResult.relativeErrorPercent).toBeLessThan(0.1);
    expect(reactionResult.passed).toBe(true);
    expect(reactionResult.relativeErrorPercent).toBeLessThan(0.1);
  });

  it('BM-3: 1D Thermoelastic Bar with Linear Temperature Gradient', () => {
    // L = 0.1m, alpha = 1.2e-5 /K, Delta T = 100K => u(L) = 0.5 * 1.2e-5 * 100 * 0.1 = 6.0e-5 m
    const result = IndependentThermoMechanicalAuditor005.evaluateBM3ThermoelasticBar(
      0.1, 1.2e-5, 100.0, 6.0e-5
    );

    expect(result.passed).toBe(true);
    expect(result.relativeErrorPercent).toBeLessThan(0.1);
  });

  it('BM-4: Spatially Varying Temperature Field with Material Gradients E(T)', () => {
    const result = IndependentThermoMechanicalAuditor005.evaluateBM4VaryingTempMaterial(
      0.1, 0.01, 200e9, 0.0005, 1.2e-5, 100.0, 293.15, 1.16e5
    );

    expect(result.passed).toBe(true);
    expect(result.relativeErrorPercent).toBeLessThan(0.1);
  });

  it('BM-5: 3D Tetrahedral Thermal Load Vector Integration', () => {
    const result = IndependentThermoMechanicalAuditor005.evaluateBM5Tetrahedral3D(
      1.0e-6, 200e9, 0.3, 1.2e-5, 100.0, 600.0
    );

    expect(result.passed).toBe(true);
    expect(result.relativeErrorPercent).toBeLessThan(0.1);
  });

  it('BM-6: Hydrostatic Stress Parameter Sensitivity Derivatives', () => {
    const { dE_Result, dAlpha_Result } = IndependentThermoMechanicalAuditor005.evaluateBM6ParameterSensitivity(
      200e9, 0.3, 1.2e-5, 100.0, -0.003, -5.0e13
    );

    expect(dE_Result.passed).toBe(true);
    expect(dAlpha_Result.passed).toBe(true);
  });

  it('Equilibrium Audit: Residuals and Reaction Force Conservation', () => {
    const audit = IndependentThermoMechanicalAuditor005.auditEquilibriumAndReactions(
      1.0e-11,
      [600000.0, 0.0, 0.0],
      [-600000.0, 0.0, 0.0],
      [0.0, 0.0, 0.0]
    );

    expect(audit.equilibriumSatisfied).toBe(true);
    expect(audit.reactionBalanceSatisfied).toBe(true);
    expect(audit.reactionForceErrorPercent).toBeLessThan(0.01);
  });

  it('Material State Integrity: Thermal Strain Formula and Additive Decomposition', () => {
    const stateAudit = IndependentThermoMechanicalAuditor005.auditMaterialStateIntegrity(
      393.15,
      293.15,
      1.2e-5,
      200e9,
      0.3,
      [0.0012, 0.0012, 0.0012],
      [0.0, 0.0, 0.0],
      [0.0012, 0.0012, 0.0012],
      [0.0, 0.0, 0.0]
    );

    expect(stateAudit.thermalStrainFormulaVerified).toBe(true);
    expect(stateAudit.strainAdditiveDecompositionVerified).toBe(true);
    expect(stateAudit.stressFreeStateZeroStressVerified).toBe(true);
  });

  it('Adversarial Mutation Campaign: 20 Mandatory Mutations Detected', () => {
    const mutations = IndependentThermoMechanicalAuditor005.runAdversarialMutations();

    expect(mutations.length).toBe(20);
    const undetected = mutations.filter(m => !m.detected);
    expect(undetected.length).toBe(0);
  });
});
