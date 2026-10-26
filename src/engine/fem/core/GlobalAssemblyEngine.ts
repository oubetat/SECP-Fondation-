/**
 * SECP Industrial OS — FEM Core Numerical Upgrade (SECP-FEM-UPGRADE-001)
 * GlobalAssemblyEngine.ts
 * 
 * Supports both:
 * 1. Sparse Assembly (assembleSparse): O(nnz) memory overhead using SparseMatrix (CSR/DOK).
 * 2. Dense Assembly (assemble): Legacy support for small models and comparative validation.
 * 3. Dual Assembly (assembleDual): Compares Sparse and Dense assembly for mathematical equivalence (SPARSE-002).
 */

import { Matrix } from "./MathUtils";
import { SparseMatrix } from "./SparseMatrix";
import { FEMModel } from "./FEMTypes";
import { FEMDOFManager } from "./FEMDOFManager";
import { FEMElementFormulation } from "./FEMElementFormulation";

export interface SparseAssemblyResult {
  readonly K_sparse: SparseMatrix;
  readonly F: Float64Array;
  readonly trace: readonly { elementId: string; globalDOFs: readonly number[] }[];
  readonly totalDOFs: number;
  readonly nnz: number;
}

export interface DualAssemblyResult {
  readonly K_sparse: SparseMatrix;
  readonly K_dense: Matrix;
  readonly F: Float64Array;
  readonly maxAbsoluteDifference: number;
  readonly isNumericallyEquivalent: boolean;
}

export class GlobalAssemblyEngine {
  /**
   * Assembles the global stiffness matrix directly into a SparseMatrix.
   * Avoids allocating full O(N^2) dense arrays.
   */
  public assembleSparse(
    model: FEMModel,
    dofManager: FEMDOFManager,
    formulations: Map<string, FEMElementFormulation>
  ): SparseAssemblyResult {
    const totalDOFs = dofManager.getTotalDOFCount();
    const K_sparse = new SparseMatrix(totalDOFs, totalDOFs);
    const F = new Float64Array(totalDOFs);
    const trace: { elementId: string; globalDOFs: number[] }[] = [];

    // 1. Element matrix contributions
    for (const [elemId, element] of model.elements.entries()) {
      const formulation = formulations.get(element.formulationId);
      if (!formulation) {
        throw new Error(`[ASSEMBLY_FORMULATION_ERROR] Formulation '${element.formulationId}' not found for element '${elemId}'`);
      }

      const { Ke, Fe, globalDOFs } = formulation.computeMatrices(element, model, dofManager);

      // Accumulate element force
      for (let i = 0; i < globalDOFs.length; i++) {
        const row = globalDOFs[i];
        if (row < 0 || row >= totalDOFs) {
          throw new Error(`[ASSEMBLY_DOF_OUT_OF_BOUNDS] Global DOF ${row} exceeds total DOFs (${totalDOFs})`);
        }
        F[row] += Fe[i];

        // Accumulate element stiffness
        for (let j = 0; j < globalDOFs.length; j++) {
          const col = globalDOFs[j];
          if (col < 0 || col >= totalDOFs) {
            throw new Error(`[ASSEMBLY_DOF_OUT_OF_BOUNDS] Global DOF ${col} exceeds total DOFs (${totalDOFs})`);
          }

          const val = Ke.get(i, j);
          if (!Number.isFinite(val)) {
            throw new Error(`[ASSEMBLY_NUMERICAL_ERROR] Non-finite stiffness (${val}) computed for element '${elemId}' at local (${i}, ${j})`);
          }

          K_sparse.add(row, col, val);
        }
      }

      trace.push({
        elementId: elemId,
        globalDOFs
      });
    }

    // 2. Nodal External Loads
    for (const load of model.loads) {
      const dof = dofManager.getDOF(load.nodeId, load.dof);
      if (dof) {
        if (!Number.isFinite(load.value)) {
          throw new Error(`[ASSEMBLY_NUMERICAL_ERROR] Non-finite load (${load.value}) on node '${load.nodeId}', DOF '${load.dof}'`);
        }
        F[dof.globalId] += load.value;
      }
    }

    return {
      K_sparse,
      F,
      trace,
      totalDOFs,
      nnz: K_sparse.getNNZ()
    };
  }

