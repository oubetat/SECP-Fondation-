/**
 * SECP Industrial OS — Engineering Truth OS
 * LinearBucklingAnalysis.test.ts
 * 
 * Integration Test Suite for LinearBucklingAnalysis (SECP-FEM-UPGRADE-006).
 */

import { describe, it, expect } from 'vitest';
import { LinearBucklingAnalysis } from '../LinearBucklingAnalysis';
import { DOFComponent, FEMModel } from '../../core/FEMTypes';

describe('SECP-FEM-UPGRADE-006: LinearBucklingAnalysis Engine Integration', () => {
  const analysis = new LinearBucklingAnalysis();

  it('throws error when attempting buckling analysis on a model without compressive loads', () => {
    // Column under tension (+10,000 N)
    const model: FEMModel = {
      nodes: new Map([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 0, y: 1000, z: 0 }]
      ]),
      elements: new Map([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2'], materialId: 'M1', sectionId: 'S1', formulationId: 'BEAM_2D' }]
      ]),
      materials: new Map([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map([
        ['S1', { sectionId: 'S1', area: 100, I: 833.333 }]
      ]),
      loads: [
        { nodeId: 'N2', dof: DOFComponent.UY, value: 10000 } // Tension (+10000 N)
      ],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.RZ, value: 0 }
      ]
    };

    expect(() => analysis.runBucklingAnalysis(model)).toThrow('[NO_COMPRESSIVE_STRESS_STATE]');
  });

  it('runs complete buckling analysis on a 4-element column and recovers converged buckling modes', () => {
    // Column L = 1000 mm, E = 200,000 MPa, I = 833.333 mm^4
    // Pinned-Pinned boundary conditions (K_eff = 1.0)
    // Analytical P_cr = pi^2 * E * I / L^2 = pi^2 * 200,000 * 833.333 / 1000^2 = 1,644.934 N
    const L = 1000;
    const numElems = 4;
    const dL = L / numElems;

    const nodes = new Map();
    for (let i = 0; i <= numElems; i++) {
      nodes.set(`N${i+1}`, { nodeId: `N${i+1}`, x: 0, y: i * dL, z: 0 });
    }

    const elements = new Map();
    for (let i = 0; i < numElems; i++) {
      elements.set(`E${i+1}`, {
        elementId: `E${i+1}`,
        nodeIds: [`N${i+1}`, `N${i+2}`],
        materialId: 'M1',
        sectionId: 'S1',
        formulationId: 'FRAME_2D'
      });
    }

    const model: FEMModel = {
      nodes,
      elements,
      materials: new Map([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map([
        ['S1', { sectionId: 'S1', area: 100, I: 833.3333333333334 }]
      ]),
      loads: [
        { nodeId: `N${numElems+1}`, dof: DOFComponent.UY, value: -1000 } // Compressive P_ref = 1000 N
      ],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: `N${numElems+1}`, dof: DOFComponent.UX, value: 0 }
      ]
    };

    const res = analysis.runBucklingAnalysis(model, { numModes: 2 });

    expect(res.solverStatus).toBe('QUALIFIED_WITHIN_DECLARED_SCOPE');
    expect(res.modes.length).toBe(2);

    const mode1 = res.modes[0];
    expect(mode1.modeIndex).toBe(1);
    expect(mode1.convergenceStatus).toBe('CONVERGED');
    expect(mode1.verificationStatus).toBe('VERIFIED');

    // Compare with analytical Euler load: 1,644.934 N
    const P_analytical = (Math.PI * Math.PI * 200000 * 833.3333333333334) / (L * L);
    const relError = Math.abs(mode1.criticalLoad - P_analytical) / P_analytical;

    expect(relError).toBeLessThan(0.02); // Under 2% error for 4 elements
  });
});
