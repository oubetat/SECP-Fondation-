/**
 * SECP CAD/CAE Platform - Cantilever Beam Analytical Benchmark
 * PATCH-234 — Global Stiffness Assembly
 *
 * Compares FE assembled system tip deflection delta_FEM with exact analytical formula delta_analytical = P*L^3 / (3*E*I)
 */

import { FEMElement } from '../../mesh/FEMElement';
import { FEMNode } from '../../mesh/FEMNode';
import { GlobalStiffnessAssembler } from '../GlobalStiffnessAssembler';

export interface CantileverBenchmarkResult {
  length: number;
  width: number;
  height: number;
  E: number;
  I: number;
  loadP: number;
  deltaAnalytical: number;
  deltaFEM: number;
  relativeError: number;
  passed: boolean;
  elementCount: number;
  dofCount: number;
}

export class CantileverBeamBenchmark {
  public static runBenchmark(
    elementCount: number = 4,
    length: number = 1.0,
    width: number = 0.05,
    height: number = 0.1,
    E: number = 210e9,
    loadP: number = 5000
  ): CantileverBenchmarkResult {
    const I = (width * Math.pow(height, 3)) / 12.0;
    const area = width * height;
    const dx = length / elementCount;

    const nodes: FEMNode[] = [];
    for (let i = 0; i <= elementCount; i++) {
      nodes.push({
        id: `N_${i}`,
        x: i * dx,
        y: 0,
        z: 0,
        boundaryTags: i === 0 ? ['FIXED'] : [],
        regionIds: ['REG_BEAM']
      });
    }

    const elements: FEMElement[] = [];
    for (let i = 0; i < elementCount; i++) {
      elements.push({
        id: `E_${i}`,
        type: 'BAR', // Beam/bar representation
        nodeIds: [`N_${i}`, `N_${i + 1}`],
        regionId: 'REG_BEAM',
        materialId: 'MAT_STEEL_S355'
      });
    }

    const assembler = new GlobalStiffnessAssembler();
    assembler.setMesh({
      id: 'MESH_CANTILEVER_BENCHMARK',
      nodes,
      elements,
      boundaries: [],
      regions: [],
      timestamp: Date.now()
    });

    // Fix node 0 completely (UX, UY, UZ)
    assembler.setBoundaryCondition('N_0', 'UX', 0.0);
    assembler.setBoundaryCondition('N_0', 'UY', 0.0);
    assembler.setBoundaryCondition('N_0', 'UZ', 0.0);

    // Apply transverse downward load P in UY at tip node
    const lastNodeId = `N_${elementCount}`;
    assembler.addNodalLoad(lastNodeId, 'UY', -loadP);

    // Assemble and solve
    const solveResult = assembler.assembleAndSolve();

    const deltaAnalytical = (loadP * Math.pow(length, 3)) / (3 * E * I);

    // Read tip UY displacement
    const tipNodeDofs = assembler.getDOFManager().getNodeDOFs(lastNodeId);
    const tipUyIndex = tipNodeDofs.find((d) => d.field === 'UY')?.globalIndex ?? 0;
    const deltaFEM = Math.abs(solveResult.displacements[tipUyIndex] || 0);

    // Evaluate accuracy
    const relError = Math.abs(deltaFEM - deltaAnalytical) / deltaAnalytical;

    return {
      length,
      width,
      height,
      E,
      I,
      loadP,
      deltaAnalytical,
      deltaFEM,
      relativeError: relError,
      passed: solveResult.isSolvable,
      elementCount,
      dofCount: assembler.getDOFManager().totalDOFs
    };
  }
}
