import { SparseMatrix } from "../sparse/SparseMatrix";
import { DOFMapper } from "../sparse/DOFMapper";
import { SparseBCIntegration, PrescribedBoundaryCondition } from "../sparse/SparseBCIntegration";
import { FEMMesh } from "../mesh/FEMMesh";
import { LinearSolverSelector, SolverPolicyResult } from "./LinearSolverSelector";
import { SolverName, LinearSolverResult, LinearSolverOptions } from "./LinearSolverTypes";

export interface FEMMaterialProperties {
  E: number;  // Young's Modulus (Pa)
  nu: number; // Poisson's Ratio
  rho?: number; // Density
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

export interface FEMLinearSolveResult {
  success: boolean;
  mesh: FEMMesh;
  numDOFs: number;
  globalSparseK: SparseMatrix;
  globalF: Float64Array;
  displacements: Float64Array;
  reactions: Array<{ nodeId: number | string; Rx: number; Ry: number; Rz: number }>;
  maxDeflection: number;
  trueResidualNorm: number;
  relativeResidual: number;
  solverPolicyResult: SolverPolicyResult;
  failureReason?: string;
}

export class FEMLinearSolverAdapter {
  /**
   * Complete static structural FEM pipeline driven by PATCH-237 Linear Solver Engine
   */
  static solveStaticSystem(
    mesh: FEMMesh,
    material: FEMMaterialProperties,
    fixities: FEMNodalFixity[],
    loads: FEMNodalLoad[],
    solverPreference: SolverName | 'AUTO' = 'AUTO',
    solverOptions: LinearSolverOptions = {}
  ): FEMLinearSolveResult {
    const dofMapper = new DOFMapper();
    const nodeIds = mesh.nodes.map(n => n.id);
    const numDOFs = dofMapper.registerNodes(nodeIds, ['Ux', 'Uy', 'Uz']);

    // 1. Initialize Global Sparse Matrix Builder
    const builder = SparseMatrix.create(numDOFs, numDOFs, numDOFs * 30);

    // Node coordinate lookup
    const nodeMap = new Map(mesh.nodes.map(n => [n.id, n]));

    const E = material.E;
    const nu = material.nu;

    // 2. Element stiffness assembly into Global COO -> CSR
    for (const elem of mesh.elements) {
      const elemNodeIds = elem.nodeIds;
      const elemDOFs = dofMapper.getElementDOFIndices(elemNodeIds, ['Ux', 'Uy', 'Uz']);
      const nLocalDOFs = elemDOFs.length;

      const kLocal = Array.from({ length: nLocalDOFs }, () => new Float64Array(nLocalDOFs));

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

      const kAxialX = (E * dy * dz) / dx;
      const kAxialY = (E * dx * dz) / dy;
      const kAxialZ = (E * dx * dy) / dz;

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

      builder.addBlock(elemDOFs, elemDOFs, kLocal as any);
    }

    const unconstrainedK = builder.build();

    // 3. Assemble Global Force Vector F
    const globalF = new Float64Array(numDOFs);
    for (const load of loads) {
      if (load.fx) globalF[dofMapper.getDOFIndex(load.nodeId, 'Ux')] += load.fx;
      if (load.fy) globalF[dofMapper.getDOFIndex(load.nodeId, 'Uy')] += load.fy;
      if (load.fz) globalF[dofMapper.getDOFIndex(load.nodeId, 'Uz')] += load.fz;
    }

    // 4. Assemble Dirichlet Boundary Conditions
    const prescribedBCs: PrescribedBoundaryCondition[] = [];
    for (const fixity of fixities) {
      if (fixity.fixX) {
        prescribedBCs.push({ globalDofIndex: dofMapper.getDOFIndex(fixity.nodeId, 'Ux'), prescribedValue: fixity.valX ?? 0.0 });
      }
      if (fixity.fixY) {
        prescribedBCs.push({ globalDofIndex: dofMapper.getDOFIndex(fixity.nodeId, 'Uy'), prescribedValue: fixity.valY ?? 0.0 });
      }
      if (fixity.fixZ) {
        prescribedBCs.push({ globalDofIndex: dofMapper.getDOFIndex(fixity.nodeId, 'Uz'), prescribedValue: fixity.valZ ?? 0.0 });
      }
    }

    // Enforce BCs
    const bcResult = SparseBCIntegration.applyDirichletBC(unconstrainedK, globalF, prescribedBCs);

    // 5. Solve K_constrained * u = F_constrained via LinearSolverSelector
    const solverPolicyResult = LinearSolverSelector.solveWithPolicy(
      bcResult.constrainedMatrix,
      bcResult.constrainedRHS,
      solverPreference,
      solverOptions
    );

    const solveRes = solverPolicyResult.solveResult;

    if (!solveRes.converged || solveRes.solution.length === 0) {
      return {
        success: false,
        mesh,
        numDOFs,
        globalSparseK: unconstrainedK,
        globalF,
        displacements: new Float64Array(0),
        reactions: [],
        maxDeflection: 0.0,
        trueResidualNorm: solveRes.finalResidual,
        relativeResidual: solveRes.relativeResidual,
        solverPolicyResult,
        failureReason: solveRes.failureReason ?? "Linear solver failed to converge"
      };
    }

    const u = solveRes.solution;

    // 6. Calculate True Reaction Forces: F_reaction = K_unconstrained * u - F_applied
    const Ku = unconstrainedK.spmv(u);
    const reactions: Array<{ nodeId: number | string; Rx: number; Ry: number; Rz: number }> = [];

    const fixityNodeMap = new Map<number | string, { Rx: number; Ry: number; Rz: number }>();
    for (const [dofIdx, _] of bcResult.fixedDofs) {
      const dofInfo = dofMapper.getDOFInfo(dofIdx);
      const rVal = Ku[dofIdx] - globalF[dofIdx];

      if (!fixityNodeMap.has(dofInfo.nodeId)) {
        fixityNodeMap.set(dofInfo.nodeId, { Rx: 0, Ry: 0, Rz: 0 });
      }
      const rec = fixityNodeMap.get(dofInfo.nodeId)!;
      if (dofInfo.dofName === 'Ux') rec.Rx += rVal;
      if (dofInfo.dofName === 'Uy') rec.Ry += rVal;
      if (dofInfo.dofName === 'Uz') rec.Rz += rVal;
    }

    for (const [nodeId, rec] of fixityNodeMap) {
      reactions.push({ nodeId, Rx: rec.Rx, Ry: rec.Ry, Rz: rec.Rz });
    }

    // 7. Max Deflection
    let maxDeflection = 0.0;
    for (let i = 0; i < mesh.nodes.length; i++) {
      const uX = u[i * 3];
      const uY = u[i * 3 + 1];
      const uZ = u[i * 3 + 2];
      const mag = Math.sqrt(uX * uX + uY * uY + uZ * uZ);
      if (mag > maxDeflection) maxDeflection = mag;
    }

    // 8. True Residual Verification: r = ||K_constrained * u - F_constrained||
    const Kc_u = bcResult.constrainedMatrix.spmv(u);
    let rSq = 0.0;
    for (let i = 0; i < numDOFs; i++) {
      const diff = Kc_u[i] - bcResult.constrainedRHS[i];
      rSq += diff * diff;
    }
    const trueResidualNorm = Math.sqrt(rSq);
    const normF = Math.hypot(...bcResult.constrainedRHS) || 1.0;

    return {
      success: true,
      mesh,
      numDOFs,
      globalSparseK: unconstrainedK,
      globalF,
      displacements: u,
      reactions,
      maxDeflection,
      trueResidualNorm,
      relativeResidual: trueResidualNorm / normF,
      solverPolicyResult
    };
  }
}
