/**
 * SECP Engineering Truth OS — Spatial Multilayer PCB Thermal Solver Verification Battery
 * Verification Gates T1 through T9:
 * - Multilayer anisotropic effective conductivity
 * - Analytical 1D slab Fourier solution validation
 * - Grid refinement convergence
 * - First law energy balance conservation
 * - Component package junction-case-board hierarchy
 * - Copper weight heat spreading sensitivity
 * - Unconstrained domain failure-closed behavior
 * - Adversarial input and singular matrix rejection
 * - Cryptographic canonical hashing and invalidation
 * - Multi-component thermal cross-talk
 * - Full ECAD PcbCanonicalModel integration
 */

import { describe, expect, it } from 'vitest';
import {
  SpatialThermalSolver,
  SpatialThermalFieldResult
} from '../SpatialThermalSolver';
import {
  PcbThermalBoardConfig,
  PcbStackupLayer,
  createStandard4LayerStackup,
  computePcbThermalCanonicalHash,
  STANDARD_THERMAL_CONDUCTIVITIES
} from '../PcbThermalModel';
import { ThermodynamicsEngine } from '../thermodynamics';
import { PcbCanonicalModel } from '../../pcb/PcbCanonicalModel';
import { PcbThermalBridge } from '../../pcb/PcbThermalBridge';

