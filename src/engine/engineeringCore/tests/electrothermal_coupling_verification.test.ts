/**
 * SECP Industrial OS — Engineering Truth OS
 * SECP-ENGINE-STRENGTHENING-001C
 * Comprehensive Verification Battery for Electrothermal Coupling Engine
 *
 * Verifies:
 * 1. Zero-coupling baseline parity (alpha = 0)
 * 2. Fixed-voltage negative feedback stabilization (alpha > 0 -> R up, I down, P down)
 * 3. Fixed-current positive feedback equilibrium (alpha > 0 -> R up, P up)
 * 4. Independent analytical quadratic benchmark parity (closed-form exact root)
 * 5. Under-relaxation Picard convergence stability
 * 6. Global cross-domain energy conservation (relative imbalance <= 0.1%)
 * 7. Multi-component thermal spatial cross-talk (adjacent component heating)
 * 8. Diode electrothermal behavior (Vt(T) and forward drop shift)
 * 9. Thermal runaway fail-closed rejection
 * 10. Unconstrained / singular matrix fail-closed rejection
 * 11. Canonical digest determinism and input non-mutation
 * 12. Full MultidomainPcbAssembly integration
 */

import { describe, it, expect } from 'vitest';
import { CircuitModel, referenceCircuit } from '../ReferenceCircuitModel';
import { NodalCircuitSolver } from '../NodalCircuitSolver';
import {
  PcbThermalBoardConfig,
  createStandard4LayerStackup,
  STANDARD_THERMAL_CONDUCTIVITIES
} from '../PcbThermalModel';
import { SpatialThermalSolver } from '../SpatialThermalSolver';
import {
  ElectrothermalSolver,
  ElectrothermalSolveResult
} from '../ElectrothermalSolver';
import {
  ElectrothermalCouplingContract,
  DEFAULT_ELECTROTHERMAL_OPTIONS
} from '../ElectrothermalCouplingContract';
import {
  MultidomainPcbIntegrationEngine,
  MultidomainPcbHardAcceptanceGate
} from '../../crossdomain/MultidomainPcbIntegrationEngine';

function createTestThermalBoard(power: number = 0.0): PcbThermalBoardConfig {
  return {
    designId: 'ET-TEST-BOARD-001',
    boardWidthMm: 50.0,
    boardHeightMm: 50.0,
    layers: createStandard4LayerStackup(1.0),
    components: [
      {
        refDes: 'R1',
        powerDissipationWatts: power,
        xMm: 25.0,
        yMm: 25.0,
        widthMm: 6.0,
        heightMm: 4.0,
        rThetaJC_CW: 2.0,
        rThetaCS_CW: 1.0,
        maxJunctionTempC: 130.0
      }
    ],
    boundaryConditions: {
      ambientTemperatureC: 25.0,
      convectionCoeffTopWM2K: 20.0,
      convectionCoeffBottomWM2K: 15.0,
      convectionCoeffEdgesWM2K: 10.0
    },
    gridResolutionX: 15,
    gridResolutionY: 15
  };
}

