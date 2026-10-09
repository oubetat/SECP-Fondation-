import { LinearStructuralSolver } from './LinearStructuralSolver';
import { StructuralModel } from './StructuralModel';
import { ElementInput, NodalLoadInput, NodeInput, PrescribedDisplacementInput } from './types';

export interface BenchmarkMeshReport {
  meshType: string;
  nodeCount: number;
  elementCount: number;
  dofCount: number;
  nnz: number;
  assemblyTimeMs: number;
  factorizationTimeMs: number;
  solveTimeMs: number;
  totalTimeMs: number;
  matrixMemoryBytes: number;
  factorizationMemoryBytes: number;
  fillInRatio: number;
  verified: boolean;
}

export class SolverBenchmarkRunner {
  static runAllBenchmarks(): BenchmarkMeshReport[] {
    const solver = new LinearStructuralSolver();
    const reports: BenchmarkMeshReport[] = [];

    // 1. 1D Bar Mesh (10 Elements, 11 Nodes)
    const barNodes: NodeInput[] = [];
    for (let i = 0; i <= 10; i++) {
      barNodes.push({ id: `N${i}`, index: i, coordinates: [i * 0.1] });
    }
    const barElements: ElementInput[] = [];
    for (let e = 0; e < 10; e++) {
      barElements.push({
        id: `E${e}`,
        type: 'BAR2',
        nodeIds: [`N${e}`, `N${e + 1}`],
        material: { E: 200e9, area: 0.01 }
      });
    }
    const barLoads: NodalLoadInput[] = [{ nodeId: 'N10', dof: 'UX', magnitude: 5000 }];
    const barBC: PrescribedDisplacementInput[] = [{ nodeId: 'N0', dof: 'UX', value: 0 }];

    const barModel = new StructuralModel('BENCH_BAR1D', barNodes, barElements, barLoads, barBC);
    const barSol = solver.solve(barModel);

    reports.push({
      meshType: '1D_BAR',
      nodeCount: barNodes.length,
      elementCount: barElements.length,
      dofCount: barSol.displacements.length,
      nnz: barSol.performanceStats.originalNNZ,
      assemblyTimeMs: barSol.performanceStats.assemblyTimeMs,
      factorizationTimeMs: barSol.performanceStats.factorizationTimeMs,
      solveTimeMs: barSol.performanceStats.solveTimeMs,
      totalTimeMs: barSol.performanceStats.totalTimeMs,
      matrixMemoryBytes: barSol.performanceStats.matrixMemoryBytes,
      factorizationMemoryBytes: barSol.performanceStats.factorizationMemoryBytes,
      fillInRatio: barSol.performanceStats.fillInRatio,
      verified: barSol.verified
    });

    // 2. 2D QUAD Mesh (3x3 grid, 9 quad elements, 16 nodes)
    const quadNodes: NodeInput[] = [];
    let nIdx = 0;
    for (let j = 0; j <= 3; j++) {
      for (let i = 0; i <= 3; i++) {
        quadNodes.push({ id: `NQ_${nIdx}`, index: nIdx, coordinates: [i * 0.333, j * 0.333] });
        nIdx++;
      }
    }
    const quadElements: ElementInput[] = [];
    let eIdx = 0;
    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 3; i++) {
        const n0 = j * 4 + i;
        const n1 = j * 4 + (i + 1);
        const n2 = (j + 1) * 4 + (i + 1);
        const n3 = (j + 1) * 4 + i;
        quadElements.push({
          id: `EQ_${eIdx}`,
          type: 'QUAD4',
          nodeIds: [`NQ_${n0}`, `NQ_${n1}`, `NQ_${n2}`, `NQ_${n3}`],
          material: { E: 200e9, nu: 0.3, thickness: 0.01 }
        });
        eIdx++;
      }
    }
    // Fixed along left edge x=0 (nodes NQ_0, NQ_4, NQ_8, NQ_12)
    const quadBC: PrescribedDisplacementInput[] = [
      { nodeId: 'NQ_0', dof: 'UX', value: 0 },
      { nodeId: 'NQ_0', dof: 'UY', value: 0 },
      { nodeId: 'NQ_4', dof: 'UX', value: 0 },
      { nodeId: 'NQ_4', dof: 'UY', value: 0 },
      { nodeId: 'NQ_8', dof: 'UX', value: 0 },
      { nodeId: 'NQ_8', dof: 'UY', value: 0 },
      { nodeId: 'NQ_12', dof: 'UX', value: 0 },
      { nodeId: 'NQ_12', dof: 'UY', value: 0 }
    ];
    // Pull right edge x=1 (nodes NQ_3, NQ_7, NQ_11, NQ_15)
    const quadLoads: NodalLoadInput[] = [
      { nodeId: 'NQ_3', dof: 'UX', magnitude: 2500 },
      { nodeId: 'NQ_7', dof: 'UX', magnitude: 5000 },
      { nodeId: 'NQ_11', dof: 'UX', magnitude: 5000 },
      { nodeId: 'NQ_15', dof: 'UX', magnitude: 2500 }
    ];

    const quadModel = new StructuralModel('BENCH_QUAD2D', quadNodes, quadElements, quadLoads, quadBC);
    const quadSol = solver.solve(quadModel);

    reports.push({
      meshType: '2D_QUAD4',
      nodeCount: quadNodes.length,
      elementCount: quadElements.length,
      dofCount: quadSol.displacements.length,
      nnz: quadSol.performanceStats.originalNNZ,
      assemblyTimeMs: quadSol.performanceStats.assemblyTimeMs,
      factorizationTimeMs: quadSol.performanceStats.factorizationTimeMs,
      solveTimeMs: quadSol.performanceStats.solveTimeMs,
      totalTimeMs: quadSol.performanceStats.totalTimeMs,
      matrixMemoryBytes: quadSol.performanceStats.matrixMemoryBytes,
      factorizationMemoryBytes: quadSol.performanceStats.factorizationMemoryBytes,
      fillInRatio: quadSol.performanceStats.fillInRatio,
      verified: quadSol.verified
    });

    return reports;
  }
}
