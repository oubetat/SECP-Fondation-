/**
 * SECP Industrial OS — Engineering Truth OS
 * BucklingAdversarial.test.ts
 * 
 * Adversarial & Failure Diagnosis Test Suite for SECP-FEM-UPGRADE-006.
 */

import { describe, it, expect } from 'vitest';
import { LinearBucklingAnalysis } from '../LinearBucklingAnalysis';
import { DOFComponent, FEMModel } from '../../core/FEMTypes';

describe('SECP-FEM-UPGRADE-006: Adversarial & Failure Diagnosis Tests', () => {
  const analysis = new LinearBucklingAnalysis();

  it('ADV-BUCK-001: Rejects model under tensile load (no compressive stress state)', () => {
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
        { nodeId: 'N2', dof: DOFComponent.UY, value: 5000 } // Tension force +5000 N
      ],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.RZ, value: 0 }
      ]
    };

    expect(() => analysis.runBucklingAnalysis(model)).toThrow('[NO_COMPRESSIVE_STRESS_STATE]');
  });

  it('ADV-BUCK-002: Rejects empty model or zero length element', () => {
    const emptyModel: FEMModel = {
      nodes: new Map(),
      elements: new Map(),
      materials: new Map(),
      sections: new Map(),
      loads: [],
      boundaryConditions: []
    };

    expect(() => analysis.runBucklingAnalysis(emptyModel)).toThrow('[EMPTY_MODEL_ERROR]');

    const zeroLenModel: FEMModel = {
      nodes: new Map([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 0, y: 0, z: 0 }]
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
        { nodeId: 'N2', dof: DOFComponent.UY, value: -1000 }
      ],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 }
      ]
    };

    expect(() => analysis.runBucklingAnalysis(zeroLenModel)).toThrow('[ZERO_LENGTH_ELEMENT]');
  });

  it('ADV-BUCK-003: Rejects unconstrained rigid body mechanism during static or eigenvalue solve', () => {
    // Column with no boundary conditions at all
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
        { nodeId: 'N2', dof: DOFComponent.UY, value: -1000 }
      ],
      boundaryConditions: [] // Missing BCs -> Singular matrix
    };

    expect(() => analysis.runBucklingAnalysis(model)).toThrow();
  });

  it('ADV-BUCK-004: Detects and rejects unsupported element types', () => {
    const model: FEMModel = {
      nodes: new Map([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 100, y: 0, z: 0 }],
        ['N3', { nodeId: 'N3', x: 100, y: 100, z: 0 }],
        ['N4', { nodeId: 'N4', x: 0, y: 100, z: 0 }]
      ]),
      elements: new Map([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2', 'N4'], materialId: 'M1', sectionId: 'S1', formulationId: 'CST_2D' }],
        ['E2', { elementId: 'E2', nodeIds: ['N2', 'N3', 'N4'], materialId: 'M1', sectionId: 'S1', formulationId: 'CST_2D' }]
      ]),
      materials: new Map([
        ['M1', { materialId: 'M1', E: 200000, nu: 0.3 }]
      ]),
      sections: new Map([
        ['S1', { sectionId: 'S1', thickness: 10 }]
      ]),
      loads: [
        { nodeId: 'N2', dof: DOFComponent.UX, value: -1000 },
        { nodeId: 'N3', dof: DOFComponent.UX, value: -1000 }
      ],
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N4', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N4', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N2', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N3', dof: DOFComponent.UY, value: 0 }
      ]
    };

    expect(() => analysis.runBucklingAnalysis(model)).toThrow('[UNSUPPORTED_ELEMENT_FOR_BUCKLING]');
  });
});
