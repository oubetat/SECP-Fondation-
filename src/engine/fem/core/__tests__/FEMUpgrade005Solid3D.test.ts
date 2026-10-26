/**
 * SECP Industrial OS — Engineering Truth OS
 * FEMUpgrade005Solid3D.test.ts
 * 
 * Unit & Integration Test Suite for SECP-FEM-UPGRADE-005:
 * 3D Solid Mechanics — TET4_3D 4-Node Linear Tetrahedral Element
 */

import { describe, it, expect } from 'vitest';
import { TET43DFormulation } from '../TET43DFormulation';
import { FEMCore } from '../FEMCore';
import { DOFComponent, FEMModel } from '../FEMTypes';

describe('SECP-FEM-UPGRADE-005: 3D Solid Mechanics (TET4_3D)', () => {
  const formulation = new TET43DFormulation();

  it('verifies TET4_3D shape functions and partition of unity', () => {
    // Test shape functions at vertices
    const N_node1 = formulation.evaluateShapeFunctions(0, 0, 0);
    expect(N_node1).toEqual([1, 0, 0, 0]);

    const N_node2 = formulation.evaluateShapeFunctions(1, 0, 0);
    expect(N_node2).toEqual([0, 1, 0, 0]);

    const N_node3 = formulation.evaluateShapeFunctions(0, 1, 0);
    expect(N_node3).toEqual([0, 0, 1, 0]);

    const N_node4 = formulation.evaluateShapeFunctions(0, 0, 1);
    expect(N_node4).toEqual([0, 0, 0, 1]);

    // Test shape functions at centroid (0.25, 0.25, 0.25)
    const N_centroid = formulation.evaluateShapeFunctions(0.25, 0.25, 0.25);
    expect(N_centroid).toEqual([0.25, 0.25, 0.25, 0.25]);

    // Partition of unity check at arbitrary point
    const N_arbitrary = formulation.evaluateShapeFunctions(0.1, 0.2, 0.3);
    const sum = N_arbitrary.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('rejects degenerate or inverted 3D tetrahedral elements', () => {
    const dofManager = new FEMCore().getDOFManager();
    const model: FEMModel = {
      nodes: new Map([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 1, y: 0, z: 0 }],
        ['N3', { nodeId: 'N3', x: 0, y: 1, z: 0 }],
        ['N4', { nodeId: 'N4', x: 0.5, y: 0.5, z: 0 }] // Co-planar node (z=0) -> volume = 0
      ]),
      elements: new Map([
        ['E1', {
          elementId: 'E1',
          nodeIds: ['N1', 'N2', 'N3', 'N4'],
          materialId: 'M1',
          sectionId: 'S1',
          formulationId: 'TET4_3D'
        }]
      ]),
      materials: new Map([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map([
        ['S1', { sectionId: 'S1' }]
      ]),
      loads: [],
      boundaryConditions: []
    };

    expect(() => formulation.computeMatrices(model.elements.get('E1')!, model, dofManager)).toThrow('[INVERTED_OR_DEGENERATE_ELEMENT]');
  });

  it('computes 3D stiffness matrix with exact symmetry and zero-sum rigid body translational modes', () => {
    const dofManager = new FEMCore().getDOFManager();
    const model: FEMModel = {
      nodes: new Map([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 10, y: 0, z: 0 }],
        ['N3', { nodeId: 'N3', x: 0, y: 10, z: 0 }],
        ['N4', { nodeId: 'N4', x: 0, y: 0, z: 10 }]
      ]),
      elements: new Map([
        ['E1', {
          elementId: 'E1',
          nodeIds: ['N1', 'N2', 'N3', 'N4'],
          materialId: 'M1',
          sectionId: 'S1',
          formulationId: 'TET4_3D'
        }]
      ]),
      materials: new Map([
        ['M1', { materialId: 'M1', E: 210000, nu: 0.3 }]
      ]),
      sections: new Map([
        ['S1', { sectionId: 'S1' }]
      ]),
      loads: [],
      boundaryConditions: []
    };

    dofManager.buildDOFs(model, new Map([['TET4_3D', formulation]]));
    const result = formulation.computeMatrices(model.elements.get('E1')!, model, dofManager);
    const Ke = result.Ke;

    expect(Ke.rows).toBe(12);
    expect(Ke.cols).toBe(12);

    // 1. Check symmetry: K[r][c] == K[c][r]
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 12; c++) {
        expect(Ke.get(r, c)).toBeCloseTo(Ke.get(c, r), 6);
      }
    }

    // 2. Check rigid body translation (row sums for UX, UY, UZ components)
    for (let r = 0; r < 12; r++) {
      let rowSumX = 0, rowSumY = 0, rowSumZ = 0;
      for (let node = 0; node < 4; node++) {
        rowSumX += Ke.get(r, 3 * node);     // UX
        rowSumY += Ke.get(r, 3 * node + 1); // UY
        rowSumZ += Ke.get(r, 3 * node + 2); // UZ
      }
      expect(rowSumX).toBeCloseTo(0, 6);
      expect(rowSumY).toBeCloseTo(0, 6);
      expect(rowSumZ).toBeCloseTo(0, 6);
    }
  });

  it('correctly calculates 3D principal stresses (sigma_1 >= sigma_2 >= sigma_3)', () => {
    // Hydrostatic stress state: sig_x = sig_y = sig_z = 100, no shear
    const hydro = formulation.compute3DPrincipalStresses(100, 100, 100, 0, 0, 0);
    expect(hydro.sigma_1).toBeCloseTo(100, 5);
    expect(hydro.sigma_2).toBeCloseTo(100, 5);
    expect(hydro.sigma_3).toBeCloseTo(100, 5);

    // Triaxial stress state: 300, 200, 100
    const triaxial = formulation.compute3DPrincipalStresses(300, 100, 200, 0, 0, 0);
    expect(triaxial.sigma_1).toBeCloseTo(300, 5);
    expect(triaxial.sigma_2).toBeCloseTo(200, 5);
    expect(triaxial.sigma_3).toBeCloseTo(100, 5);

    // Pure shear state in XY: sig_x = 0, sig_y = 0, tau_xy = 50 -> principal: +50, 0, -50
    const pureShear = formulation.compute3DPrincipalStresses(0, 0, 0, 50, 0, 0);
    expect(pureShear.sigma_1).toBeCloseTo(50, 5);
    expect(pureShear.sigma_2).toBeCloseTo(0, 5);
    expect(pureShear.sigma_3).toBeCloseTo(-50, 5);
  });

  it('solves 3D solid bar under axial tension and verifies stress, strain, and reactions', () => {
    const core = new FEMCore();
    // Unit cube decomposed into tetrahedra:
    // Nodes:
    // N1: (0,0,0), N2: (10,0,0), N3: (0,10,0), N4: (0,0,10), N5: (10,10,10)
    // Create 2 tetrahedra sharing face N2-N3-N4
    const model: FEMModel = {
      nodes: new Map([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 10, y: 0, z: 0 }],
        ['N3', { nodeId: 'N3', x: 0, y: 10, z: 0 }],
        ['N4', { nodeId: 'N4', x: 0, y: 0, z: 10 }],
        ['N5', { nodeId: 'N5', x: 10, y: 10, z: 10 }]
      ]),
      elements: new Map([
        ['E1', {
          elementId: 'E1',
          nodeIds: ['N1', 'N2', 'N3', 'N4'],
          materialId: 'M1',
          sectionId: 'S1',
          formulationId: 'TET4_3D'
        }],
        ['E2', {
          elementId: 'E2',
          nodeIds: ['N2', 'N3', 'N4', 'N5'],
          materialId: 'M1',
          sectionId: 'S1',
          formulationId: 'TET4_3D'
        }]
      ]),
      materials: new Map([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.25 }]
      ]),
      sections: new Map([
        ['S1', { sectionId: 'S1' }]
      ]),
      loads: [
        { nodeId: 'N5', dof: DOFComponent.UX, value: 5000 },
        { nodeId: 'N2', dof: DOFComponent.UX, value: 5000 }
      ],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UZ, value: 0 },
        { nodeId: 'N3', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N3', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N3', dof: DOFComponent.UZ, value: 0 },
        { nodeId: 'N4', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N4', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N4', dof: DOFComponent.UZ, value: 0 }
      ]
    };

    const result = core.solve(model, { solverType: 'DIRECT_PARTITIONED' });

    expect(result.equilibrium.ok).toBe(true);
    expect(result.energy.ok).toBe(true);
    expect(result.fields.recoveryStatus).toBe('CONVERGED_AND_VERIFIED');

    // Total reaction force in X must equal -10000 N
    const sumRx = result.reactions.reduce((sum, val, idx) => {
      const dof = core.getDOFManager().getDOFByGlobalId(idx);
      return dof?.component === DOFComponent.UX ? sum + val : sum;
    }, 0);

    expect(sumRx).toBeCloseTo(-10000, 2);

    // Verify element field recovery returns non-zero strain energy and valid von Mises stress
    const elem1Field = result.fields.elementFields.get('E1')!;
    expect(elem1Field.formulationId).toBe('TET4_3D');
    expect(elem1Field.strainEnergy).toBeGreaterThan(0);
    expect(elem1Field.vonMisesStress).toBeGreaterThan(0);
    expect(elem1Field.principalStresses?.sigma_1).toBeGreaterThanOrEqual(elem1Field.principalStresses?.sigma_2!);
    expect(elem1Field.principalStresses?.sigma_2!).toBeGreaterThanOrEqual(elem1Field.principalStresses?.sigma_3!);
  });

  it('solves 3D multi-element solid block using Sparse PCG solver with convergence', () => {
    const core = new FEMCore();

    // 3D Block mesh with 8 nodes forming a box [0..10] x [0..10] x [0..10], split into 5 tetrahedra
    const model: FEMModel = {
      nodes: new Map([
        ['N1', { nodeId: 'N1', x: 0,  y: 0,  z: 0  }],
        ['N2', { nodeId: 'N2', x: 10, y: 0,  z: 0  }],
        ['N3', { nodeId: 'N3', x: 10, y: 10, z: 0  }],
        ['N4', { nodeId: 'N4', x: 0,  y: 10, z: 0  }],
        ['N5', { nodeId: 'N5', x: 0,  y: 0,  z: 10 }],
        ['N6', { nodeId: 'N6', x: 10, y: 0,  z: 10 }],
        ['N7', { nodeId: 'N7', x: 10, y: 10, z: 10 }],
        ['N8', { nodeId: 'N8', x: 0,  y: 10, z: 10 }]
      ]),
      elements: new Map([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2', 'N4', 'N5'], materialId: 'M1', sectionId: 'S1', formulationId: 'TET4_3D' }],
        ['E2', { elementId: 'E2', nodeIds: ['N2', 'N3', 'N4', 'N7'], materialId: 'M1', sectionId: 'S1', formulationId: 'TET4_3D' }],
        ['E3', { elementId: 'E3', nodeIds: ['N2', 'N5', 'N6', 'N7'], materialId: 'M1', sectionId: 'S1', formulationId: 'TET4_3D' }],
        ['E4', { elementId: 'E4', nodeIds: ['N4', 'N5', 'N7', 'N8'], materialId: 'M1', sectionId: 'S1', formulationId: 'TET4_3D' }],
        ['E5', { elementId: 'E5', nodeIds: ['N2', 'N4', 'N5', 'N7'], materialId: 'M1', sectionId: 'S1', formulationId: 'TET4_3D' }]
      ]),
      materials: new Map([
        ['M1', { materialId: 'M1', E: 210000, nu: 0.3 }]
      ]),
      sections: new Map([
        ['S1', { sectionId: 'S1' }]
      ]),
      loads: [
        { nodeId: 'N6', dof: DOFComponent.UZ, value: -2000 },
        { nodeId: 'N7', dof: DOFComponent.UZ, value: -2000 }
      ],
      boundaryConditions: [
        // Fixed face at z=0 (N1, N2, N3, N4)
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 }, { nodeId: 'N1', dof: DOFComponent.UY, value: 0 }, { nodeId: 'N1', dof: DOFComponent.UZ, value: 0 },
        { nodeId: 'N2', dof: DOFComponent.UX, value: 0 }, { nodeId: 'N2', dof: DOFComponent.UY, value: 0 }, { nodeId: 'N2', dof: DOFComponent.UZ, value: 0 },
        { nodeId: 'N3', dof: DOFComponent.UX, value: 0 }, { nodeId: 'N3', dof: DOFComponent.UY, value: 0 }, { nodeId: 'N3', dof: DOFComponent.UZ, value: 0 },
        { nodeId: 'N4', dof: DOFComponent.UX, value: 0 }, { nodeId: 'N4', dof: DOFComponent.UY, value: 0 }, { nodeId: 'N4', dof: DOFComponent.UZ, value: 0 }
      ]
    };

    const result = core.solve(model, { solverType: 'SPARSE_PCG', pcgOptions: { maxIterations: 500, tolerance: 1e-8 } });

    expect(result.solverTypeUsed).toBe('SPARSE_PCG');
    expect(result.equilibrium.ok).toBe(true);
    expect(result.energy.ok).toBe(true);
    expect(result.sparseMetrics.totalDOFs).toBe(24);
    expect(result.fields.maxVonMisesStress).toBeGreaterThan(0);
  });
});
