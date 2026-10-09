/**
 * SECP Industrial OS v2 — Energy Conservation Unit Tests
 * PATCH-059
 */

import { describe, test, expect } from 'vitest';
import { EnergyState } from '../EnergyState';
import { EnergyFormulation, EnergyConservationStatus } from '../EnergyConservationTypes';
import { EnergyFluxCalculator } from '../EnergyFluxCalculator';
import { HeatFluxCalculator } from '../HeatFluxCalculator';
import { VolumetricHeatSource } from '../VolumetricHeatSource';
import { EnergyControlVolumeBalance } from '../EnergyControlVolumeBalance';
import { GlobalEnergyBalance } from '../GlobalEnergyBalance';
import { CFDMesh3D } from '../../../mesh/CFDMeshTypes';

describe('PATCH-059 — Energy Conservation Framework Tests', () => {

  const createMockMesh = (): CFDMesh3D => ({
    cells: [{ id: 0,  volume: 1,  neighbors: [] }],
    faces: [
      { id: 0, area: 1, normal: [-1, 0, 0],  ownerCellId: 0, neighborCellId: null, isBoundary: true },
      { id: 1, area: 1, normal: [1, 0, 0],  ownerCellId: 0, neighborCellId: null, isBoundary: true }
    ],
    nodes: [], boundaryConditions: [], metadata: { name: 'mock-059', description: '' }
  });

  test('1. EnergyState Specific Energy Calculations', () => {
    const state = new EnergyState(300, 1.2, [10, 0, 0], 718, 1005, EnergyFormulation.TOTAL_ENERGY);
    expect(state.specificInternalEnergy).toBe(718 * 300); // 215400
    expect(state.specificKineticEnergy).toBe(0.5 * 100);   // 50
    expect(state.specificTotalEnergy).toBe(215450);
  });

  test('2. Convective Energy Flux Calculation', () => {
    const mesh = createMockMesh();
    const state = new EnergyState(300, 1.0, [2, 0, 0], 700, 1000, EnergyFormulation.TOTAL_ENERGY);
    // E = 700*300 + 0.5*4 = 210002
    // fluxIn: rho=1, E=210002, u=[2,0,0], n=[-1,0,0], A=1 => 1 * 210002 * (-2) * 1 = -420004
    const fluxIn = EnergyFluxCalculator.calculateConvectiveEnergyFlux(mesh.faces[0], state, [-1, 0, 0]);
    expect(fluxIn).toBe(-420004);

    const fluxOut = EnergyFluxCalculator.calculateConvectiveEnergyFlux(mesh.faces[1], state, [1, 0, 0]);
    expect(fluxOut).toBe(420004);
  });

  test('3. Conductive Heat Flux (Fourier Law)', () => {
    const mesh = createMockMesh();
    // q = -k gradT . n A = -0.05 * (-20) * 1 = 1.0 W
    const q = HeatFluxCalculator.calculateFaceHeatFlux(mesh.faces[1], 0.05, [-20, 0, 0], [1, 0, 0]);
    expect(q).toBeCloseTo(1.0);
  });

  test('4. Volumetric Heat Source Power', () => {
    const source = new VolumetricHeatSource('electric-heater', 1000); // 1000 W/m^3
    expect(source.calculateTotalPower(2.5)).toBe(2500);
  });

  test('5. Cell and Global Energy Balance with Source Term', () => {
    const mesh = createMockMesh();
    // Cell 0 has 100 W/m^3 volumetric heat source.
    // Inflow: 0 W, Outflow: 100 W convective heat.
    const terms = {
      convectiveFluxes: [0, 100], // Face 0 (inflow)=0, Face 1 (outflow)=100 W
      conductiveHeatFluxes: [0, 0],
      volumetricHeatSource: 100, // 100 W generation
      bodyForcePower: 0,
      explicitSources: 0,
      accumulation: 0,
      formulation: EnergyFormulation.TOTAL_ENERGY
    };

    const cb = EnergyControlVolumeBalance.calculateCellBalance(0, mesh, terms);
    // Outward transfers = 100 W. Generation = 100 W. Imbalance = 0.
    expect(cb.imbalance).toBe(0);

    const globalRes = GlobalEnergyBalance.calculateGlobalBalance(mesh, [cb], EnergyFormulation.TOTAL_ENERGY);
    expect(globalRes.globalImbalance).toBe(0);
    expect(globalRes.status).toBe(EnergyConservationStatus.CONSERVATIVE);
  });
});
