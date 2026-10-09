/**
 * SECP Industrial OS v2 — Mass Conservation Adversarial Tests
 * PATCH-057
 */

import { describe, test, expect } from 'vitest';
import { MassFluxCalculator } from '../MassFluxCalculator';
import { GlobalMassBalance } from '../GlobalMassBalance';
import { CellMassBalance } from '../CellMassBalance';
import { CFDMesh3D } from '../../mesh/CFDMeshTypes';

describe('PATCH-057 — Mass Conservation Adversarial Tests', () => {

  const dummyFace = { id: 0, area: 1, normal: [1, 0, 0] as [number, number, number], ownerCellId: 0, neighborCellId: null, isBoundary: true };

  test('1. Rejection of Negative Density', () => {
    expect(() => MassFluxCalculator.calculateFaceMassFlux(dummyFace, -1.0, [0, 0, 0], [1, 0, 0])).toThrow();
  });

  test('2. Rejection of NaN Velocity', () => {
    expect(() => MassFluxCalculator.calculateFaceMassFlux(dummyFace, 1.0, [NaN, 0, 0], [1, 0, 0])).toThrow();
  });

  test('3. Zero-Flow Division Safety', () => {
    const mesh: CFDMesh3D = {
      cells: [{ id: 0,  volume: 1,   }],
      faces: [dummyFace],
      nodes: [], boundaryConditions: [], metadata: { name: 'zero', description: '' }
    };
    const fluxes = new Float64Array(1).fill(0);
    const b0 = CellMassBalance.calculateCellBalance(0, mesh, fluxes);
    const global = GlobalMassBalance.calculateGlobalBalance(mesh, fluxes, [b0]);
    
    expect(global.normalizedGlobalImbalance).toBe(0);
    expect(global.globalMassImbalance).toBe(0);
  });

  test('4. Detection of Local Cancellation (Hiding Local Error)', () => {
    // 2 isolated cells. C0 has imbalance +1, C1 has imbalance -1. Global = 0.
    const mesh: CFDMesh3D = {
      cells: [
        { id: 0,  volume: 1,   },
        { id: 1,  volume: 1,   }
      ],
      faces: [
        { id: 0, area: 1, normal: [-1,0,0], center:[0,0.5,0.5], ownerCellId:0, neighborCellId:null, isBoundary:true },
        { id: 1, area: 1, normal: [1,0,0], center:[1,0.5,0.5], ownerCellId:0, neighborCellId:null, isBoundary:true },
        { id: 2, area: 1, normal: [-1,0,0], center:[2,0.5,0.5], ownerCellId:1, neighborCellId:null, isBoundary:true },
        { id: 3, area: 1, normal: [1,0,0], center:[3,0.5,0.5], ownerCellId:1, neighborCellId:null, isBoundary:true }
      ],
      nodes: [], boundaryConditions: [], metadata: { name: 'cancel', description: '' }
    };
    const fluxes = new Float64Array(4);
    fluxes[0] = -1.0; fluxes[1] = 1.0; // C0 Balanced
    fluxes[2] = -1.0; fluxes[3] = 0.0; // C1 Imbalanced: Inflow 1.0, Outflow 0. Imbalance = -1.0
    
    // Let's modify so C0 is +1 imbalance, C1 is -1 imbalance
    fluxes[0] = 0.0; fluxes[1] = 1.0; // C0: Outflow 1.0, Inflow 0. Imbalance = 1.0
    fluxes[2] = -1.0; fluxes[3] = 0.0; // C1: Inflow 1.0, Outflow 0. Imbalance = -1.0
    
    const b0 = CellMassBalance.calculateCellBalance(0, mesh, fluxes);
    const b1 = CellMassBalance.calculateCellBalance(1, mesh, fluxes);
    const global = GlobalMassBalance.calculateGlobalBalance(mesh, fluxes, [b0, b1]);
    
    expect(global.globalMassImbalance).toBe(0);
    expect(global.maxLocalImbalance).toBe(1.0);
    // Even though global is 0, status should be NOT_CONSERVATIVE due to maxLocalImbalance
    expect(global.status).toBe('NOT_CONSERVATIVE');
  });
});