describe('SECP-ENGINE-STRENGTHENING-001B: Spatial Multilayer PCB Thermal Engine', () => {

  // Test 1: Multilayer Effective Conductivity
  it('T1: Calculates exact anisotropic effective conductivity for multilayer PCB stackup', () => {
    const layers: PcbStackupLayer[] = [
      { id: 'TOP', name: 'Top Cu', material: 'COPPER', thicknessMm: 0.035, thermalConductivityWMK: 390, copperCoverageRatio: 0.5, layerType: 'SIGNAL' },
      { id: 'CORE', name: 'FR4 Core', material: 'FR4', thicknessMm: 1.5, thermalConductivityWMK: 0.3, copperCoverageRatio: 0.0, layerType: 'CORE' },
      { id: 'BOT', name: 'Bot Cu', material: 'COPPER', thicknessMm: 0.035, thermalConductivityWMK: 390, copperCoverageRatio: 0.5, layerType: 'SIGNAL' }
    ];

    const result = SpatialThermalSolver.calculateEffectiveConductivity(layers);

    expect(result.totalThicknessMm).toBeCloseTo(1.57, 4);

    // In-plane: parallel weighted average
    // Top & Bot: 0.5 * 390 + 0.5 * 0.3 = 195.15 W/mK
    // Core: 0.3 W/mK
    // Weighted = (195.15 * 0.035 * 2 + 0.3 * 1.5) / 1.57 = (13.6605 + 0.45) / 1.57 = 9.0 approx
    expect(result.inPlaneConductivityWMK).toBeGreaterThan(8.5);
    expect(result.inPlaneConductivityWMK).toBeLessThan(9.5);

    // Through-plane: series harmonic average dominated by 1.5mm FR4
    expect(result.throughPlaneConductivityWMK).toBeGreaterThan(0.29);
    expect(result.throughPlaneConductivityWMK).toBeLessThan(0.35);
  });

  // Test 2: Analytical 1D Slab Benchmark
  it('T2: Verifies spatial solver against exact 1D Fourier conduction analytical solution', () => {
    // 1D slab: L = 100mm, W = 10mm, t = 1mm
    // k = 50 W/mK (isotropic metal bar)
    // Q = 2.0 W applied at x=0
    // Cold boundary: T = 20°C at x=L
    // All other surfaces adiabatic (h=0)
    const L = 0.1; // meters
    const W = 0.01;
    const t = 0.001;
    const k = 50.0;
    const Q = 2.0;
    const T_cold = 20.0;

    // Analytical Delta T = Q * L / (k * A)
    const A = W * t; // 1e-5 m2
    const analyticalDeltaT = (Q * L) / (k * A); // (2.0 * 0.1) / (50 * 1e-5) = 0.2 / 5e-4 = 400°C
    const analyticalT_hot = T_cold + analyticalDeltaT; // 420°C

    const config: PcbThermalBoardConfig = {
      boardWidthMm: 100, // along X
      boardHeightMm: 10, // along Y
      layers: [
        { id: 'BAR', name: 'Bar', material: 'CUSTOM', thicknessMm: 1.0, thermalConductivityWMK: k, copperCoverageRatio: 1.0, layerType: 'CORE' }
      ],
      components: [
        // Heat source concentrated at x=0
        { refDes: 'HEAT_SRC', powerDissipationWatts: Q, xMm: 2.5, yMm: 5.0, widthMm: 5.0, heightMm: 10.0 }
      ],
      boundaryConditions: {
        ambientTemperatureC: T_cold,
        convectionCoeffTopWM2K: 0.0,
        convectionCoeffBottomWM2K: 0.0,
        convectionCoeffEdgesWM2K: 0.0,
        prescribedBoundaries: [
          // Cold Dirichlet sink at x=100
          { id: 'COLD_END', xMm: 98, yMm: 5.0, temperatureC: T_cold, contactResistanceCW: 0.0 }
        ]
      },
      gridResolutionX: 20,
      gridResolutionY: 2
    };

    const solution = SpatialThermalSolver.solve(config);

    expect(solution.verdict).toBe('VERIFIED_WITHIN_DECLARED_SCOPE');
    expect(solution.minTemperatureC).toBeCloseTo(T_cold, 0);

    // Numerical T at x=0 should be within 5% of analytical 1D prediction (due to discrete cell center offset)
    const numericalT_hot = solution.maxTemperatureC;
    const relativeError = Math.abs(numericalT_hot - analyticalT_hot) / analyticalT_hot;
    expect(relativeError).toBeLessThan(0.05);
  });

  // Test 3: Grid Refinement Convergence
  it('T3: Demonstrates grid refinement spatial convergence across resolution levels', () => {
    const resolutions = [10, 20, 40];
    const maxTemps: number[] = [];

    for (const nx of resolutions) {
      const config: PcbThermalBoardConfig = {
        boardWidthMm: 50,
        boardHeightMm: 50,
        layers: createStandard4LayerStackup(1.0),
        components: [
          { refDes: 'U1', powerDissipationWatts: 3.0, xMm: 25, yMm: 25, widthMm: 10, heightMm: 10 }
        ],
        boundaryConditions: {
          ambientTemperatureC: 25.0,
          convectionCoeffTopWM2K: 15.0,
          convectionCoeffBottomWM2K: 10.0,
          convectionCoeffEdgesWM2K: 5.0
        },
        gridResolutionX: nx,
        gridResolutionY: nx
      };

      const sol = SpatialThermalSolver.solve(config);
      expect(sol.verdict).toBe('VERIFIED_WITHIN_DECLARED_SCOPE');
      maxTemps.push(sol.maxTemperatureC);
    }

    // Difference between 20x20 and 40x40 must be smaller than difference between 10x10 and 20x20 (converging)
    const diff1 = Math.abs(maxTemps[1] - maxTemps[0]);
    const diff2 = Math.abs(maxTemps[2] - maxTemps[1]);
    expect(diff2).toBeLessThanOrEqual(diff1 + 0.1);
  });

  // Test 4: First Law Energy Balance
  it('T4: Enforces strict First Law of Thermodynamics energy balance (< 0.1% error)', () => {
    const config: PcbThermalBoardConfig = {
      boardWidthMm: 80,
      boardHeightMm: 60,
      layers: createStandard4LayerStackup(1.0),
      components: [
        { refDes: 'U1_MCU', powerDissipationWatts: 2.5, xMm: 30, yMm: 30, widthMm: 12, heightMm: 12 },
        { refDes: 'U2_REG', powerDissipationWatts: 1.8, xMm: 60, yMm: 45, widthMm: 8, heightMm: 8 }
      ],
      boundaryConditions: {
        ambientTemperatureC: 30.0,
        convectionCoeffTopWM2K: 20.0,
        convectionCoeffBottomWM2K: 12.0,
        convectionCoeffEdgesWM2K: 8.0,
        prescribedBoundaries: [
          { id: 'CHASSIS_MOUNT', xMm: 10, yMm: 10, temperatureC: 30.0, contactResistanceCW: 2.0 }
        ]
      },
      gridResolutionX: 20,
      gridResolutionY: 20
    };

    const sol = SpatialThermalSolver.solve(config);

    expect(sol.verdict).toBe('VERIFIED_WITHIN_DECLARED_SCOPE');
    expect(sol.energyBalance.isConserved).toBe(true);
    expect(sol.energyBalance.totalHeatGeneratedWatts).toBeCloseTo(4.3, 4);
    expect(sol.energyBalance.relativeImbalanceRatio).toBeLessThan(1e-3);
  });

  // Test 5: Component Package Thermal Hierarchy
  it('T5: Validates Junction-Case-Board thermal hierarchy and overstress alerting', () => {
    const config: PcbThermalBoardConfig = {
      boardWidthMm: 50,
      boardHeightMm: 50,
      layers: createStandard4LayerStackup(1.0),
      components: [
        {
          refDes: 'HOT_AMP',
          powerDissipationWatts: 8.0,
          xMm: 25,
          yMm: 25,
          widthMm: 10,
          heightMm: 10,
          rThetaCS_CW: 1.5,
          rThetaJC_CW: 4.0,
          maxJunctionTempC: 125.0
        }
      ],
      boundaryConditions: {
        ambientTemperatureC: 25.0,
        convectionCoeffTopWM2K: 10.0,
        convectionCoeffBottomWM2K: 5.0
      },
      gridResolutionX: 16,
      gridResolutionY: 16
    };

    const sol = SpatialThermalSolver.solve(config);
    expect(sol.componentResults.length).toBe(1);

    const comp = sol.componentResults[0];
    expect(comp.caseTempC).toBeCloseTo(comp.boardTempC + 8.0 * 1.5, 2);
    expect(comp.junctionTempC).toBeCloseTo(comp.caseTempC + 8.0 * 4.0, 2);
    expect(comp.junctionTempC).toBeGreaterThan(comp.caseTempC);
    expect(comp.caseTempC).toBeGreaterThan(comp.boardTempC);

    // Hot amplifier with 8W should trip overstress or high junction temp
    if (comp.junctionTempC > 125.0) {
      expect(comp.isOverstressed).toBe(true);
      expect(comp.marginC).toBeLessThan(0);
    }
  });

  // Test 6: Copper Weight Heat Spreading Sensitivity (1oz vs 2oz)
  it('T6: Verifies 2oz copper plane provides superior heat spreading over 1oz', () => {
    const baseConfig = (copperOz: number): PcbThermalBoardConfig => ({
      boardWidthMm: 60,
      boardHeightMm: 60,
      layers: createStandard4LayerStackup(copperOz),
      components: [
        { refDes: 'U_PWR', powerDissipationWatts: 4.0, xMm: 30, yMm: 30, widthMm: 8, heightMm: 8 }
      ],
      boundaryConditions: {
        ambientTemperatureC: 25.0,
        convectionCoeffTopWM2K: 15.0,
        convectionCoeffBottomWM2K: 10.0
      },
      gridResolutionX: 20,
      gridResolutionY: 20
    });

    const sol1oz = SpatialThermalSolver.solve(baseConfig(1.0));
    const sol2oz = SpatialThermalSolver.solve(baseConfig(2.0));

    expect(sol2oz.effectiveConductivity.inPlaneConductivityWMK).toBeGreaterThan(sol1oz.effectiveConductivity.inPlaneConductivityWMK);
    // Higher in-plane conductivity spreads heat better, reducing peak hot spot temperature
    expect(sol2oz.maxTemperatureC).toBeLessThan(sol1oz.maxTemperatureC);
  });

  // Test 7: Unconstrained Domain Failure-Closed Behavior
  it('T7: Fails closed with UNCONSTRAINED_SYSTEM when domain has zero cooling sinks', () => {
    const config: PcbThermalBoardConfig = {
      boardWidthMm: 50,
      boardHeightMm: 50,
      layers: createStandard4LayerStackup(1.0),
      components: [
        { refDes: 'U1', powerDissipationWatts: 2.0, xMm: 25, yMm: 25, widthMm: 5, heightMm: 5 }
      ],
      boundaryConditions: {
        ambientTemperatureC: 25.0,
        convectionCoeffTopWM2K: 0.0,
        convectionCoeffBottomWM2K: 0.0,
        convectionCoeffEdgesWM2K: 0.0,
        prescribedBoundaries: [] // No Dirichlet sink
      }
    };

    const sol = SpatialThermalSolver.solve(config);
    expect(sol.verdict).toBe('UNCONSTRAINED_SYSTEM');
    expect(sol.energyBalance.isConserved).toBe(false);
  });

  // Test 8: Adversarial Input Rejection
  it('T8: Rejects invalid geometry and negative power dissipation with INVALID_INPUT', () => {
    const config: PcbThermalBoardConfig = {
      boardWidthMm: -50, // Negative width
      boardHeightMm: 50,
      layers: createStandard4LayerStackup(1.0),
      components: [],
      boundaryConditions: { ambientTemperatureC: 25, convectionCoeffTopWM2K: 10, convectionCoeffBottomWM2K: 10 }
    };

    const sol = SpatialThermalSolver.solve(config);
    expect(sol.verdict).toBe('INVALID_INPUT');
  });

  // Test 9: Canonical Cryptographic Hashing & Invalidation
  it('T9: Produces deterministic SHA-256 canonical hash and detects mutations', () => {
    const config: PcbThermalBoardConfig = {
      designId: 'SECP-TEST-ECU',
      boardWidthMm: 100,
      boardHeightMm: 80,
      layers: createStandard4LayerStackup(1.0),
      components: [
        { refDes: 'IC1', powerDissipationWatts: 3.5, xMm: 50, yMm: 40, widthMm: 10, heightMm: 10 }
      ],
      boundaryConditions: {
        ambientTemperatureC: 25.0,
        convectionCoeffTopWM2K: 15.0,
        convectionCoeffBottomWM2K: 10.0
      }
    };

    const hash1 = computePcbThermalCanonicalHash(config);
    const hash2 = computePcbThermalCanonicalHash(config);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(16);

    // Mutate power
    const mutated = { ...config, components: [{ ...config.components[0], powerDissipationWatts: 4.0 }] };
    const hashMutated = computePcbThermalCanonicalHash(mutated);
    expect(hashMutated).not.toBe(hash1);
  });

  // Test 10: Multi-Component Thermal Interference (Proximity Heating)
  it('T10: Verifies thermal cross-talk increases peak temperature for adjacent components', () => {
    const makeConfig = (x2: number): PcbThermalBoardConfig => ({
      boardWidthMm: 100,
      boardHeightMm: 50,
      layers: createStandard4LayerStackup(1.0),
      components: [
        { refDes: 'U1', powerDissipationWatts: 3.0, xMm: 50, yMm: 25, widthMm: 8, heightMm: 8 },
        { refDes: 'U2', powerDissipationWatts: 3.0, xMm: x2, yMm: 25, widthMm: 8, heightMm: 8 }
      ],
      boundaryConditions: {
        ambientTemperatureC: 25.0,
        convectionCoeffTopWM2K: 15.0,
        convectionCoeffBottomWM2K: 10.0
      },
      gridResolutionX: 25,
      gridResolutionY: 15
    });

    // Close together (x2 = 60mm -> 10mm distance)
    const solClose = SpatialThermalSolver.solve(makeConfig(60));
    // Far apart (x2 = 90mm -> 40mm distance)
    const solFar = SpatialThermalSolver.solve(makeConfig(90));

    expect(solClose.maxTemperatureC).toBeGreaterThan(solFar.maxTemperatureC);
  });

  // Test 11: Full End-to-End PcbCanonicalModel Integration via PcbThermalBridge
  it('T11: Integrates full PcbCanonicalModel with PcbThermalBridge and verifies truth', () => {
    const canonicalPcb: PcbCanonicalModel = {
      designId: 'SECP-REF-ECU-001',
      version: '1.0.0',
      boardWidthMm: 120,
      boardHeightMm: 80,
      thicknessMm: 1.6,
      layerCount: 4,
      components: [
        { id: 'C1', refDes: 'U1', name: 'Microcontroller', value: 'STM32H7', footprintId: 'LQFP100' },
        { id: 'C2', refDes: 'Q1', name: 'Power MOSFET', value: 'IRF740', footprintId: 'DPAK' }
      ],
      schematicNets: [],
      placements: [
        { refDes: 'U1', xMm: 40, yMm: 40, rotationDeg: 0, layer: 'TOP', widthMm: 14, heightMm: 14, height3dMm: 1.6 },
        { refDes: 'Q1', xMm: 80, yMm: 40, rotationDeg: 0, layer: 'TOP', widthMm: 10, heightMm: 8, height3dMm: 2.3 }
      ],
      traces: [],
      vias: [],
      mountingHoles: [
        { id: 'MH1', x: 5, y: 5, diameterMm: 3.2, isPlated: true },
        { id: 'MH2', x: 115, y: 5, diameterMm: 3.2, isPlated: true },
        { id: 'MH3', x: 5, y: 75, diameterMm: 3.2, isPlated: true },
        { id: 'MH4', x: 115, y: 75, diameterMm: 3.2, isPlated: true }
      ],
      footprintLibrary: {},
      rules: { minClearanceMm: 0.15, minTraceWidthMm: 0.2, boardMarginMm: 3.0 }
    };

    const powerDissipations = {
      U1: 1.5, // 1.5 W MCU
      Q1: 3.5  // 3.5 W MOSFET
    };

    const solution = PcbThermalBridge.solvePcb(canonicalPcb, powerDissipations, 25.0);

    expect(solution.verdict).toBe('VERIFIED_WITHIN_DECLARED_SCOPE');
    expect(solution.energyBalance.isConserved).toBe(true);
    expect(solution.componentResults.length).toBe(2);

    const q1Result = solution.componentResults.find(c => c.refDes === 'Q1');
    expect(q1Result).toBeDefined();
    expect(q1Result!.powerWatts).toBe(3.5);
    expect(q1Result!.junctionTempC).toBeGreaterThan(q1Result!.caseTempC);
    expect(q1Result!.caseTempC).toBeGreaterThan(q1Result!.boardTempC);
  });
});
