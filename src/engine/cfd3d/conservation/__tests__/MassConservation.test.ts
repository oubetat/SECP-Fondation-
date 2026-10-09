/**
 * SECP Industrial OS v2 — Mass Conservation Unit Tests
 * PATCH-057
 */

import { describe, test, expect } from 'vitest';
import { MassFluxCalculator } from '../MassFluxCalculator';
import { CellMassBalance } from '../CellMassBalance';
import { GlobalMassBalance } from '../GlobalMassBalance';
import { MassConservationStatus } from '../MassConservationTypes';
import { CFDMesh3D } from '../../mesh/CFDMeshTypes';

describe('PATCH-057 — Mass Conservation Framework Tests', () => {

  const createMockMesh = (): CFDMesh3D => ({
    cells: [{ id: 0,  volume: 1,   }],
    faces: [
      { id: 0, area: 1, normal: [-1, 0, 0],  ownerCellId: 0, neighborCellId: null, isBoundary: true },
      { id: 1, area: 1, normal: [1, 0, 0],  ownerCellId: 0, neighborCellId: null, isBoundary: true }
    ],
    nodes: [], boundaryConditions: [], metadata: { name: 'mock', description: '' }
  });

  test('1. Accurate Mass Flux Calculation (Inflow/Outflow)', () => {
    const mesh = createMockMesh();
    // Inflow: v = [1,0,0], n = [-1,0,0] => dot = -1
    const fluxIn = MassFluxCalculator.calculateFaceMassFlux(mesh.faces[0], 1.2, [1, 0, 0], [-1, 0, 0]);
    expect(fluxIn).toBe(-1.2);

    // Outflow: v = [1,0,0], n = [1,0,0] => dot = 1
    const fluxOut = MassFluxCalculator.calculateFaceMassFlux(mesh.faces[1], 1.2, [1, 0, 0], [1, 0, 0]);
    expect(fluxOut).toBe(1.2);
  });

  test('2. Local Control Volume Balance', () => {
    const mesh = createMockMesh();
    const faceFluxes = new Float64Array(2);
    faceFluxes[0] = -1.5; // Inflow
    faceFluxes[1] = 1.5;  // Outflow
    
    const balance = CellMassBalance.calculateCellBalance(0, mesh, faceFluxes);
    expect(balance.imbalance).toBe(0);
    expect(balance.inflow).toBe(1.5);
    expect(balance.outflow).toBe(1.5);
  });

  test('3. Global Balance and Status Detection', () => {
    const mesh = createMockMesh();
    const faceFluxes = new Float64Array(2);
    faceFluxes[0] = -1.0;
    faceFluxes[1] = 1.1; // 0.1 mismatch
    
    const b0 = CellMassBalance.calculateCellBalance(0, mesh, faceFluxes);
    const global = GlobalMassBalance.calculateGlobalBalance(mesh, faceFluxes, [b0]);
    
    expect(global.globalMassImbalance).toBeCloseTo(0.1, 10);
    expect(global.status).toBe(MassConservationStatus.NOT_CONSERVATIVE);
  });

  test('4. Internal Face Implicit Conservation', () => {
    // 2 cells, 1 internal face
    const mesh: CFDMesh3D = {
      cells: [
        { id: 0,  volume: 1,   },
        { id: 1,  volume: 1,   }
      ],
      faces: [
        { id: 0, area: 1, normal: [-1,0,0], center:[0,0.5,0.5], ownerCellId:0, neighborCellId:null, isBoundary:true },
        { id: 1, area: 1, normal: [1,0,0], center:[1,0.5,0.5], ownerCellId:0, neighborCellId:1, isBoundary:false },
        { id: 2, area: 1, normal: [1,0,0], center:[2,0.5,0.5], ownerCellId:1, neighborCellId:null, isBoundary:true }
      ],
      nodes: [], boundaryConditions: [], metadata: { name: 'mock2', description: '' }
    };
    const fluxes = new Float64Array([ -1.0, 1.0, 1.0 ]); // C0: -1 in, 1 out (to C1). C1: 1 in (from C0), 1 out (to boundary)
    
    const b0 = CellMassBalance.calculateCellBalance(0, mesh, fluxes);
    const b1 = CellMassBalance.calculateCellBalance(1, mesh, fluxes);
    
    expect(b0.imbalance).toBe(0);
    expect(b1.imbalance).toBe(0);
    
    const global = GlobalMassBalance.calculateGlobalBalance(mesh, fluxes, [b0, b1]);
    expect(global.globalMassImbalance).toBe(0);
    expect(global.status).toBe(MassConservationStatus.CONSERVATIVE);
  });
});
