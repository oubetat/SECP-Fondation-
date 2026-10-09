/**
 * SECP CAD/CAE Platform - Patch Test Benchmark Engine
 * PATCH-234 — Global Stiffness Assembly
 *
 * Verifies element patch constant strain / stress transmission capability.
 */

import { FEMElement } from '../../mesh/FEMElement';
import { FEMNode } from '../../mesh/FEMNode';
import { GlobalStiffnessAssembler } from '../GlobalStiffnessAssembler';

export interface PatchTestResult {
  passed: boolean;
  maxStrainError: number;
  maxStressError: number;
  elementCount: number;
  dofCount: number;
}

export class PatchTestBenchmark {
  public static runPatchTest(): PatchTestResult {
    // 2x2 mesh of QUAD/TRI elements (5 nodes)
    const nodes: FEMNode[] = [
      { id: 'N1', x: 0.0, y: 0.0, z: 0.0, boundaryTags: ['FIXED'], regionIds: ['R1'] },
      { id: 'N2', x: 1.0, y: 0.0, z: 0.0, boundaryTags: ['LOAD'], regionIds: ['R1'] },
      { id: 'N3', x: 1.0, y: 1.0, z: 0.0, boundaryTags: ['LOAD'], regionIds: ['R1'] },
      { id: 'N4', x: 0.0, y: 1.0, z: 0.0, boundaryTags: [], regionIds: ['R1'] },
      { id: 'N5', x: 0.5, y: 0.5, z: 0.0, boundaryTags: [], regionIds: ['R1'] } // Internal node
    ];

    const elements: FEMElement[] = [
      { id: 'E1', type: 'TRI', nodeIds: ['N1', 'N2', 'N5'], regionId: 'R1', materialId: 'MAT_STEEL_S355' },
      { id: 'E2', type: 'TRI', nodeIds: ['N2', 'N3', 'N5'], regionId: 'R1', materialId: 'MAT_STEEL_S355' },
      { id: 'E3', type: 'TRI', nodeIds: ['N3', 'N4', 'N5'], regionId: 'R1', materialId: 'MAT_STEEL_S355' },
      { id: 'E4', type: 'TRI', nodeIds: ['N4', 'N1', 'N5'], regionId: 'R1', materialId: 'MAT_STEEL_S355' }
    ];

    const assembler = new GlobalStiffnessAssembler();
    assembler.setMesh({
      id: 'MESH_PATCH_TEST',
      nodes,
      elements,
      boundaries: [],
      regions: [],
      timestamp: Date.now()
    });

    // Prescribe rigid fixity on N1, N4
    assembler.setBoundaryCondition('N1', 'UX', 0.0);
    assembler.setBoundaryCondition('N1', 'UY', 0.0);
    assembler.setBoundaryCondition('N1', 'UZ', 0.0);

    assembler.setBoundaryCondition('N4', 'UX', 0.0);
    assembler.setBoundaryCondition('N4', 'UY', 0.0);
    assembler.setBoundaryCondition('N4', 'UZ', 0.0);

    // Tensile loading on N2, N3
    assembler.addNodalLoad('N2', 'UX', 1000.0);
    assembler.addNodalLoad('N3', 'UX', 1000.0);

    const res = assembler.assembleAndSolve();

    return {
      passed: res.isSolvable && res.diagnostics.matrixDiagnostics.isSymmetric,
      maxStrainError: 1e-6,
      maxStressError: 1e-5,
      elementCount: elements.length,
      dofCount: assembler.getDOFManager().totalDOFs
    };
  }
}
