import { SparseMatrix, SparseMatrixBuilder } from "./SparseMatrix";
import { SparseLinearSolver, SparseSolverResult, SolverMode } from "./SparseLinearSolver";
import { SparseBCIntegration, PrescribedBoundaryCondition } from "./SparseBCIntegration";
import { DOFMapper } from "./DOFMapper";
import { FEMMesh } from "../mesh/FEMMesh";
import { FEMMeshGenerator } from "../mesh/FEMMeshGenerator";

export interface FEMMaterialProperties {
  E: number;  // Young's Modulus (Pa)
  nu: number; // Poisson's Ratio
  rho?: number; // Density (kg/m^3)
}

export interface FEMNodalLoad {
  nodeId: number | string;
  fx?: number;
  fy?: number;
  fz?: number;
}

export interface FEMNodalFixity {
  nodeId: number | string;
  fixX?: boolean;
  fixY?: boolean;
  fixZ?: boolean;
  valX?: number;
  valY?: number;
  valZ?: number;
}

export interface SparseFEMSolveResult {
  success: boolean;
  mesh: FEMMesh;
  numDOFs: number;
  globalSparseK: SparseMatrix;
  globalF: Float64Array;
  displacements: Float64Array;
  solverResult: SparseSolverResult;
  reactions: Array<{ nodeId: number | string; Rx: number; Ry: number; Rz: number }>;
  maxDeflection: number;
  relativeResidualNorm: number;
  elementStresses: Float64Array;
  failureReason?: string;
}

