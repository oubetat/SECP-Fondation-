/**
 * SECP Industrial OS — Engineering Truth OS
 * runUpgrade003Campaign.ts
 * 
 * Executes SECP-FEM-UPGRADE-003: Beam & Frame Element Qualification Campaign.
 * Computes explicit relative errors, SHA-256 source fingerprints, and produces
 * SECP_FEM_UPGRADE_003_RESULTS.json and SECP_FEM_UPGRADE_003_REPORT.md.
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';
import { FEMCore } from './FEMCore';
import { DOFComponent, FEMModel, FEMNode, FEMElement, FEMMaterial, FEMSection } from './FEMTypes';

export interface CampaignTestRecord {
  testId: string;
  status: 'PASS' | 'FAIL';
  testDescription: string;
  referenceValue: number;
  computedValue: number;
  absoluteError: number;
  relativeError: number;
  tolerance: number;
  units: string;
  evidence: {
    formula: string;
    details: string;
  };
}

export function runUpgrade003Campaign() {
  console.log('================================================================================');
  console.log(' SECP INDUSTRIAL OS — FEM BEAM & FRAME ELEMENT EXPANSION (SECP-FEM-UPGRADE-003)');
  console.log('================================================================================\n');

  const records: CampaignTestRecord[] = [];

  // --- TEST BEAM-001 ---
  {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 1000, y: 0, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2'], materialId: 'M1', sectionId: 'S1', formulationId: 'BEAM_2D' }]
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
    const computed = res.displacements.get('N2')?.UY ?? 0;
    const ref = -(1000 * Math.pow(1000, 3)) / (3 * 210000 * 10000);
    const absErr = Math.abs(computed - ref);
    const relErr = absErr / Math.abs(ref);
    const tol = 1e-5;

    records.push({
      testId: 'BEAM-001',
      status: relErr <= tol ? 'PASS' : 'FAIL',
      testDescription: 'Cantilever beam under end point load',
      referenceValue: ref,
      computedValue: computed,
      absoluteError: absErr,
      relativeError: relErr,
      tolerance: tol,
      units: 'mm',
      evidence: {
        formula: 'delta_tip = P * L^3 / (3 * E * I)',
        details: `Computed tip UY = ${computed.toFixed(6)} mm, Ref = ${ref.toFixed(6)} mm`
      }
    });
  }

  // --- TEST BEAM-002 ---
  {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 1000, y: 0, z: 0 }],
        ['N3', { nodeId: 'N3', x: 2000, y: 0, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2'], materialId: 'M1', sectionId: 'S1', formulationId: 'BEAM_2D', distributedLoad: -2.0 }],
        ['E2', { elementId: 'E2', nodeIds: ['N2', 'N3'], materialId: 'M1', sectionId: 'S1', formulationId: 'BEAM_2D', distributedLoad: -2.0 }]
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
    const computed = res.displacements.get('N2')?.UY ?? 0;
    const ref = -(5 * 2.0 * Math.pow(2000, 4)) / (384 * 200000 * 50000);
    const absErr = Math.abs(computed - ref);
    const relErr = absErr / Math.abs(ref);
    const tol = 1e-4;

    records.push({
      testId: 'BEAM-002',
      status: relErr <= tol ? 'PASS' : 'FAIL',
      testDescription: 'Simply supported beam under uniform distributed load w',
      referenceValue: ref,
      computedValue: computed,
      absoluteError: absErr,
      relativeError: relErr,
      tolerance: tol,
      units: 'mm',
      evidence: {
        formula: 'delta_mid = 5 * w * L^4 / (384 * E * I)',
        details: `Computed midspan UY = ${computed.toFixed(6)} mm, Ref = ${ref.toFixed(6)} mm`
      }
    });
  }

  // --- TEST BEAM-003 ---
  {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 500, y: 0, z: 0 }],
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
    const computed = res.displacements.get('N2')?.UX ?? 0;
    const ref = (10000 * 500) / (200000 * 100);
    const absErr = Math.abs(computed - ref);
    const relErr = absErr / Math.abs(ref);
    const tol = 1e-6;

    records.push({
      testId: 'BEAM-003',
      status: relErr <= tol ? 'PASS' : 'FAIL',
      testDescription: 'Beam axial tension test (EA/L comparison)',
      referenceValue: ref,
      computedValue: computed,
      absoluteError: absErr,
      relativeError: relErr,
      tolerance: tol,
      units: 'mm',
      evidence: {
        formula: 'delta = P * L / (E * A)',
        details: `Computed axial UX = ${computed.toFixed(6)} mm, Ref = ${ref.toFixed(6)} mm`
      }
    });
  }

  // --- TEST BEAM-004 ---
  {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 1000, y: 0, z: 0 }],
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
    const computed = res.displacements.get('N2')?.RZ ?? 0;
    const ref = (100000 * 1000) / (200000 * 10000);
    const absErr = Math.abs(computed - ref);
    const relErr = absErr / Math.abs(ref);
    const tol = 1e-6;

    records.push({
      testId: 'BEAM-004',
      status: relErr <= tol ? 'PASS' : 'FAIL',
      testDescription: 'Pure rotation / tip moment test',
      referenceValue: ref,
      computedValue: computed,
      absoluteError: absErr,
      relativeError: relErr,
      tolerance: tol,
      units: 'rad',
      evidence: {
        formula: 'theta_tip = M0 * L / (E * I)',
        details: `Computed tip RZ = ${computed.toFixed(6)} rad, Ref = ${ref.toFixed(6)} rad`
      }
    });
  }

  // --- TEST FRAME-001 ---
  {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 1000, y: 0, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2'], materialId: 'M1', sectionId: 'S1', formulationId: 'FRAME_2D' }]
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
    const computed = res.displacements.get('N2')?.UX ?? 0;
    const ref = (20000 * 1000) / (200000 * 100);
    const absErr = Math.abs(computed - ref);
    const relErr = absErr / Math.abs(ref);
    const tol = 1e-6;

    records.push({
      testId: 'FRAME-001',
      status: relErr <= tol ? 'PASS' : 'FAIL',
      testDescription: 'Horizontal frame member under axial tension',
      referenceValue: ref,
      computedValue: computed,
      absoluteError: absErr,
      relativeError: relErr,
      tolerance: tol,
      units: 'mm',
      evidence: {
        formula: 'u2 = P * L / (E * A)',
        details: `Computed UX = ${computed.toFixed(6)} mm, Ref = ${ref.toFixed(6)} mm`
      }
    });
  }

  // --- TEST FRAME-002 ---
  {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 1000, y: 1000, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2'], materialId: 'M1', sectionId: 'S1', formulationId: 'FRAME_2D' }]
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
    const computed = Math.sqrt(u2 * u2 + v2 * v2);
    const ref = (10000 * 1000 * Math.SQRT2) / (200000 * 100);
    const absErr = Math.abs(computed - ref);
    const relErr = absErr / Math.abs(ref);
    const tol = 1e-5;

    records.push({
      testId: 'FRAME-002',
      status: relErr <= tol ? 'PASS' : 'FAIL',
      testDescription: 'Inclined frame element at 45 degrees',
      referenceValue: ref,
      computedValue: computed,
      absoluteError: absErr,
      relativeError: relErr,
      tolerance: tol,
      units: 'mm',
      evidence: {
        formula: 'delta_axial = P * L / (E * A)',
        details: `Computed magnitude = ${computed.toFixed(6)} mm, Ref = ${ref.toFixed(6)} mm`
      }
    });
  }

  // --- TEST FRAME-003 ---
  {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 0, y: 1000, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2'], materialId: 'M1', sectionId: 'S1', formulationId: 'FRAME_2D' }]
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
    const computed = res.displacements.get('N2')?.UX ?? 0;
    const ref = (500 * Math.pow(1000, 3)) / (3 * 200000 * 10000);
    const absErr = Math.abs(computed - ref);
    const relErr = absErr / Math.abs(ref);
    const tol = 1e-5;

    records.push({
      testId: 'FRAME-003',
      status: relErr <= tol ? 'PASS' : 'FAIL',
      testDescription: 'Vertical frame column under transverse x-load',
      referenceValue: ref,
      computedValue: computed,
      absoluteError: absErr,
      relativeError: relErr,
      tolerance: tol,
      units: 'mm',
      evidence: {
        formula: 'delta_x = Fx * L^3 / (3 * E * I)',
        details: `Computed tip UX = ${computed.toFixed(6)} mm, Ref = ${ref.toFixed(6)} mm`
      }
    });
  }

  // --- TEST FRAME-004 ---
  {
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
    const computedNorm = res.equilibrium.residualNorm;
    const ref = 0;
    const absErr = computedNorm;
    const relErr = computedNorm / 1000;
    const tol = 1e-4;

    records.push({
      testId: 'FRAME-004',
      status: res.equilibrium.ok ? 'PASS' : 'FAIL',
      testDescription: 'Simple 2D portal frame static force balance',
      referenceValue: ref,
      computedValue: computedNorm,
      absoluteError: absErr,
      relativeError: relErr,
      tolerance: tol,
      units: 'N',
      evidence: {
        formula: 'sum F_ext + sum R = 0',
        details: `Portal frame residual norm = ${computedNorm.toExponential(4)} N`
      }
    });
  }

  // --- TEST LOAD-001 ---
  {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 1000, y: 0, z: 0 }],
      ]),
      elements: new Map<string, FEMElement>([
        ['E1', { elementId: 'E1', nodeIds: ['N1', 'N2'], materialId: 'M1', sectionId: 'S1', formulationId: 'BEAM_2D', distributedLoad: -5.0 }]
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
    const r1 = res.reactions[fem.getDOFManager().getDOF('N1', DOFComponent.UY)!.globalId];
    const r2 = res.reactions[fem.getDOFManager().getDOF('N2', DOFComponent.UY)!.globalId];
    const computedTotal = r1 + r2;
    const ref = 5000; // 5 N/mm * 1000 mm
    const absErr = Math.abs(computedTotal - ref);
    const relErr = absErr / ref;
    const tol = 1e-5;

    records.push({
      testId: 'LOAD-001',
      status: relErr <= tol ? 'PASS' : 'FAIL',
      testDescription: 'Transverse distributed load resultant balance',
      referenceValue: ref,
      computedValue: computedTotal,
      absoluteError: absErr,
      relativeError: relErr,
      tolerance: tol,
      units: 'N',
      evidence: {
        formula: 'sum R_y = w * L',
        details: `Reaction total = ${computedTotal.toFixed(4)} N, Ref = ${ref.toFixed(4)} N`
      }
    });
  }

  // --- TEST BC-001 ---
  {
    const fem = new FEMCore();
    const model: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 1000, y: 0, z: 0 }],
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
      boundaryConditions: [
        { nodeId: 'N1', dof: DOFComponent.UX, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.UY, value: 0 },
        { nodeId: 'N1', dof: DOFComponent.RZ, value: 0 },
        { nodeId: 'N2', dof: DOFComponent.UY, value: -5.0 },
      ]
    };

    const res = fem.solve(model);
    const computed = res.displacements.get('N2')?.UY ?? 0;
    const ref = -5.0;
    const absErr = Math.abs(computed - ref);
    const relErr = absErr / Math.abs(ref);
    const tol = 1e-8;

    records.push({
      testId: 'BC-001',
      status: relErr <= tol ? 'PASS' : 'FAIL',
      testDescription: 'Prescribed settlement boundary condition enforcement',
      referenceValue: ref,
      computedValue: computed,
      absoluteError: absErr,
      relativeError: relErr,
      tolerance: tol,
      units: 'mm',
      evidence: {
        formula: 'u_prescribed = -5.0 mm',
        details: `Computed UY = ${computed.toFixed(8)} mm`
      }
    });
  }

  // --- TEST SOLVER-001 ---
  {
    const fem = new FEMCore();
    const modelUnstable: FEMModel = {
      nodes: new Map<string, FEMNode>([
        ['N1', { nodeId: 'N1', x: 0, y: 0, z: 0 }],
        ['N2', { nodeId: 'N2', x: 1000, y: 0, z: 0 }],
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
      loads: [{ nodeId: 'N2', dof: DOFComponent.UY, value: 100 }],
      boundaryConditions: [] // Unconstrained system
    };

    let caught = false;
    try {
      fem.solve(modelUnstable);
    } catch (e: any) {
      caught = true;
    }

    records.push({
      testId: 'SOLVER-001',
      status: caught ? 'PASS' : 'FAIL',
      testDescription: 'Unconstrained / singular system diagnostic rejection',
      referenceValue: 1.0,
      computedValue: caught ? 1.0 : 0.0,
      absoluteError: 0,
      relativeError: 0,
      tolerance: 0,
      units: 'boolean',
      evidence: {
        formula: 'det(K) = 0 => Singular System Exception',
        details: `System correctly caught unconstrained singularity: ${caught}`
      }
    });
  }

  // --- TEST NUM-001 ---
  {
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

    let caught = false;
    try {
      fem.solve(modelZeroLen);
    } catch (e: any) {
      if (e.message.includes('[ZERO_LENGTH_ELEMENT]')) caught = true;
    }

    records.push({
      testId: 'NUM-001',
      status: caught ? 'PASS' : 'FAIL',
      testDescription: 'Degenerate zero-length geometry guard',
      referenceValue: 1.0,
      computedValue: caught ? 1.0 : 0.0,
      absoluteError: 0,
      relativeError: 0,
      tolerance: 0,
      units: 'boolean',
      evidence: {
        formula: 'L <= 0 => throw [ZERO_LENGTH_ELEMENT]',
        details: `Zero-length guard threw expected error: ${caught}`
      }
    });
  }

  // Calculate hashes
  const filesToHash = [
    'src/engine/fem/core/Beam2DFormulation.ts',
    'src/engine/fem/core/Frame2DFormulation.ts',
    'src/engine/fem/core/FEMTypes.ts',
    'src/engine/fem/core/FEMDOFManager.ts',
    'src/engine/fem/core/FEMCore.ts'
  ];

  const sourceHashes: Record<string, string> = {};
  for (const relPath of filesToHash) {
    const fullPath = join(process.cwd(), relPath);
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, 'utf8');
      sourceHashes[relPath] = createHash('sha256').update(content).digest('hex');
    }
  }

  const passedCount = records.filter(r => r.status === 'PASS').length;
  const totalCount = records.length;
  const overallStatus = passedCount === totalCount ? 'QUALIFIED_AND_VERIFIED' : 'FAILED';

  const campaignResult = {
    campaignId: 'SECP-FEM-UPGRADE-003',
    title: 'Beam & Frame Element Formulation Expansion',
    status: overallStatus,
    summary: {
      totalTests: totalCount,
      passedTests: passedCount,
      failedTests: totalCount - passedCount,
    },
    sourceHashes,
    testRecords: records
  };

  const artifactDir = join(process.cwd(), '.aistudio/artifacts/brain/9f1187ef-79ca-4cd8-9909-157bcf9db814');

  writeFileSync(
    join(artifactDir, 'SECP_FEM_UPGRADE_003_RESULTS.json'),
    JSON.stringify(campaignResult, null, 2),
    'utf8'
  );

  let reportMd = `# SECP Industrial OS — SECP-FEM-UPGRADE-003 Verification Report
## Beam & Frame Element Formulation Expansion

- **Campaign Status**: **${overallStatus}** (${passedCount}/${totalCount} tests passed)
- **Scope**: 2D Euler-Bernoulli Beam (\`BEAM_2D\`) & 2D Frame (\`FRAME_2D\`) elements with rotational DOFs (\`RZ\`).
- **Date**: ${new Date().toISOString()}

### Source Code SHA-256 Fingerprints
${Object.entries(sourceHashes).map(([file, hash]) => `- \`${file}\`: \`${hash}\``).join('\n')}

---

### Campaign Qualification Results

| Test ID | Status | Description | Reference Value | Computed Value | Abs Error | Rel Error | Tolerance | Units |
|---------|--------|-------------|-----------------|----------------|-----------|-----------|-----------|-------|
${records.map(r => `| **${r.testId}** | \`${r.status}\` | ${r.testDescription} | ${r.referenceValue.toExponential(4)} | ${r.computedValue.toExponential(4)} | ${r.absoluteError.toExponential(2)} | ${r.relativeError.toExponential(2)} | ${r.tolerance.toExponential(1)} | ${r.units} |`).join('\n')}

---

### Engineering Capabilities Added
1. **BEAM_2D Element Formulation**:
   - 2 nodes, 3 DOFs per node (\`UX\`, \`UY\`, \`RZ\`).
   - Exact local stiffness matrix for axial strain ($EA/L$) and Euler-Bernoulli bending bending stiffness ($12EI/L^3, 6EI/L^2, 4EI/L, 2EI/L$).
   - Equivalent nodal loads for uniform transverse distributed load $w$.

2. **FRAME_2D Element Formulation**:
   - Arbitrary orientation in 2D x-y plane.
   - Transformation matrix $\\mathbf{T}$ converting local displacements/forces to global space via $\\mathbf{K}_{global} = \\mathbf{T}^T \\mathbf{K}_{local} \\mathbf{T}$.
   - Rotational DOF coupling and internal force recovery ($N, V_1, V_2, M_1, M_2, M_{mid}$).

3. **Dynamic Per-Node DOF Management**:
   - \`FEMDOFManager\` assigns rotational DOFs dynamically per node based on connected element formulations, avoiding zero-stiffness rows.

4. **Moment & Rotational Equilibrium**:
   - Verification engine updated to check rotational moment equilibrium $\\sum M_z = 0$ including direct nodal reaction moments $R_z$.

`;

  writeFileSync(
    join(artifactDir, 'SECP_FEM_UPGRADE_003_REPORT.md'),
    reportMd,
    'utf8'
  );

  console.log(`Campaign execution finished. Results: ${passedCount}/${totalCount} passed (${overallStatus}).`);
  console.log(`Saved SECP_FEM_UPGRADE_003_RESULTS.json and SECP_FEM_UPGRADE_003_REPORT.md.`);
}

runUpgrade003Campaign();