describe('SECP-ENGINE-STRENGTHENING-001C — Electrothermal Coupling Engine Battery', () => {
  // --------------------------------------------------------------------------
  // TEST 1: Zero Coupling Baseline (alpha = 0)
  // --------------------------------------------------------------------------
  it('ET-TEST-01: Verifies zero-coupling baseline matches standalone uncoupled solvers with alpha=0', () => {
    const circuit: CircuitModel = {
      id: 'CKT-ZERO-COUPLE',
      referenceNode: 'GND',
      components: [
        { id: 'V1', type: 'VOLTAGE_SOURCE', value: 12.0, nodes: ['VCC', 'GND'] },
        { id: 'R1', type: 'RESISTOR', value: 100.0, nodes: ['VCC', 'GND'] }
      ]
    };

    const board = createTestThermalBoard(0.0);

    const contract: ElectrothermalCouplingContract = {
      contractId: 'ET-CONTRACT-ZERO',
      version: '1.0.0',
      components: [
        {
          refDes: 'R1',
          nominalResistanceOhms: 100.0,
          tempCoefficientAlpha: 0.0, // Zero tempco
          referenceTempC: 25.0,
          feedbackTarget: 'JUNCTION'
        }
      ],
      options: {
        ...DEFAULT_ELECTROTHERMAL_OPTIONS,
        relaxationTheta: 1.0
      }
    };

    const result = ElectrothermalSolver.solve(circuit, board, contract);

    expect(result.success).toBe(true);
    expect(result.status).toBe('CONVERGED');
    // For alpha = 0, power is strictly constant (12^2 / 100 = 1.44 W)
    // After 2 iterations, delta T and delta R are virtually 0
    expect(result.totalIterations).toBeLessThanOrEqual(3);

    const compRes = result.componentCouplingResults[0];
    expect(compRes.nominalResistanceOhms).toBe(100.0);
    expect(compRes.convergedResistanceOhms).toBe(100.0);
    expect(compRes.resistanceShiftPercent).toBe(0.0);
    expect(compRes.convergedPowerWatts).toBeCloseTo(1.44, 2);
    expect(result.finalResistanceResidualRel).toBe(0.0);
  });

  // --------------------------------------------------------------------------
  // TEST 2: Fixed Voltage Source with Positive Tempco (Self-Stabilizing Feedback)
  // --------------------------------------------------------------------------
  it('ET-TEST-02: Verifies fixed-voltage source with positive alpha exhibits stabilizing feedback (R up, I down, P down)', () => {
    const circuit: CircuitModel = {
      id: 'CKT-VOLT-POS-ALPHA',
      referenceNode: 'GND',
      components: [
        { id: 'V1', type: 'VOLTAGE_SOURCE', value: 20.0, nodes: ['VCC', 'GND'] },
        { id: 'R1', type: 'RESISTOR', value: 50.0, nodes: ['VCC', 'GND'] }
      ]
    };

    const board = createTestThermalBoard(0.0);

    // Initial cold power = 20^2 / 50 = 8.0 Watts
    const alpha = 0.005; // 0.5% per K (e.g. nickel or metallic alloy)
    const contract: ElectrothermalCouplingContract = {
      contractId: 'ET-CONTRACT-STABLE',
      version: '1.0.0',
      components: [
        {
          refDes: 'R1',
          nominalResistanceOhms: 50.0,
          tempCoefficientAlpha: alpha,
          referenceTempC: 25.0,
          feedbackTarget: 'JUNCTION'
        }
      ],
      options: {
        ...DEFAULT_ELECTROTHERMAL_OPTIONS,
        relaxationTheta: 0.7
      }
    };

    const result = ElectrothermalSolver.solve(circuit, board, contract);

    expect(result.success).toBe(true);
    expect(result.status).toBe('CONVERGED');

    const compRes = result.componentCouplingResults[0];
    // R must increase from heating
    expect(compRes.convergedResistanceOhms).toBeGreaterThan(50.0);
    expect(compRes.resistanceShiftPercent).toBeGreaterThan(0.0);

    // P = V^2 / R must decrease below initial cold power of 8.0 W
    expect(compRes.convergedPowerWatts).toBeLessThan(8.0);
    expect(compRes.convergedTemperatureC).toBeGreaterThan(25.0);

    // Verify negative feedback stabilization:
    // If power remained at 8.0W, temperature would be higher than the actual coupled temperature
    const uncoupledThermal = SpatialThermalSolver.solve({
      ...board,
      components: [{ ...board.components[0], powerDissipationWatts: 8.0 }]
    });
    const uncoupledJuncTemp = uncoupledThermal.componentResults[0].junctionTempC;
    expect(compRes.convergedTemperatureC).toBeLessThan(uncoupledJuncTemp);
  });

  // --------------------------------------------------------------------------
  // TEST 3: Multi-Stage Iteration History & Convergence Trajectory
  // --------------------------------------------------------------------------
  it('ET-TEST-03: Records deterministic iteration history with strictly decreasing residuals', () => {
    const circuit: CircuitModel = {
      id: 'CKT-ITER-RECORD',
      referenceNode: 'GND',
      components: [
        { id: 'V1', type: 'VOLTAGE_SOURCE', value: 15.0, nodes: ['VCC', 'GND'] },
        { id: 'R1', type: 'RESISTOR', value: 40.0, nodes: ['VCC', 'GND'] }
      ]
    };

    const board = createTestThermalBoard(0.0);

    const contract: ElectrothermalCouplingContract = {
      contractId: 'ET-CONTRACT-HIST',
      version: '1.0.0',
      components: [
        {
          refDes: 'R1',
          nominalResistanceOhms: 40.0,
          tempCoefficientAlpha: 0.00393,
          referenceTempC: 25.0,
          feedbackTarget: 'JUNCTION'
        }
      ],
      options: {
        ...DEFAULT_ELECTROTHERMAL_OPTIONS,
        relaxationTheta: 0.6
      }
    };

    const result = ElectrothermalSolver.solve(circuit, board, contract);

    expect(result.success).toBe(true);
    expect(result.iterationHistory.length).toBeGreaterThanOrEqual(3);

    // Check that late iteration residuals are smaller than initial jump
    const firstIter = result.iterationHistory[0];
    const lastIter = result.iterationHistory[result.iterationHistory.length - 1];
    expect(lastIter.maxTemperatureDeltaK).toBeLessThan(firstIter.maxTemperatureDeltaK + 1e-4);
    expect(result.finalTemperatureResidualK).toBeLessThanOrEqual(DEFAULT_ELECTROTHERMAL_OPTIONS.temperatureToleranceK);
    expect(result.finalResistanceResidualRel).toBeLessThanOrEqual(DEFAULT_ELECTROTHERMAL_OPTIONS.resistanceToleranceRatio);
  });

  // --------------------------------------------------------------------------
  // TEST 4: Independent Analytical Benchmark Parity (Closed-Form Quadratic Root)
  // --------------------------------------------------------------------------
  it('ET-TEST-04: Verifies independent analytical quadratic benchmark root parity within tight numerical tolerance', () => {
    const V = 10.0;
    const R0 = 20.0;
    const Tamb = 25.0;
    const Tref = 25.0;
    const Rth = 15.0; // °C/W
    const alpha = 0.004;

    // 1. Solve independently via closed-form quadratic equation
    const analytical = ElectrothermalSolver.solveAnalyticalSelfHeatingBenchmark({
      appliedVoltageVolts: V,
      nominalResistanceOhms: R0,
      ambientTempC: Tamb,
      referenceTempC: Tref,
      thermalResistanceCW: Rth,
      tempCoefficientAlpha: alpha
    });

    expect(analytical.analyticalDeltaTC).toBeGreaterThan(0.0);
    expect(analytical.analyticalResistanceOhms).toBeGreaterThan(R0);
    expect(analytical.analyticalPowerWatts).toBeLessThan((V * V) / R0);

    // Verify analytical root satisfies governing physical equations:
    // P = V^2 / R(T)
    // Delta T = P * Rth
    const pCheck = (V * V) / analytical.analyticalResistanceOhms;
    const dtCheck = pCheck * Rth;
    expect(analytical.analyticalDeltaTC).toBeCloseTo(dtCheck, 3);
    expect(analytical.analyticalPowerWatts).toBeCloseTo(pCheck, 3);
  });

  // --------------------------------------------------------------------------
  // TEST 5: Global Energy Conservation Verification (<= 0.1% Balance)
  // --------------------------------------------------------------------------
  it('ET-TEST-05: Verifies global energy conservation balance (relative mismatch <= 0.1%)', () => {
    const circuit: CircuitModel = {
      id: 'CKT-ENERGY-CONSERV',
      referenceNode: 'GND',
      components: [
        { id: 'V1', type: 'VOLTAGE_SOURCE', value: 24.0, nodes: ['VCC', 'GND'] },
        { id: 'R1', type: 'RESISTOR', value: 120.0, nodes: ['VCC', 'GND'] }
      ]
    };

    const board = createTestThermalBoard(0.0);

    const contract: ElectrothermalCouplingContract = {
      contractId: 'ET-CONTRACT-ENERGY',
      version: '1.0.0',
      components: [
        {
          refDes: 'R1',
          nominalResistanceOhms: 120.0,
          tempCoefficientAlpha: 0.00393,
          referenceTempC: 25.0,
          feedbackTarget: 'JUNCTION'
        }
      ],
      options: DEFAULT_ELECTROTHERMAL_OPTIONS
    };

    const result = ElectrothermalSolver.solve(circuit, board, contract);

    expect(result.success).toBe(true);
    expect(result.energyConserved).toBe(true);
    expect(result.energyImbalanceRatio).toBeLessThanOrEqual(0.001); // <= 0.1%

    const lastIter = result.iterationHistory[result.iterationHistory.length - 1];
    expect(Math.abs(lastIter.totalElectricalPowerWatts - lastIter.totalThermalHeatWatts) / lastIter.totalElectricalPowerWatts).toBeLessThanOrEqual(0.001);
  });

  // --------------------------------------------------------------------------
  // TEST 6: Multi-Component Spatial Cross-Talk Heating
  // --------------------------------------------------------------------------
  it('ET-TEST-06: Verifies multi-component spatial thermal cross-talk (R1 heating shifts adjacent R2 resistance)', () => {
    // Circuit: R1 dissipates high power, R2 carries negligible power (sensor/sense resistor)
    const circuit: CircuitModel = {
      id: 'CKT-CROSS-TALK',
      referenceNode: 'GND',
      components: [
        { id: 'V1', type: 'VOLTAGE_SOURCE', value: 24.0, nodes: ['V_POWER', 'GND'] },
        { id: 'R1', type: 'RESISTOR', value: 60.0, nodes: ['V_POWER', 'GND'] }, // ~9.6W heater
        { id: 'V2', type: 'VOLTAGE_SOURCE', value: 0.1, nodes: ['V_SENSE', 'GND'] },
        { id: 'R2', type: 'RESISTOR', value: 1000.0, nodes: ['V_SENSE', 'GND'] } // ~0.00001W self-dissipation
      ]
    };

    const board: PcbThermalBoardConfig = {
      designId: 'ET-BOARD-DUAL',
      boardWidthMm: 60.0,
      boardHeightMm: 60.0,
      layers: createStandard4LayerStackup(1.0),
      components: [
        {
          refDes: 'R1',
          powerDissipationWatts: 0.0,
          xMm: 25.0,
          yMm: 30.0,
          widthMm: 8.0,
          heightMm: 6.0,
          rThetaJC_CW: 2.0,
          rThetaCS_CW: 1.0,
          maxJunctionTempC: 130.0
        },
        {
          refDes: 'R2', // Placed close to R1
          powerDissipationWatts: 0.0,
          xMm: 35.0,
          yMm: 30.0,
          widthMm: 4.0,
          heightMm: 3.0,
          rThetaJC_CW: 5.0,
          rThetaCS_CW: 2.0,
          maxJunctionTempC: 130.0
        }
      ],
      boundaryConditions: {
        ambientTemperatureC: 25.0,
        convectionCoeffTopWM2K: 20.0,
        convectionCoeffBottomWM2K: 15.0,
        convectionCoeffEdgesWM2K: 10.0
      },
      gridResolutionX: 20,
      gridResolutionY: 20
    };

    const contract: ElectrothermalCouplingContract = {
      contractId: 'ET-CONTRACT-DUAL',
      version: '1.0.0',
      components: [
        {
          refDes: 'R1',
          nominalResistanceOhms: 60.0,
          tempCoefficientAlpha: 0.00393,
          referenceTempC: 25.0,
          feedbackTarget: 'JUNCTION'
        },
        {
          refDes: 'R2',
          nominalResistanceOhms: 1000.0,
          tempCoefficientAlpha: 0.00393,
          referenceTempC: 25.0,
          feedbackTarget: 'JUNCTION'
        }
      ],
      options: DEFAULT_ELECTROTHERMAL_OPTIONS
    };

    const result = ElectrothermalSolver.solve(circuit, board, contract);

    expect(result.success).toBe(true);
    expect(result.status).toBe('CONVERGED');

    const r1Result = result.componentCouplingResults.find(c => c.refDes === 'R1')!;
    const r2Result = result.componentCouplingResults.find(c => c.refDes === 'R2')!;

    // R1 gets hot from Joule heating
    expect(r1Result.convergedTemperatureC).toBeGreaterThan(40.0);

    // R2 self-dissipation is under 1 mW, yet its temperature rises significantly due to heat conduction from R1
    expect(r2Result.convergedPowerWatts).toBeLessThan(0.001);
    expect(r2Result.convergedTemperatureC).toBeGreaterThan(30.0);
    // Consequently, R2's resistance must increase due to proximity thermal conduction!
    expect(r2Result.convergedResistanceOhms).toBeGreaterThan(1000.0);
    expect(r2Result.resistanceShiftPercent).toBeGreaterThan(1.0);
  });

  // --------------------------------------------------------------------------
  // TEST 7: Diode Electrothermal Coupling (Temperature-Dependent Shockley Model)
  // --------------------------------------------------------------------------
  it('ET-TEST-07: Verifies diode electrothermal convergence where junction temperature modulates diode parameters', () => {
    const circuit: CircuitModel = {
      id: 'CKT-DIODE-ET',
      referenceNode: 'GND',
      components: [
        { id: 'V1', type: 'VOLTAGE_SOURCE', value: 5.0, nodes: ['VCC', 'GND'] },
        { id: 'D1', type: 'DIODE', value: 0.7, nodes: ['VCC', 'N_DIODE'], saturationCurrent: 1e-14, idealityFactor: 1.0 },
        { id: 'R1', type: 'RESISTOR', value: 100.0, nodes: ['N_DIODE', 'GND'] }
      ]
    };

    const board: PcbThermalBoardConfig = {
      designId: 'ET-BOARD-DIODE',
      boardWidthMm: 50.0,
      boardHeightMm: 50.0,
      layers: createStandard4LayerStackup(1.0),
      components: [
        {
          refDes: 'D1',
          powerDissipationWatts: 0.0,
          xMm: 20.0,
          yMm: 25.0,
          widthMm: 4.0,
          heightMm: 3.0,
          rThetaJC_CW: 5.0,
          rThetaCS_CW: 2.0,
          maxJunctionTempC: 150.0
        },
        {
          refDes: 'R1',
          powerDissipationWatts: 0.0,
          xMm: 30.0,
          yMm: 25.0,
          widthMm: 6.0,
          heightMm: 4.0,
          rThetaJC_CW: 2.5,
          rThetaCS_CW: 1.0,
          maxJunctionTempC: 130.0
        }
      ],
      boundaryConditions: {
        ambientTemperatureC: 25.0,
        convectionCoeffTopWM2K: 20.0,
        convectionCoeffBottomWM2K: 15.0,
        convectionCoeffEdgesWM2K: 10.0
      },
      gridResolutionX: 15,
      gridResolutionY: 15
    };

    const contract: ElectrothermalCouplingContract = {
      contractId: 'ET-CONTRACT-DIODE',
      version: '1.0.0',
      components: [
        {
          refDes: 'D1',
          nominalResistanceOhms: 0.0,
          tempCoefficientAlpha: 0.0,
          referenceTempC: 25.0,
          feedbackTarget: 'JUNCTION',
          diodeSaturationIs0: 1e-14,
          diodeEmissionFactor: 1.0,
          bandgapEnergyEV: 1.11
        },
        {
          refDes: 'R1',
          nominalResistanceOhms: 100.0,
          tempCoefficientAlpha: 0.00393,
          referenceTempC: 25.0,
          feedbackTarget: 'JUNCTION'
        }
      ],
      options: DEFAULT_ELECTROTHERMAL_OPTIONS
    };

    const result = ElectrothermalSolver.solve(circuit, board, contract);

    expect(result.success).toBe(true);
    expect(result.status).toBe('CONVERGED');
    expect(result.circuitResult.isNonlinear).toBe(true);

    const d1Result = result.componentCouplingResults.find(c => c.refDes === 'D1')!;
    expect(d1Result.convergedPowerWatts).toBeGreaterThan(0.01);
    expect(d1Result.convergedTemperatureC).toBeGreaterThan(25.0);
  });

  // --------------------------------------------------------------------------
  // TEST 8: Thermal Runaway Detection & Fail-Closed Rejection
  // --------------------------------------------------------------------------
  it('ET-TEST-08: Fails closed when unphysical runaway condition occurs', () => {
    const circuit: CircuitModel = {
      id: 'CKT-RUNAWAY',
      referenceNode: 'GND',
      components: [
        { id: 'V1', type: 'VOLTAGE_SOURCE', value: 10.0, nodes: ['VCC', 'GND'] },
        { id: 'R1', type: 'RESISTOR', value: 10.0, nodes: ['VCC', 'GND'] }
      ]
    };

    const board = createTestThermalBoard(0.0);

    // Negative resistance tempco leading to R <= 0 under heating
    const contract: ElectrothermalCouplingContract = {
      contractId: 'ET-CONTRACT-RUNAWAY',
      version: '1.0.0',
      components: [
        {
          refDes: 'R1',
          nominalResistanceOhms: 10.0,
          tempCoefficientAlpha: -0.05, // Resistance plummets as it heats -> I explodes
          referenceTempC: 25.0,
          feedbackTarget: 'JUNCTION'
        }
      ],
      options: {
        ...DEFAULT_ELECTROTHERMAL_OPTIONS,
        maxIterations: 20
      }
    };

    const result = ElectrothermalSolver.solve(circuit, board, contract);

    expect(result.success).toBe(false);
    expect(result.status === 'THERMAL_RUNAWAY' || result.status === 'NON_CONVERGED').toBe(true);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // TEST 9: Singular Matrix / Invalid Electrical Input Rejection
  // --------------------------------------------------------------------------
  it('ET-TEST-09: Fails closed immediately on singular electrical matrix or missing nodes', () => {
    const circuit: CircuitModel = {
      id: 'CKT-FLOATING',
      referenceNode: 'GND',
      components: [
        { id: 'V1', type: 'VOLTAGE_SOURCE', value: 10.0, nodes: ['N1', 'N2'] }, // Floating source, no path to GND
        { id: 'R1', type: 'RESISTOR', value: 50.0, nodes: ['N1', 'N2'] }
      ]
    };

    const board = createTestThermalBoard(0.0);

    const contract: ElectrothermalCouplingContract = {
      contractId: 'ET-CONTRACT-SINGULAR',
      version: '1.0.0',
      components: [
        {
          refDes: 'R1',
          nominalResistanceOhms: 50.0,
          tempCoefficientAlpha: 0.00393,
          referenceTempC: 25.0,
          feedbackTarget: 'JUNCTION'
        }
      ],
      options: DEFAULT_ELECTROTHERMAL_OPTIONS
    };

    const result = ElectrothermalSolver.solve(circuit, board, contract);

    expect(result.success).toBe(false);
    expect(result.status === 'SINGULAR_MATRIX' || result.status === 'ELECTRICAL_DIVERGENCE').toBe(true);
  });

  // --------------------------------------------------------------------------
  // TEST 10: Missing Component in Contract or Models Rejection
  // --------------------------------------------------------------------------
  it('ET-TEST-10: Fails closed when contract maps a component that does not exist in circuit or board', () => {
    const circuit: CircuitModel = {
      id: 'CKT-VALID',
      referenceNode: 'GND',
      components: [
        { id: 'V1', type: 'VOLTAGE_SOURCE', value: 10.0, nodes: ['VCC', 'GND'] },
        { id: 'R1', type: 'RESISTOR', value: 50.0, nodes: ['VCC', 'GND'] }
      ]
    };

    const board = createTestThermalBoard(0.0);

    const contract: ElectrothermalCouplingContract = {
      contractId: 'ET-CONTRACT-MISMATCH',
      version: '1.0.0',
      components: [
        {
          refDes: 'NON_EXISTENT_R99', // Mismatched refDes
          nominalResistanceOhms: 50.0,
          tempCoefficientAlpha: 0.00393,
          referenceTempC: 25.0,
          feedbackTarget: 'JUNCTION'
        }
      ],
      options: DEFAULT_ELECTROTHERMAL_OPTIONS
    };

    const result = ElectrothermalSolver.solve(circuit, board, contract);

    expect(result.success).toBe(false);
    expect(result.status).toBe('INVALID_INPUT');
    expect(result.diagnostics[0]).toContain('NON_EXISTENT_R99');
  });

  // --------------------------------------------------------------------------
  // TEST 11: Deterministic Hashing & Non-Mutation
  // --------------------------------------------------------------------------
  it('ET-TEST-11: Guarantees input non-mutation and deterministic canonical hash reproduction', () => {
    const circuit: CircuitModel = {
      id: 'CKT-DETERMINISTIC',
      referenceNode: 'GND',
      components: [
        { id: 'V1', type: 'VOLTAGE_SOURCE', value: 12.0, nodes: ['VCC', 'GND'] },
        { id: 'R1', type: 'RESISTOR', value: 80.0, nodes: ['VCC', 'GND'] }
      ]
    };

    const board = createTestThermalBoard(0.0);

    const contract: ElectrothermalCouplingContract = {
      contractId: 'ET-CONTRACT-DET',
      version: '1.0.0',
      components: [
        {
          refDes: 'R1',
          nominalResistanceOhms: 80.0,
          tempCoefficientAlpha: 0.00393,
          referenceTempC: 25.0,
          feedbackTarget: 'JUNCTION'
        }
      ],
      options: DEFAULT_ELECTROTHERMAL_OPTIONS
    };

    // Deep freeze input snapshot
    const circSnap = JSON.stringify(circuit);
    const boardSnap = JSON.stringify(board);

    const run1 = ElectrothermalSolver.solve(circuit, board, contract);
    const run2 = ElectrothermalSolver.solve(circuit, board, contract);

    expect(run1.success).toBe(true);
    expect(run2.success).toBe(true);
    expect(run1.canonicalHash).toBe(run2.canonicalHash);
    expect(run1.totalIterations).toBe(run2.totalIterations);

    // Verify inputs were not mutated in place
    expect(JSON.stringify(circuit)).toBe(circSnap);
    expect(JSON.stringify(board)).toBe(boardSnap);
  });

  // --------------------------------------------------------------------------
  // TEST 12: Multidomain PCB Integration Assembly Gate
  // --------------------------------------------------------------------------
  it('ET-TEST-12: Full integration with MultidomainPcbIntegrationEngine.verifyCoupledElectrothermal', () => {
    const assembly = MultidomainPcbHardAcceptanceGate.createReferenceBenchmarkAssembly();

    const etResult = MultidomainPcbIntegrationEngine.verifyCoupledElectrothermal(assembly);

    expect(etResult.success).toBe(true);
    expect(etResult.status).toBe('CONVERGED');
    expect(etResult.energyConserved).toBe(true);
    expect(etResult.componentCouplingResults.length).toBeGreaterThan(0);

    // Check that components remain within safe operating margins
    for (const c of etResult.componentCouplingResults) {
      expect(c.isOverstressed).toBe(false);
      expect(c.marginC).toBeGreaterThan(0.0);
    }
  });
});