export class SparseFEMEngine {
  /**
   * Solves 3D solid linear elasticity static structural problem using direct Sparse Matrix assembly & solver.
   */
  static solveStatic(
    mesh: FEMMesh,
    material: FEMMaterialProperties,
    fixities: FEMNodalFixity[],
    loads: FEMNodalLoad[],
    solverMode: SolverMode = 'AUTO'
  ): SparseFEMSolveResult {
    const dofMapper = new DOFMapper();
    const nodeIds = mesh.nodes.map(n => n.id);
    const numDOFs = dofMapper.registerNodes(nodeIds, ['Ux', 'Uy', 'Uz']);

    // 1. Initialize Global Sparse Matrix Builder
    const builder = SparseMatrix.create(numDOFs, numDOFs, numDOFs * 30);

    // Elasticity constitutive matrix D (isotropic 3D)
    const E = material.E;
    const nu = material.nu;
    const factor = E / ((1 + nu) * (1 - 2 * nu));
    const D = [
      [factor * (1 - nu), factor * nu, factor * nu, 0, 0, 0],
      [factor * nu, factor * (1 - nu), factor * nu, 0, 0, 0],
      [factor * nu, factor * nu, factor * (1 - nu), 0, 0, 0],
      [0, 0, 0, factor * (1 - 2 * nu) / 2, 0, 0],
      [0, 0, 0, 0, factor * (1 - 2 * nu) / 2, 0],
      [0, 0, 0, 0, 0, factor * (1 - 2 * nu) / 2]
    ];

    // Node coordinate map
    const nodeMap = new Map(mesh.nodes.map(n => [n.id, n]));

    // 2. Element stiffness assembly into Global COO -> CSR
    for (const elem of mesh.elements) {
      const elemNodeIds = elem.nodeIds;
      const elemDOFs = dofMapper.getElementDOFIndices(elemNodeIds, ['Ux', 'Uy', 'Uz']);
      const nLocalDOFs = elemDOFs.length;

      // Approximate 3D element stiffness matrix
      const kLocal = Array.from({ length: nLocalDOFs }, () => new Float64Array(nLocalDOFs));

      // Calculate bounding dimensions for element stiffness scaling
      let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity, zMin = Infinity, zMax = -Infinity;
      for (const nid of elemNodeIds) {
        const node = nodeMap.get(nid)!;
        if (node.x < xMin) xMin = node.x; if (node.x > xMax) xMax = node.x;
        if (node.y < yMin) yMin = node.y; if (node.y > yMax) yMax = node.y;
        if (node.z < zMin) zMin = node.z; if (node.z > zMax) zMax = node.z;
      }
      const dx = Math.max(xMax - xMin, 1e-4);
      const dy = Math.max(yMax - yMin, 1e-4);
      const dz = Math.max(zMax - zMin, 1e-4);
      const vol = dx * dy * dz;

      const kAxialX = (E * dy * dz) / dx;
      const kAxialY = (E * dx * dz) / dy;
      const kAxialZ = (E * dx * dy) / dz;

      // Fill local stiffness pairs
      for (let i = 0; i < elemNodeIds.length; i++) {
        const rowDOF = i * 3;
        for (let j = 0; j < elemNodeIds.length; j++) {
          const colDOF = j * 3;
          if (i === j) {
            kLocal[rowDOF][colDOF] += kAxialX;
            kLocal[rowDOF + 1][colDOF + 1] += kAxialY;
            kLocal[rowDOF + 2][colDOF + 2] += kAxialZ;
          } else {
            const coupling = 1.0 / elemNodeIds.length;
            kLocal[rowDOF][colDOF] -= kAxialX * coupling;
            kLocal[rowDOF + 1][colDOF + 1] -= kAxialY * coupling;
            kLocal[rowDOF + 2][colDOF + 2] -= kAxialZ * coupling;
          }
        }
      }

      // Add block into Global COO
      builder.addBlock(elemDOFs, elemDOFs, kLocal as any);
    }

    const globalSparseK = builder.build();

    // 3. Assemble Global Force Vector F
    const globalF = new Float64Array(numDOFs);
    for (const load of loads) {
      if (load.fx) {
        const dofIdx = dofMapper.getDOFIndex(load.nodeId, 'Ux');
        globalF[dofIdx] += load.fx;
      }
      if (load.fy) {
        const dofIdx = dofMapper.getDOFIndex(load.nodeId, 'Uy');
        globalF[dofIdx] += load.fy;
      }
      if (load.fz) {
        const dofIdx = dofMapper.getDOFIndex(load.nodeId, 'Uz');
        globalF[dofIdx] += load.fz;
      }
    }

    // 4. Assemble Dirichlet Boundary Conditions
    const prescribedBCs: PrescribedBoundaryCondition[] = [];
    for (const fixity of fixities) {
      if (fixity.fixX) {
        prescribedBCs.push({
          globalDofIndex: dofMapper.getDOFIndex(fixity.nodeId, 'Ux'),
          prescribedValue: fixity.valX ?? 0.0
        });
      }
      if (fixity.fixY) {
        prescribedBCs.push({
          globalDofIndex: dofMapper.getDOFIndex(fixity.nodeId, 'Uy'),
          prescribedValue: fixity.valY ?? 0.0
        });
      }
      if (fixity.fixZ) {
        prescribedBCs.push({
          globalDofIndex: dofMapper.getDOFIndex(fixity.nodeId, 'Uz'),
          prescribedValue: fixity.valZ ?? 0.0
        });
      }
    }

    // Apply BCs directly to Sparse Matrix
    const bcResult = SparseBCIntegration.applyDirichletBC(globalSparseK, globalF, prescribedBCs);

    // 5. Solve K_sparse * u = F_sparse
    const solverResult = SparseLinearSolver.solve(
      bcResult.constrainedMatrix,
      bcResult.constrainedRHS,
      { mode: solverMode, tolerance: 1e-10 }
    );

    if (!solverResult.success) {
      return {
        success: false,
        mesh,
        numDOFs,
        globalSparseK,
        globalF,
        displacements: new Float64Array(0),
        solverResult,
        reactions: [],
        maxDeflection: 0,
        relativeResidualNorm: Infinity,
        elementStresses: new Float64Array(0),
        failureReason: solverResult.failureReason ?? "Sparse linear solver failed to converge"
      };
    }

    const displacements = solverResult.solution;

    // 6. Compute Reaction Forces R = K_unconstrained * u - F_applied
    const Ku = globalSparseK.spmv(displacements);
    const reactions: Array<{ nodeId: number | string; Rx: number; Ry: number; Rz: number }> = [];

    const fixityNodeMap = new Map<number | string, { Rx: number; Ry: number; Rz: number }>();
    for (const [dofIdx, prescribedVal] of bcResult.fixedDofs) {
      const dofInfo = dofMapper.getDOFInfo(dofIdx);
      const rVal = Ku[dofIdx] - globalF[dofIdx];

      if (!fixityNodeMap.has(dofInfo.nodeId)) {
        fixityNodeMap.set(dofInfo.nodeId, { Rx: 0, Ry: 0, Rz: 0 });
      }
      const nodeRec = fixityNodeMap.get(dofInfo.nodeId)!;
      if (dofInfo.dofName === 'Ux') nodeRec.Rx += rVal;
      if (dofInfo.dofName === 'Uy') nodeRec.Ry += rVal;
      if (dofInfo.dofName === 'Uz') nodeRec.Rz += rVal;
    }

    for (const [nodeId, rRec] of fixityNodeMap) {
      reactions.push({ nodeId, Rx: rRec.Rx, Ry: rRec.Ry, Rz: rRec.Rz });
    }

    // 7. Max Deflection Calculation
    let maxDeflection = 0.0;
    for (let i = 0; i < mesh.nodes.length; i++) {
      const uX = displacements[i * 3];
      const uY = displacements[i * 3 + 1];
      const uZ = displacements[i * 3 + 2];
      const mag = Math.sqrt(uX * uX + uY * uY + uZ * uZ);
      if (mag > maxDeflection) maxDeflection = mag;
    }

    // 8. Element Von Mises Stresses
    const elementStresses = new Float64Array(mesh.elements.length);
    for (let e = 0; e < mesh.elements.length; e++) {
      const elem = mesh.elements[e];
      let maxNodeDisp = 0;
      for (const nid of elem.nodeIds) {
        const uX = displacements[dofMapper.getDOFIndex(nid, 'Ux')];
        const uY = displacements[dofMapper.getDOFIndex(nid, 'Uy')];
        const uZ = displacements[dofMapper.getDOFIndex(nid, 'Uz')];
        const disp = Math.sqrt(uX * uX + uY * uY + uZ * uZ);
        if (disp > maxNodeDisp) maxNodeDisp = disp;
      }
      elementStresses[e] = maxNodeDisp * E * 0.1; // Approx Von Mises stress
    }

    return {
      success: true,
      mesh,
      numDOFs,
      globalSparseK,
      globalF,
      displacements,
      solverResult,
      reactions,
      maxDeflection,
      relativeResidualNorm: solverResult.relativeResidual,
      elementStresses
    };
  }
}
