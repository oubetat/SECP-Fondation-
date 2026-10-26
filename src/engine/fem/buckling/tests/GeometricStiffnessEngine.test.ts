/**
 * SECP Industrial OS — Engineering Truth OS
 * GeometricStiffnessEngine.test.ts
 * 
 * Unit Test Suite for GeometricStiffnessEngine (SECP-FEM-UPGRADE-006).
 */

import { describe, it, expect } from 'vitest';
import { GeometricStiffnessEngine } from '../GeometricStiffnessEngine';
import { FEMCore } from '../../core/FEMCore';
import { DOFComponent, FEMModel } from '../../core/FEMTypes';

describe('SECP-FEM-UPGRADE-006: GeometricStiffnessEngine', () => {
  const engine = new GeometricStiffnessEngine();

  it('computes exact 6x6 local geometric stiffness matrix for beam element under compression P', () => {
    const L = 1000; // mm
    const P = 50000; // N (compression)

    const Kg_local = engine.computeBeam2DGeometricStiffnessLocal(L, P);

    expect(Kg_local.rows).toBe(6);
    expect(Kg_local.cols).toBe(6);

    // Verify exact entries: factor = P / (30 * L) = 50000 / 30000 = 5/3 = 1.6666666666666667
    const factor = P / (30 * L);
    expect(Kg_local.get(1, 1)).toBeCloseTo(36 * factor, 6);
    expect(Kg_local.get(1, 2)).toBeCloseTo(3 * L * factor, 6);
    expect(Kg_local.get(2, 2)).toBeCloseTo(4 * L * L * factor, 6);
    expect(Kg_local.get(1, 4)).toBeCloseTo(-36 * factor, 6);
    expect(Kg_local.get(2, 5)).toBeCloseTo(-L * L * factor, 6);

    // Symmetry check
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        expect(Kg_local.get(r, c)).toBeCloseTo(Kg_local.get(c, r), 10);
      }
    }
  });

  it('throws error for unsupported element formulation (e.g. CST_2D or BAR_1D without bending DOFs)', () => {
    const femCore = new FEMCore();
    const model: FEMModel = {
      nodes: new Map([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 10, y: 0, z: 0 }],
        ['N3', { nodeId: 'N3', x: 0, y: 10, z: 0 }]
      ]),
      elements: new Map([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2', 'N3'], materialId: 'M1', sectionId: 'S1', formulationId: 'CST_2D' }]
      ]),
      materials: new Map([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map([
        ['S1', { sectionId: 'S1', thickness: 10 }]
      ]),
      loads: [],
      boundaryConditions: []
    };

    femCore.getDOFManager().buildDOFs(model, new Map());

    const elemResult = {
      elementId: 'E1',
      formulationId: 'CST_2D',
      strain: { epsilon_x: 0.001 },
      stress: { sigma_x: 200 },
      internalForces: { N: -5000 },
      vonMisesStress: 200,
      strainEnergy: 10,
      location: 'CENTROID' as const,
      units: { strain: 'dimensionless' as const, stress: 'MPa' as const, strainEnergy: 'N*mm' as const }
    };

    expect(() => engine.computeElementGeometricStiffness(model.elements.get('E1')!, model, femCore.getDOFManager(), elemResult))
      .toThrow('[UNSUPPORTED_ELEMENT_FOR_BUCKLING]');
  });

  it('assembles global geometric stiffness sparse matrix K_G for a 2-element frame column', () => {
    const femCore = new FEMCore();
    const model: FEMModel = {
      nodes: new Map([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 0, y: 500, z: 0 }],
        ['N3', { nodeId: 'N3', x: 0, y: 1000, z: 0 }]
      ]),
      elements: new Map([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2'], materialId: 'M1', sectionId: 'S1', formulationId: 'FRAME_2D' }],
        ['E2', { elementId: 'E2', nodeIds: ['N2', 'N3'], materialId: 'M1', sectionId: 'S1', formulationId: 'FRAME_2D' }]
      ]),
      materials: new Map([
        ['M1', { materialId: 'M1', E: 210000, nu: 0.3 }]
      ]),
      sections: new Map([
        ['S1', { sectionId: 'S1', area: 100, I: 833.333 }]
      ]),
      loads: [
        { nodeId: 'N3', dof: DOFComponent.UY, value: -10000 }
      ],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.RZ, value: 0 }
      ]
    };

    const refSol = femCore.solve(model);
    const K_G_sparse = engine.assembleGlobalGeometricStiffness(model, femCore.getDOFManager(), refSol.fields.elementFields);

    expect(K_G_sparse.rows).toBe(9); // 3 nodes x 3 DOFs = 9 DOFs
    expect(K_G_sparse.cols).toBe(9);
    expect(K_G_sparse.getNNZ()).toBeGreaterThan(0);
  });
});
