/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-327: Thermal CFD Qualification Battery & Anti-Fabrication Suite
 */

import { describe, it, expect } from 'vitest';
import {
  ThermalFlowModel,
  ThermalStateValidator,
  ThermalFailureCode,
  ThermalConductivityModel,
  SpecificHeatModel,
  HeatFluxModel,
  IndependentThermalVerifier,
  EnergyEquationSolver,
  HeatTransferEngine,
  ThermalBCKind,
  ThermalMaterialProperties,
  ThermalBoundaryCondition,
  HardAcceptanceGate066,
  HardAcceptanceGate251
} from '../index';

describe('PATCH-327: Thermal CFD Qualification & Invariant Suite', () => {

  // =========================================================================
  // Case A: 1D Steady Conduction with Exact Analytical Comparison
  // =========================================================================
  it('Case A: 1D Steady Heat Conduction Matches Analytical Solution', () => {
    const N = 50;
    const L = 1.0;
    const k = 0.0262;
    const T_hot = 373.15;
    const T_cold = 293.15;

    const material = new ThermalMaterialProperties({
      thermalConductivity: k,
      density: 1.225,
      specificHeat: 1005.0
    });

    const bcs: ThermalBoundaryCondition[] = [
      { id: 'left', kind: ThermalBCKind.FIXED_TEMPERATURE, value: T_hot, patchId: 'left' },
      { id: 'right', kind: ThermalBCKind.FIXED_TEMPERATURE, value: T_cold, patchId: 'right' }
    ];

    const solution = EnergyEquationSolver.assembleAndSolve(
      N,
      material,
      new Array(N).fill(T_cold),
      bcs,
      new Array(N).fill(0.0),
      new Array(N).fill([0.0, 0.0, 0.0]),
      true,
      0.01,
      T_hot,
      25.0,
      T_cold
    );

    expect(solution.converged).toBe(true);
    expect(solution.temperature.length).toBe(N);

    // Compute cell centroid coordinates x_i = (i + 0.5) * (L / N)
    const dx = L / N;
    const coordsX = Array.from({ length: N }, (_, i) => (i + 0.5) * dx);

    const proof = IndependentThermalVerifier.verify1DAnalyticalConduction(
      L,
      k,
      T_hot,
      T_cold,
      solution.temperature,
      coordsX
    );

    expect(proof.passed).toBe(true);
    expect(proof.maxRelativeError).toBeLessThan(0.01); // Error < 1%
    expect(proof.fluxError).toBeLessThan(0.02); // Flux within 2%
  });

  // =========================================================================
  // Case B: Uniform Volumetric Source Conduction with Parabolic Profile
  // =========================================================================
  it('Case B: Uniform Volumetric Heat Source matches Parabolic Analytical Profile', () => {
    const N = 64;
    const L = 1.0;
    const k = 0.0262;
    const Q_vol = 100.0; // 100 W/m^3
    const T_wall = 300.0;

    const material = new ThermalMaterialProperties({
      thermalConductivity: k,
      density: 1.225,
      specificHeat: 1005.0
    });

    const bcs: ThermalBoundaryCondition[] = [
      { id: 'left', kind: ThermalBCKind.FIXED_TEMPERATURE, value: T_wall, patchId: 'left' },
      { id: 'right', kind: ThermalBCKind.FIXED_TEMPERATURE, value: T_wall, patchId: 'right' }
    ];

    const solution = EnergyEquationSolver.assembleAndSolve(
      N,
      material,
      new Array(N).fill(T_wall),
      bcs,
      new Array(N).fill(Q_vol),
      new Array(N).fill([0.0, 0.0, 0.0]),
      true
    );

    expect(solution.converged).toBe(true);
    expect(solution.maxTemperatureK).toBeGreaterThan(T_wall);

    const dx = L / N;
    const coordsX = Array.from({ length: N }, (_, i) => (i + 0.5) * dx);

    const proof = IndependentThermalVerifier.verifyUniformVolumetricSource(
      L,
      k,
      Q_vol,
      T_wall,
      solution.temperature,
      coordsX
    );

    expect(proof.passed).toBe(true);
    expect(proof.maxRelativeError).toBeLessThan(0.02);
  });

  // =========================================================================
  // Case C: Zero Source Uniform Temperature Field
  // =========================================================================
  it('Case C: Zero Source Uniform Boundary Conditions yields Isothermal Field', () => {
    const N = 32;
    const T_uniform = 350.0;

    const material = new ThermalMaterialProperties();
    const bcs: ThermalBoundaryCondition[] = [
      { id: 'left', kind: ThermalBCKind.FIXED_TEMPERATURE, value: T_uniform, patchId: 'left' },
      { id: 'right', kind: ThermalBCKind.FIXED_TEMPERATURE, value: T_uniform, patchId: 'right' }
    ];

    const solution = EnergyEquationSolver.assembleAndSolve(
      N,
      material,
      new Array(N).fill(T_uniform),
      bcs,
      new Array(N).fill(0.0),
      new Array(N).fill([0.0, 0.0, 0.0]),
      true
    );

    const proof = IndependentThermalVerifier.verifyZeroSourceUniformTemperature(
      T_uniform,
      solution.temperature
    );

    expect(proof.passed).toBe(true);
    expect(proof.maxDeviation).toBeLessThan(1e-4);
  });

  // =========================================================================
  // Case D: Invalid Conductivity Rejection
  // =========================================================================
  it('Case D: Adversarial Rejection of Non-Physical Conductivity', () => {
    const checkNegative = ThermalStateValidator.validate([300.0], [-0.05], [1005.0]);
    expect(checkNegative.valid).toBe(false);
    expect(checkNegative.error).toBe(ThermalFailureCode.INVALID_THERMAL_PROPERTY);

    const checkZero = ThermalStateValidator.validate([300.0], [0.0], [1005.0]);
    expect(checkZero.valid).toBe(false);
    expect(checkZero.error).toBe(ThermalFailureCode.INVALID_THERMAL_PROPERTY);

    const checkNaN = ThermalStateValidator.validate([300.0], [NaN], [1005.0]);
    expect(checkNaN.valid).toBe(false);
    expect(checkNaN.error).toBe(ThermalFailureCode.NAN_DETECTED);

    const checkInf = ThermalStateValidator.validate([300.0], [Infinity], [1005.0]);
    expect(checkInf.valid).toBe(false);
    expect(checkInf.error).toBe(ThermalFailureCode.INFINITY_DETECTED);
  });

  // =========================================================================
  // Case E: Invalid Temperature Rejection (T <= 0 K, NaN, Infinity)
  // =========================================================================
  it('Case E: Adversarial Rejection of Absolute Zero and Non-Finite Temperatures', () => {
    const checkZeroK = ThermalStateValidator.validate([0.0], [0.0262], [1005.0]);
    expect(checkZeroK.valid).toBe(false);
    expect(checkZeroK.error).toBe(ThermalFailureCode.NEGATIVE_TEMPERATURE);

    const checkNegativeK = ThermalStateValidator.validate([-10.0], [0.0262], [1005.0]);
    expect(checkNegativeK.valid).toBe(false);
    expect(checkNegativeK.error).toBe(ThermalFailureCode.NEGATIVE_TEMPERATURE);

    const checkNaN = ThermalStateValidator.validate([NaN], [0.0262], [1005.0]);
    expect(checkNaN.valid).toBe(false);
    expect(checkNaN.error).toBe(ThermalFailureCode.NAN_DETECTED);
  });

  // =========================================================================
  // Case F: Contradictory Boundary Conditions Protection
  // =========================================================================
  it('Case F: Boundary Condition Validator Rejects Invalid Values', () => {
    const checkInvalidBC = ThermalStateValidator.validateBoundaryConditions([
      { kind: ThermalBCKind.FIXED_TEMPERATURE, value: -50.0 }
    ]);
    expect(checkInvalidBC.valid).toBe(false);
    expect(checkInvalidBC.error).toBe(ThermalFailureCode.NEGATIVE_TEMPERATURE);
  });

  // =========================================================================
  // Case G: Determinism & Bit-Exact Reproducibility
  // =========================================================================
  it('Case G: Bit-Exact Deterministic Reproducibility Across Multiple Solves', () => {
    const mat = new ThermalMaterialProperties();
    const bcs: ThermalBoundaryCondition[] = [
      { id: 'left', kind: ThermalBCKind.FIXED_TEMPERATURE, value: 380.0, patchId: 'left' },
      { id: 'right', kind: ThermalBCKind.FIXED_TEMPERATURE, value: 290.0, patchId: 'right' }
    ];

    const run1 = HeatTransferEngine.executePipeline(
      'run-det-1',
      32,
      mat,
      { temperature: 293.15, velocity: [1.0, 0.0, 0.0] },
      bcs,
      new Array(32).fill(50.0)
    );

    const run2 = HeatTransferEngine.executePipeline(
      'run-det-2',
      32,
      mat,
      { temperature: 293.15, velocity: [1.0, 0.0, 0.0] },
      bcs,
      new Array(32).fill(50.0)
    );

    expect(run1.finalFieldHash).toBe(run2.finalFieldHash);
    expect(run1.maxTemperatureK).toBeCloseTo(run2.maxTemperatureK, 8);
    expect(run1.minTemperatureK).toBeCloseTo(run2.minTemperatureK, 8);
  });

  // =========================================================================
  // Case H: Anti-Fabrication Kill Tests
  // =========================================================================
  it('Case H: Independent Verifier Rejects Fabricated Thermal States', () => {
    const model = new ThermalFlowModel();
    const state = model.solveThermal(
      [300.0],
      [0.0],
      [0.0],
      [0.0],
      [1.2],
      [[10.0, 0.0, 0.0]],
      [0.0]
    );

    // Corrupt heat flux artificially to test fabrication detection
    const fakeState = {
      ...state,
      heatFluxX: [9999.0] // Inconsistent with -k * grad(T) = -0.0262 * 10 = -0.262
    };

    const audit = IndependentThermalVerifier.verify(fakeState);
    expect(audit.fourierConsistencyPassed).toBe(false);
    expect(audit.isValid).toBe(false);
  });

  // =========================================================================
  // Case I: CFD Mesh Coupling Sensitivity Proof
  // =========================================================================
  it('Case I: Temperature and Heat Flux Fields Vary with Mesh Geometry & Properties', () => {
    const matA = new ThermalMaterialProperties({ thermalConductivity: 0.0262 });
    const matB = new ThermalMaterialProperties({ thermalConductivity: 200.0 }); // High conductivity (Aluminum)

    const bcs: ThermalBoundaryCondition[] = [
      { id: 'left', kind: ThermalBCKind.FIXED_TEMPERATURE, value: 373.15, patchId: 'left' },
      { id: 'right', kind: ThermalBCKind.CONVECTION, value: 25.0, ambientTemp: 293.15, patchId: 'right' }
    ];

    const solveA = EnergyEquationSolver.assembleAndSolve(32, matA, new Array(32).fill(293.15), bcs, new Array(32).fill(0.0));
    const solveB = EnergyEquationSolver.assembleAndSolve(32, matB, new Array(32).fill(293.15), bcs, new Array(32).fill(0.0));

    // High conductivity material must conduct more heat and have higher outlet temperature
    expect(solveB.temperature[31]).toBeGreaterThan(solveA.temperature[31]);
    expect(solveB.heatFlux[0].magnitude).toBeGreaterThan(solveA.heatFlux[0].magnitude);
  });

  // =========================================================================
  // Case J: Hard Acceptance Gate 066 Execution
  // =========================================================================
  it('Case J: Executes Hard Acceptance Gate 066 with 100% Passing Criteria', async () => {
    const evaluation = await HardAcceptanceGate066.evaluate();
    expect(evaluation.gateId).toBe('HardAcceptanceGate066');
    expect(evaluation.passed).toBe(true);
    expect(evaluation.criteria.heatTransferModelIdentityValid).toBe(true);
    expect(evaluation.criteria.fourierLawImplemented).toBe(true);
    expect(evaluation.criteria.independentVerifierFunctional).toBe(true);
  });

  // =========================================================================
  // Case K: Hard Acceptance Gate 251 Execution
  // =========================================================================
  it('Case K: Executes Hard Acceptance Gate 251 with 12/12 Tests PASS and PROVEN Verdict', () => {
    const report = HardAcceptanceGate251.runSuite();
    expect(report.gateId).toBe('HardAcceptanceGate251');
    expect(report.overallVerdict).toBe('PROVEN');
    expect(report.testsPassed).toBe(12);
    expect(report.testsTotal).toBe(12);
  });
});
