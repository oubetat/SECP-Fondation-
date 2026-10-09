/**
 * SECP Industrial OS v2 — Energy Conservation Adversarial Tests
 * PATCH-059
 */

import { describe, test, expect } from 'vitest';
import { EnergyState } from '../EnergyState';
import { EnergyFormulation } from '../EnergyConservationTypes';
import { EnergyConservationVerification } from '../EnergyConservationVerification';
import { GlobalEnergyBalance } from '../GlobalEnergyBalance';
import { CellEnergyTerms, EnergyControlVolumeBalance } from '../EnergyControlVolumeBalance';
import { CFDMesh3D } from '../../../mesh/CFDMeshTypes';

describe('PATCH-059 — Energy Conservation Adversarial Tests', () => {

  test('1. Rejection of Negative Temperature', () => {
    expect(() => new EnergyState(-50, 1.2, [0, 0, 0], 718, 1005)).toThrow();
  });

  test('2. Rejection of Zero/Negative Density', () => {
    expect(() => new EnergyState(300, 0, [0, 0, 0], 718, 1005)).toThrow();
    expect(() => new EnergyState(300, -1.0, [0, 0, 0], 718, 1005)).toThrow();
  });

  test('3. Rejection of Non-Finite Velocity', () => {
    expect(() => new EnergyState(300, 1.2, [NaN, 0, 0], 718, 1005)).toThrow();
    expect(() => new EnergyState(300, 1.2, [0, Infinity, 0], 718, 1005)).toThrow();
  });

  test('4. Detection of Double Counting (Pressure Work + Total Enthalpy)', () => {
    const check = EnergyConservationVerification.verifyNoDoubleCounting(
      EnergyFormulation.TOTAL_ENERGY,
      true, // includes pressure work in convective flux
      true  // ALSO added separate pressure work
    );
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('double-counted');
  });

  test('5. Local Error Cancellation Detection (Global Cancellation Hiding Local Failure)', () => {
    const mesh: CFDMesh3D = {
      cells: [
        { id: 0,  volume: 1,  neighbors: [] },
        { id: 1,  volume: 1,  neighbors: [] }
      ],
      faces: [
        { id: 0, area: 1, normal: [-1,0,0], center:[0,0.5,0.5], ownerCellId:0, neighborCellId:null, isBoundary:true },
        { id: 1, area: 1, normal: [1,0,0], center:[1,0.5,0.5], ownerCellId:0, neighborCellId:null, isBoundary:true },
        { id: 2, area: 1, normal: [-1,0,0], center:[1,0.5,0.5], ownerCellId:1, neighborCellId:null, isBoundary:true },
        { id: 3, area: 1, normal: [1,0,0], center:[2,0.5,0.5], ownerCellId:1, neighborCellId:null, isBoundary:true }
      ],
      nodes: [], boundaryConditions: [], metadata: { name: 'cancel-059', description: '' }
    };

    // Cell 0: +10 W imbalance. Cell 1: -10 W imbalance.
    // Global imbalance = +10 + (-10) = 0 W.
    const terms0: CellEnergyTerms = {
      convectiveFluxes: [0, 10, 0, 0],
      conductiveHeatFluxes: [0, 0, 0, 0],
      volumetricHeatSource: 0, // Outflow 10, Source 0 => imbalance +10
      bodyForcePower: 0,
      explicitSources: 0,
      accumulation: 0,
      formulation: EnergyFormulation.TOTAL_ENERGY
    };

    const terms1: CellEnergyTerms = {
      convectiveFluxes: [0, 0, -10, 0],
      conductiveHeatFluxes: [0, 0, 0, 0],
      volumetricHeatSource: 0, // Inflow 10, Source 0 => imbalance -10
      bodyForcePower: 0,
      explicitSources: 0,
      accumulation: 0,
      formulation: EnergyFormulation.TOTAL_ENERGY
    };

    const cb0 = EnergyControlVolumeBalance.calculateCellBalance(0, mesh, terms0);
    const cb1 = EnergyControlVolumeBalance.calculateCellBalance(1, mesh, terms1);

    const globalRes = GlobalEnergyBalance.calculateGlobalBalance(
      mesh,
      [cb0, cb1],
      EnergyFormulation.TOTAL_ENERGY,
      1e-12,
      1e-4, // local tolerance
      1e-6  // global tolerance
    );

    expect(globalRes.globalImbalance).toBe(0);
    expect(globalRes.maxLocalImbalance).toBe(10);
    // MUST NOT pass as CONSERVATIVE because local imbalance exceeded localTolerance
    expect(globalRes.status).toBe('NOT_CONSERVATIVE');
  });
});
