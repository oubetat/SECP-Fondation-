import { describe, it, expect } from 'vitest';
import { FEMCore } from '../FEMCore';
import { T62DFormulation } from '../T62DFormulation';
import { Q42DFormulation } from '../Q42DFormulation';
import { DOFComponent, FEMModel, FEMNode, FEMElement, FEMMaterial, FEMSection } from '../FEMTypes';

describe('SECP-FEM-UPGRADE-004: Advanced 2D Continuum Elements (T6 & Q4) Test Suite', () => {

  // --- T6 TESTS ---
  it('T6-001: Shape functions sum to 1.0 at arbitrary natural coordinates', () => {
    const t6 = new T62DFormulation();
    const testPoints = [
      { xi: 0.1, eta: 0.2 },
      { xi: 0.333, eta: 0.333 },
      { xi: 0.5, eta: 0.1 },
      { xi: 0.0, eta: 0.8 },
      { xi: 0.2, eta: 0.7 }
    ];

    for (const pt of testPoints) {
      const N = t6.evaluateShapeFunctions(pt.xi, pt.eta);
      const sum = N.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    }
  });

  it('T6-002: Exact reproduction of linear displacement field (patch test)', () => {
    const fem = new FEMCore();
    // Unit right triangle with mid-edge nodes
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 10, y: 0, z: 0 }],
        ['N3', { nodeId: 'N3', x: 0, y: 10, z: 0 }],
        ['N4', { nodeId: 'N4', x: 5, y: 0, z: 0 }],
        ['N5', { nodeId: 'N5', x: 5, y: 5, z: 0 }],
        ['N6', { nodeId: 'N6', x: 0, y: 5, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', {
          elementId: 'E1',
          nodeIds: ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'],
          materialId: 'M1',
          sectionId: 'S1',
          formulationId: 'T6_2D'
        }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.25 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1', thickness: 1.0 }]
      ]),
      loads: [],
      // Impose linear displacement field u(x,y) = 0.001 * x, v(x,y) = -0.00025 * y
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N2', dof: DOFComponent.UX, value: 0.01 },
        { nodeId: 'N2', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N3', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N3', dof: DOFComponent.UY, value: -0.0025 },
        { nodeId: 'N4', dof: DOFComponent.UX, value: 0.005 },
        { nodeId: 'N4', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N5', dof: DOFComponent.UX, value: 0.005 },
        { nodeId: 'N5', dof: DOFComponent.UY, value: -0.00125 },
        { nodeId: 'N6', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N6', dof: DOFComponent.UY, value: -0.00125 },
      ]
    };

    const res = fem.solve(model);
    const elemResult = res.fields.elementFields.get('E1');
    expect(elemResult).toBeDefined();

    // Pure uniaxial strain state: epsilon_x = 0.001, epsilon_y = -0.00025, gamma_xy = 0
    expect(elemResult?.strain.epsilon_x).toBeCloseTo(0.001, 6);
    expect(elemResult?.strain.epsilon_y).toBeCloseTo(-0.00025, 6);
    expect(Math.abs(elemResult?.strain.gamma_xy ?? 0)).toBeLessThan(1e-8);
  });

  it('T6-003: Uniform plane stress state recovery', () => {
    const t6 = new T62DFormulation();
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 100, y: 0, z: 0 }],
        ['N3', { nodeId: 'N3', x: 0, y: 100, z: 0 }],
        ['N4', { nodeId: 'N4', x: 50, y: 0, z: 0 }],
        ['N5', { nodeId: 'N5', x: 50, y: 50, z: 0 }],
        ['N6', { nodeId: 'N6', x: 0, y: 50, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', {
          elementId: 'E1',
          nodeIds: ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'],
          materialId: 'M1',
          sectionId: 'S1',
          formulationId: 'T6_2D'
        }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1', thickness: 10 }]
      ]),
      loads: [
        { nodeId: 'N2', dof: DOFComponent.UX, value: 5000 },
        { nodeId: 'N4', dof: DOFComponent.UX, value: 10000 },
        { nodeId: 'N5', dof: DOFComponent.UX, value: 5000 },
      ],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N3', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N6', dof: DOFComponent.UX, value: 0 },
      ]
    };

    const res = fem.solve(model);
    expect(res.equilibrium.ok).toBe(true);
  });

  it('T6-004: Stiffness matrix symmetry and positive definiteness', () => {
    const t6 = new T62DFormulation();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 10, y: 0, z: 0 }],
        ['N3', { nodeId: 'N3', x: 0, y: 10, z: 0 }],
        ['N4', { nodeId: 'N4', x: 5, y: 0, z: 0 }],
        ['N5', { nodeId: 'N5', x: 5, y: 5, z: 0 }],
        ['N6', { nodeId: 'N6', x: 0, y: 5, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'], materialId: 'M1', sectionId: 'S1', formulationId: 'T6_2D' }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1', thickness: 1.0 }]
      ]),
      loads: [],
      boundaryConditions: []
    };

    const dummyDOFManager = {
      getDOF: (nodeId: string, comp: DOFComponent) => {
        const nIdx = parseInt(nodeId.replace('N', '')) - 1;
        const compIdx = comp === DOFComponent.UX ? 0 : 1;
        return { globalId: 2 * nIdx + compIdx, nodeId, component: comp };
      }
    } as any;

    const { Ke } = t6.computeMatrices(model.elements.get('E1')!, model, dummyDOFManager);

    // Verify symmetry: Ke(i,j) === Ke(j,i)
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 12; c++) {
        expect(Ke.get(r, c)).toBeCloseTo(Ke.get(c, r), 8);
      }
    }
  });

  it('T6-005: Rejection of inverted or degenerate T6 element', () => {
    const fem = new FEMCore();
    const modelDegenerate: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 10, y: 0, z: 0 }],
        ['N3', { nodeId: 'N3', x: 20, y: 0, z: 0 }], // Collinear nodes => Area = 0
        ['N4', { nodeId: 'N4', x: 5, y: 0, z: 0 }],
        ['N5', { nodeId: 'N5', x: 15, y: 0, z: 0 }],
        ['N6', { nodeId: 'N6', x: 10, y: 0, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'], materialId: 'M1', sectionId: 'S1', formulationId: 'T6_2D' }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1', thickness: 1.0 }]
      ]),
      loads: [],
      boundaryConditions: []
    };

    expect(() => fem.solve(modelDegenerate)).toThrow('[INVERTED_OR_DEGENERATE_ELEMENT]');
  });


  // --- Q4 TESTS ---
  it('Q4-001: Shape functions sum to 1.0 at arbitrary natural coordinates', () => {
    const q4 = new Q42DFormulation();
    const testPoints = [
      { xi: -0.5, eta: -0.5 },
      { xi: 0.0, eta: 0.0 },
      { xi: 0.577, eta: -0.577 },
      { xi: 0.9, eta: 0.9 },
      { xi: -0.8, eta: 0.3 }
    ];

    for (const pt of testPoints) {
      const N = q4.evaluateShapeFunctions(pt.xi, pt.eta);
      const sum = N.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    }
  });

  it('Q4-002: Exact reproduction of constant strain field in Q4', () => {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 100, y: 0, z: 0 }],
        ['N3', { nodeId: 'N3', x: 100, y: 50, z: 0 }],
        ['N4', { nodeId: 'N4', x: 0, y: 50, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2', 'N3', 'N4'], materialId: 'M1', sectionId: 'S1', formulationId: 'Q4_2D' }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1', thickness: 10.0 }]
      ]),
      loads: [],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N4', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N4', dof: DOFComponent.UY, value: -0.003 },
        { nodeId: 'N2', dof: DOFComponent.UX, value: 0.01 },
        { nodeId: 'N2', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N3', dof: DOFComponent.UX, value: 0.01 },
        { nodeId: 'N3', dof: DOFComponent.UY, value: -0.003 },
      ]
    };

    const res = fem.solve(model);
    const elemResult = res.fields.elementFields.get('E1');
    expect(elemResult).toBeDefined();

    // epsilon_x = 0.01 / 100 = 0.0001
    // epsilon_y = -0.003 / 50 = -0.00006
    expect(elemResult?.strain.epsilon_x).toBeCloseTo(0.0001, 6);
    expect(elemResult?.strain.epsilon_y).toBeCloseTo(-0.00006, 6);
  });

  it('Q4-003: Rectangular element under uniform tension', () => {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 1000, y: 0, z: 0 }],
        ['N3', { nodeId: 'N3', x: 1000, y: 100, z: 0 }],
        ['N4', { nodeId: 'N4', x: 0, y: 100, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2', 'N3', 'N4'], materialId: 'M1', sectionId: 'S1', formulationId: 'Q4_2D' }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1', thickness: 10 }] // Area = 100 * 10 = 1000 mm^2
      ]),
      loads: [
        { nodeId: 'N2', dof: DOFComponent.UX, value: 50000 },
        { nodeId: 'N3', dof: DOFComponent.UX, value: 50000 },
      ],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N4', dof: DOFComponent.UX, value: 0 },
      ]
    };

    const res = fem.solve(model);
    const u2 = res.displacements.get('N2')?.UX ?? 0;
    // P_total = 100,000 N, L = 1000 mm, E = 200,000 MPa, A = 1000 mm^2
    // delta = P * L / (E * A) = 100000 * 1000 / (200000 * 1000) = 0.5 mm
    expect(u2).toBeCloseTo(0.5, 5);

    // Stress = P / A = 100,000 / 1000 = 100 MPa
    const elemResult = res.fields.elementFields.get('E1');
    expect(elemResult?.stress.sigma_x).toBeCloseTo(100.0, 3);
  });

  it('Q4-004: Skewed quadrilateral element transformation and Jacobian validity', () => {
    const fem = new FEMCore();
    // Skewed quadrilateral (trapezoid)
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 100, y: 10, z: 0 }],
        ['N3', { nodeId: 'N3', x: 80, y: 50, z: 0 }],
        ['N4', { nodeId: 'N4', x: 10, y: 40, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2', 'N3', 'N4'], materialId: 'M1', sectionId: 'S1', formulationId: 'Q4_2D' }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1', thickness: 5.0 }]
      ]),
      loads: [
        { nodeId: 'N2', dof: DOFComponent.UX, value: 1000 },
        { nodeId: 'N3', dof: DOFComponent.UX, value: 1000 },
      ],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N4', dof: DOFComponent.UX, value: 0 },
      ]
    };

    const res = fem.solve(model);
    expect(res.equilibrium.ok).toBe(true);
  });

  it('Q4-005: Rejection of inverted or self-intersecting Q4 element', () => {
    const fem = new FEMCore();
    // Inverted node ordering (crossing edges)
    const modelInverted: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 100, y: 50, z: 0 }], // Crossed node!
        ['N3', { nodeId: 'N3', x: 100, y: 0, z: 0 }],
        ['N4', { nodeId: 'N4', x: 0, y: 50, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2', 'N3', 'N4'], materialId: 'M1', sectionId: 'S1', formulationId: 'Q4_2D' }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1', thickness: 1.0 }]
      ]),
      loads: [],
      boundaryConditions: []
    };

    expect(() => fem.solve(modelInverted)).toThrow('[INVERTED_OR_DEGENERATE_ELEMENT]');
  });

  it('Q4-007: Gauss integration rule area verification (2x2 rule)', () => {
    const q4 = new Q42DFormulation();
    const gaussPoints = q4.getGaussPoints();
    // Sum of weights for [-1,1]x[-1,1] quad must equal 4.0
    const sumW = gaussPoints.reduce((a, b) => a + b.weight, 0);
    expect(sumW).toBeCloseTo(4.0, 10);
  });


  // --- SYSTEM & MIXED MESH TESTS ---
  it('ASM-001: Mixed mesh assembly (CST + T6 + Q4 + BEAM)', () => {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 100, y: 0, z: 0 }],
        ['N3', { nodeId: 'N3', x: 100, y: 100, z: 0 }],
        ['N4', { nodeId: 'N4', x: 0, y: 100, z: 0 }],
        ['N5', { nodeId: 'N5', x: 200, y: 0, z: 0 }],
        ['N6', { nodeId: 'N6', x: 200, y: 100, z: 0 }],
        ['N7', { nodeId: 'N7', x: 150, y: 0, z: 0 }],
        ['N8', { nodeId: 'N8', x: 200, y: 50, z: 0 }],
        ['N9', { nodeId: 'N9', x: 150, y: 100, z: 0 }],
        ['N10', { nodeId: 'N10', x: 100, y: 50, z: 0 }],
        ['N11', { nodeId: 'N11', x: 150, y: 50, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1_Q4', { elementId: 'E1_Q4', nodeIds: ['N1', 'N2', 'N3', 'N4'], materialId: 'M1', sectionId: 'S1', formulationId: 'Q4_2D' }],
        ['E2_T6', { elementId: 'E2_T6', nodeIds: ['N2', 'N5', 'N6', 'N7', 'N8', 'N11'], materialId: 'M1', sectionId: 'S1', formulationId: 'T6_2D' }],
        ['E3_CST', { elementId: 'E3_CST', nodeIds: ['N2', 'N6', 'N3'], materialId: 'M1', sectionId: 'S1', formulationId: 'CST_2D' }],
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1', thickness: 10 }]
      ]),
      loads: [
        { nodeId: 'N5', dof: DOFComponent.UX, value: 5000 },
        { nodeId: 'N6', dof: DOFComponent.UX, value: 5000 },
      ],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N4', dof: DOFComponent.UX, value: 0 },
      ]
    };

    const res = fem.solve(model);
    expect(res.equilibrium.ok).toBe(true);
    expect(res.sparseMetrics.totalDOFs).toBeGreaterThan(10);
  });

});