  /**
   * Assembles the global tangent stiffness matrix and internal force vector for nonlinear analysis.
   */
  public assembleNonlinear(
    model: FEMModel,
    dofManager: FEMDOFManager,
    formulations: Map<string, FEMElementFormulation>,
    U: number[] | Float64Array,
    stateManager?: MaterialStateManager,
    materialModel?: ConstitutiveModel
  ): { Kt: SparseMatrix; Fint: Float64Array } {
    const totalDOFs = dofManager.getTotalDOFCount();
    const Kt = new SparseMatrix(totalDOFs, totalDOFs);
    const Fint = new Float64Array(totalDOFs);

    for (const [elemId, element] of model.elements.entries()) {
      const formulation = formulations.get(element.formulationId);
      if (!formulation) {
        throw new Error(`[ASSEMBLY_FORMULATION_ERROR] Formulation '${element.formulationId}' not found for element '${elemId}'`);
      }

      if (formulation.computeNonlinearMatrices) {
        // Nonlinear element
        const result = formulation.computeNonlinearMatrices(element, model, dofManager, U, stateManager, materialModel);
        for (let i = 0; i < result.globalDOFs.length; i++) {
          const row = result.globalDOFs[i];
          Fint[row] += result.Fint[i];
          for (let j = 0; j < result.globalDOFs.length; j++) {
            Kt.add(row, result.globalDOFs[j], result.Kt.get(i, j));
          }
        }
      } else {
        // Fallback: Linear element used in nonlinear context (Kt = K_linear, Fint = K_linear * U_elem)
        const { Ke, Fe, globalDOFs } = formulation.computeMatrices(element, model, dofManager);
        
        // Extract local displacement
        const u_elem = new Float64Array(globalDOFs.length);
        for (let i = 0; i < globalDOFs.length; i++) u_elem[i] = U[globalDOFs[i]];

        // Fint_elem = Ke * u_elem - Fe_dist (where Fe_dist are distributed loads)
        const ke_u = Ke.multiplyVector(Array.from(u_elem));
        
        for (let i = 0; i < globalDOFs.length; i++) {
          const row = globalDOFs[i];
          Fint[row] += ke_u[i] - Fe[i];
          for (let j = 0; j < globalDOFs.length; j++) {
            Kt.add(row, globalDOFs[j], Ke.get(i, j));
          }
        }
      }
    }

    return { Kt, Fint };
  }

  /**
   * Dense assembly (Legacy signature preserved for full backward compatibility).
   */
  public assemble(
    model: FEMModel,
    dofManager: FEMDOFManager,
    formulations: Map<string, FEMElementFormulation>
  ): { K: Matrix; F: number[]; trace: any[] } {
    const sparseResult = this.assembleSparse(model, dofManager, formulations);
    const K = sparseResult.K_sparse.toDense();
    const F = Array.from(sparseResult.F);
    return {
      K,
      F,
      trace: sparseResult.trace as any[]
    };
  }

  /**
   * Dual assembly for mathematical equivalence verification (SPARSE-002).
   */
  public assembleDual(
    model: FEMModel,
    dofManager: FEMDOFManager,
    formulations: Map<string, FEMElementFormulation>,
    tolerance = 1e-12
  ): DualAssemblyResult {
    const sparseResult = this.assembleSparse(model, dofManager, formulations);
    const K_sparse = sparseResult.K_sparse;
    const K_dense = K_sparse.toDense();

    // Verify element-by-element equivalence
    let maxDiff = 0;
    for (let r = 0; r < K_dense.rows; r++) {
      for (let c = 0; c < K_dense.cols; c++) {
        const diff = Math.abs(K_sparse.get(r, c) - K_dense.get(r, c));
        if (diff > maxDiff) maxDiff = diff;
      }
    }

    return {
      K_sparse,
      K_dense,
      F: sparseResult.F,
      maxAbsoluteDifference: maxDiff,
      isNumericallyEquivalent: maxDiff <= tolerance
    };
  }
}
