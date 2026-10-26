import { describe, it, expect } from 'vitest';
import { FEMCore } from '../FEMCore';
import { DOFComponent, FEMModel, FEMNode, FEMElement, FEMMaterial, FEMSection } from '../FEMTypes';

describe('SECP-FEM-UPGRADE-003: Beam & Frame Element Formulation Test Suite', () => {

  it('BEAM-001: Cantilever beam under tip point load (Euler-Bernoulli closed-form comparison)', () => {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 1000, y: 0, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', {
          elementId: 'E1',
          nodeIds: ['N1', 'N2'],
          materialId: 'M1',
          sectionId: 'S1',
          formulationId: 'BEAM_2D'
        }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 210000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1', area: 100, I: 10000, iy: 10 }]
      ]),
      loads: [
        { nodeId: 'N2', dof: DOFComponent.UY, value: -1000 }
      ],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.RZ, value: 0 },
      ]
    };

    const res = fem.solve(model);

    const tipUY = res.displacements.get('N2')?.UY ?? 0;
    const tipRZ = res.displacements.get('N2')?.RZ ?? 0;

    // Exact analytical delta_tip = P * L^3 / (3 * E * I)
    // P = 1000, L = 1000, E = 210000, I = 10000 => 158.7301587 mm downward (-158.7301587)
    const expectedDelta = -(1000 * Math.pow(1000, 3)) / (3 * 210000 * 10000);
    // Exact analytical theta_tip = - P * L^2 / (2 * E * I)
    const expectedTheta = -(1000 * Math.pow(1000, 2)) / (2 * 210000 * 10000);

    expect(tipUY).toBeCloseTo(expectedDelta, 5);
    expect(tipRZ).toBeCloseTo(expectedTheta, 5);
    expect(res.equilibrium.ok).toBe(true);

    // Verify recovered internal bending moment M1 at root
    const elemField = res.fields.elementFields.get('E1');
    expect(elemField).toBeDefined();
    expect(Math.abs(elemField?.internalForces?.M1 ?? 0)).toBeCloseTo(1000000, 2);
  });

  it('BEAM-002: Simply supported beam under uniform distributed load w', () => {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 1000, y: 0, z: 0 }],
        ['N3', { nodeId: 'N3', x: 2000, y: 0, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', {
          elementId: 'E1',
          nodeIds: ['N1', 'N2'],
          materialId: 'M1',
          sectionId: 'S1',
          formulationId: 'BEAM_2D',
          distributedLoad: -2.0
        }],
        ['E2', {
          elementId: 'E2',
          nodeIds: ['N2', 'N3'],
          materialId: 'M1',
          sectionId: 'S1',
          formulationId: 'BEAM_2D',
          distributedLoad: -2.0
        }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1', area: 200, I: 50000, iy: 20 }]
      ]),
      loads: [],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N3', dof: DOFComponent.UY, value: 0 },
      ]
    };

    const res = fem.solve(model);

    const midspanUY = res.displacements.get('N2')?.UY ?? 0;
    // Exact delta_mid = 5 * w * L^4 / (384 * E * I)
    // w = 2, L = 2000, E = 200000, I = 50000 => 41.6666667 mm
    const expectedDelta = -(5 * 2.0 * Math.pow(2000, 4)) / (384 * 200000 * 50000);

    expect(midspanUY).toBeCloseTo(expectedDelta, 4);
    expect(res.equilibrium.ok).toBe(true);
  });

  it('BEAM-003: Beam axial response test (EA/L comparison)', () => {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 500, y: 0, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', {
          elementId: 'E1',
          nodeIds: ['N1', 'N2'],
          materialId: 'M1',
          sectionId: 'S1',
          formulationId: 'BEAM_2D'
        }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1', area: 100, I: 10000 }]
      ]),
      loads: [
        { nodeId: 'N2', dof: DOFComponent.UX, value: 10000 }
      ],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.RZ, value: 0 },
      ]
    };

    const res = fem.solve(model);
    const tipUX = res.displacements.get('N2')?.UX ?? 0;
    // delta = P * L / (E * A) = 10000 * 500 / (200000 * 100) = 0.25 mm
    expect(tipUX).toBeCloseTo(0.25, 6);
  });

  it('BEAM-004: Pure rotation / tip moment test', () => {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 1000, y: 0, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', {
          elementId: 'E1',
          nodeIds: ['N1', 'N2'],
          materialId: 'M1',
          sectionId: 'S1',
          formulationId: 'BEAM_2D'
        }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1', area: 100, I: 10000 }]
      ]),
      loads: [
        { nodeId: 'N2', dof: DOFComponent.RZ, value: 100000 }
      ],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.RZ, value: 0 },
      ]
    };

    const res = fem.solve(model);
    const tipRZ = res.displacements.get('N2')?.RZ ?? 0;
    const tipUY = res.displacements.get('N2')?.UY ?? 0;

    // theta_tip = M0 * L / (E * I) = 100000 * 1000 / (200000 * 10000) = 0.05 rad
    // delta_tip = M0 * L^2 / (2 * E * I) = 100000 * 1000^2 / (2 * 200000 * 10000) = 25 mm
    expect(tipRZ).toBeCloseTo(0.05, 6);
    expect(tipUY).toBeCloseTo(25, 6);
  });

  it('FRAME-001: Horizontal frame member under axial tension', () => {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 1000, y: 0, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', {
          elementId: 'E1',
          nodeIds: ['N1', 'N2'],
          materialId: 'M1',
          sectionId: 'S1',
          formulationId: 'FRAME_2D'
        }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1', area: 100, I: 10000 }]
      ]),
      loads: [
        { nodeId: 'N2', dof: DOFComponent.UX, value: 20000 }
      ],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.RZ, value: 0 },
      ]
    };

    const res = fem.solve(model);
    const tipUX = res.displacements.get('N2')?.UX ?? 0;
    expect(tipUX).toBeCloseTo(1.0, 6);
  });

  it('FRAME-002: Inclined frame element at 45 degrees', () => {
    const fem = new FEMCore();
    const L_coord = 1000;
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: L_coord, y: L_coord, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', {
          elementId: 'E1',
          nodeIds: ['N1', 'N2'],
          materialId: 'M1',
          sectionId: 'S1',
          formulationId: 'FRAME_2D'
        }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1', area: 100, I: 10000 }]
      ]),
      loads: [
        { nodeId: 'N2', dof: DOFComponent.UX, value: 10000 / Math.SQRT2 },
        { nodeId: 'N2', dof: DOFComponent.UY, value: 10000 / Math.SQRT2 },
      ],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.RZ, value: 0 },
      ]
    };

    const res = fem.solve(model);
    const u2 = res.displacements.get('N2')?.UX ?? 0;
    const v2 = res.displacements.get('N2')?.UY ?? 0;

    // Total displacement along axis = sqrt(u^2 + v^2)
    const deltaMag = Math.sqrt(u2 * u2 + v2 * v2);
    // Exact delta = P * L / (E * A) = 10000 * (1000 * sqrt(2)) / (200000 * 100) = 0.70710678 mm
    const expectedDelta = (10000 * 1000 * Math.SQRT2) / (200000 * 100);

    expect(deltaMag).toBeCloseTo(expectedDelta, 5);
    expect(u2).toBeCloseTo(v2, 5); // Symmetry at 45 deg
  });

  it('FRAME-003: Vertical frame column under transverse x-load', () => {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 0, y: 1000, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', {
          elementId: 'E1',
          nodeIds: ['N1', 'N2'],
          materialId: 'M1',
          sectionId: 'S1',
          formulationId: 'FRAME_2D'
        }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1', area: 100, I: 10000 }]
      ]),
      loads: [
        { nodeId: 'N2', dof: DOFComponent.UX, value: 500 }
      ],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.RZ, value: 0 },
      ]
    };

    const res = fem.solve(model);
    const tipUX = res.displacements.get('N2')?.UX ?? 0;
    // delta = Fx * L^3 / (3 * E * I) = 500 * 1000^3 / (3 * 200000 * 10000) = 83.333333 mm
    expect(tipUX).toBeCloseTo(83.333333, 4);
  });

  it('FRAME-004: Simple 2D portal frame equilibrium and static force balance', () => {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 0, y: 1000, z: 0 }],
        ['N3', { nodeId: 'N3', x: 1000, y: 1000, z: 0 }],
        ['N4', { nodeId: 'N4', x: 1000, y: 0, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2'], materialId: 'M1', sectionId: 'S1', formulationId: 'FRAME_2D' }],
        ['E2', { elementId: 'E2', nodeIds: ['N2', 'N3'], materialId: 'M1', sectionId: 'S1', formulationId: 'FRAME_2D' }],
        ['E3', { elementId: 'E3', nodeIds: ['N3', 'N4'], materialId: 'M1', sectionId: 'S1', formulationId: 'FRAME_2D' }],
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1', area: 150, I: 20000 }]
      ]),
      loads: [
        { nodeId: 'N2', dof: DOFComponent.UX, value: 1000 }
      ],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.RZ, value: 0 },
        { nodeId: 'N4', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N4', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N4', dof: DOFComponent.RZ, value: 0 },
      ]
    };

    const res = fem.solve(model);
    expect(res.equilibrium.ok).toBe(true);
    expect(res.energy.ok).toBe(true);
  });

  it('LOAD-001: Equivalent distributed load resultant and moment balance', () => {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 1000, y: 0, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', {
          elementId: 'E1',
          nodeIds: ['N1', 'N2'],
          materialId: 'M1',
          sectionId: 'S1',
          formulationId: 'BEAM_2D',
          distributedLoad: -5.0
        }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1', area: 100, I: 10000 }]
      ]),
      loads: [],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.RZ, value: 0 },
        { nodeId: 'N2', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N2', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N2', dof: DOFComponent.RZ, value: 0 },
      ]
    };

    const res = fem.solve(model);
    // Total vertical load resultant = 5 * 1000 = 5000 N
    // Reactions at N1 and N2 should be 2500 N each
    const r1_y = res.reactions[res.K_sparse.rows > 0 ? fem.getDOFManager().getDOF('N1', DOFComponent.UY)!.globalId : 0];
    const r2_y = res.reactions[res.K_sparse.rows > 0 ? fem.getDOFManager().getDOF('N2', DOFComponent.UY)!.globalId : 0];

    expect(r1_y + r2_y).toBeCloseTo(5000, 2);
  });

  it('BC-001: Prescribed non-zero boundary condition enforcement', () => {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 1000, y: 0, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', {
          elementId: 'E1',
          nodeIds: ['N1', 'N2'],
          materialId: 'M1',
          sectionId: 'S1',
          formulationId: 'BEAM_2D'
        }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1', area: 100, I: 10000 }]
      ]),
      loads: [],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.RZ, value: 0 },
        { nodeId: 'N2', dof: DOFComponent.UY, value: -5.0 }, // Prescribed settlement
      ]
    };

    const res = fem.solve(model);
    const uY2 = res.displacements.get('N2')?.UY ?? 0;
    expect(uY2).toBeCloseTo(-5.0, 8);
  });

  it('NUM-001: Invalid geometry/material guard rejection', () => {
    const fem = new FEMCore();
    const modelZeroLen: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 0, y: 0, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2'], materialId: 'M1', sectionId: 'S1', formulationId: 'BEAM_2D' }]
      ]),
      materials: new Map<string, FEMMaterial>([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map<string, FEMSection>([
        ['S1', { sectionId: 'S1', area: 100, I: 10000 }]
      ]),
      loads: [],
      boundaryConditions: []
    };

    expect(() => fem.solve(modelZeroLen)).toThrow('[ZERO_LENGTH_ELEMENT]');
  });

});
