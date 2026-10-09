/**
 * SECP CAD/CAE Platform - 1D Bar Analytical Benchmark
 * PATCH-234 — Global Stiffness Assembly
 *
 * Compares FE assembled system solution u_FEM with exact analytical formula u_analytical = P*L / (A*E)
 */

import { FEMElement } from '../../mesh/FEMElement';
import { FEMNode } from '../../mesh/FEMNode';
import { GlobalStiffnessAssembler } from '../GlobalStiffnessAssembler';

export interface BarBenchmarkResult {
  length: number;
  area: number;
  E: number;
  loadP: number;
  uAnalytical: number;
  uFEM: number;
  relativeError: number;
  passed: boolean;
  elementCount: number;
  dofCount: number;
}

export class Bar1DBenchmark {
  public static runBenchmark(elementCount: number = 4, length: number = 2.0, area: number = 0.001, E: number = 210e9, loadP: number = 10000): BarBenchmarkResult {
    const nodes: FEMNode[] = [];
    const dx = length / elementCount;

    for (let i = 0; i <= elementCount; i++) {
      nodes.push({
        id: `N_${i}`,
        x: i * dx,
        y: 0,
        z: 0,
        boundaryTags: i === 0 ? ['FIXED'] : [],
        regionIds: ['REG_BAR']
      });
    }

    const elements: FEMElement[] = [];
    for (let i = 0; i < elementCount; i++) {
      elements.push({
        id: `E_${i}`,
        type: 'BAR',
        nodeIds: [`N_${i}`, `N_${i + 1}`],
        regionId: 'REG_BAR',
        materialId: 'MAT_STEEL_S355'
      });
    }

    const assembler = new GlobalStiffnessAssembler();
    assembler.setMesh({
      id: 'MESH_BAR_BENCHMARK',
      nodes,
      elements,
      boundaries: [],
      regions: [],
      timestamp: Date.now()
    });

    // Fix node 0 (UX=0, UY=0, UZ=0)
    assembler.setBoundaryCondition('N_0', 'UX', 0.0);
    assembler.setBoundaryCondition('N_0', 'UY', 0.0);
    assembler.setBoundaryCondition('N_0', 'UZ', 0.0);

    // Apply tip tensile load at last node N_elementCount
    const lastNodeId = `N_${elementCount}`;
    assembler.addNodalLoad(lastNodeId, 'UX', loadP);

    // Assemble and solve global system
    const solveResult = assembler.assembleAndSolve();

    const uAnalytical = (loadP * length) / (area * E);
    
    // Find tip displacement in UX
    const tipNodeDofs = assembler.getDOFManager().getNodeDOFs(lastNodeId);
    const tipUxIndex = tipNodeDofs.find((d) => d.field === 'UX')?.globalIndex ?? 0;
    const uFEM = solveResult.displacements[tipUxIndex] || 0;

    const relError = Math.abs(uFEM - uAnalytical) / Math.abs(uAnalytical);

    return {
      length,
      area,
      E,
      loadP,
      uAnalytical,
      uFEM,
      relativeError: relError,
      passed: relError < 0.01 && solveResult.isSolvable,
      elementCount,
      dofCount: assembler.getDOFManager().totalDOFs
    };
  }
}
