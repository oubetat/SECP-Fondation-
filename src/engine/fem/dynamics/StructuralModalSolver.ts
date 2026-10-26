/**
 * SECP Industrial OS — FEM Core Structural Dynamics (SECP-FEM-UPGRADE-007)
 * StructuralModalSolver.ts
 * 
 * Solves the generalized eigenvalue problem:
 * (K - lambda * M) * phi = 0   where lambda = omega^2
 * 
 * Extracts:
 * - Natural angular frequencies omega_i (rad/s)
 * - Natural frequencies f_i (Hz)
 * - Mode shapes phi_i (mass-normalized: phi_i^T * M * phi_j = delta_ij)
 * - Relative residuals r_rel
 * - Mode shape classification (ELASTIC_MODE vs RIGID_BODY / MECHANISM)
 * - Mass and stiffness orthogonality verification metrics
 */

import { Matrix } from "../core/MathUtils";
import { SparseMatrix } from "../core/SparseMatrix";
import { DOFComponent, FEMModel } from "../core/FEMTypes";
import { FEMDOFManager } from "../core/FEMDOFManager";

export type ModeClassification = 'ELASTIC_MODE' | 'RIGID_BODY' | 'MECHANISM';

export interface ModalModeResult {
  modeIndex: number; // 1-based index (1, 2, 3...)
  lambda: number; // eigenvalue omega^2
  omega: number; // natural angular frequency (rad/s)
  frequencyHz: number; // cyclic frequency f = omega / (2*pi) (Hz)
  modeShape: number[]; // full global DOF vector (length N_total)
  freeModeShape: number[]; // free DOFs mode shape vector
  relativeResidual: number; // ||K*phi - lambda*M*phi|| / (||K*phi|| + |lambda|*||M*phi|| + eps)
  absoluteResidual: number; // ||K*phi - lambda*M*phi||
  classification: ModeClassification;
}

export interface ModalAnalysisResult {
  totalDOFs: number;
  freeDOFs: number;
  constrainedDOFs: number;
  modes: ModalModeResult[];
  maxMassOrthogonalityError: number;
  maxStiffnessOrthogonalityError: number;
  isOrthogonal: boolean;
  freeDOFIndices: number[];
  constrainedDOFIndices: number[];
}

export interface ModalSolverOptions {
  numModes?: number; // defaults to all free DOFs
  eigensolverTolerance?: number; // convergence tol for Jacobi eigensolver (default 1e-12)
  maxSweepIterations?: number; // max Jacobi sweeps (default 100)
}

export class StructuralModalSolver {
  /**
   * Solve structural modal analysis given assembled sparse stiffness K and sparse mass M.
   */
  public solve(
    model: FEMModel,
    dofManager: FEMDOFManager,
    K_sparse: SparseMatrix,
    M_sparse: SparseMatrix,
    options: ModalSolverOptions = {}
  ): ModalAnalysisResult {
    const totalDOFs = dofManager.getTotalDOFCount();

    if (totalDOFs === 0) {
      throw new Error("[EMPTY_MODEL] Cannot solve modal analysis for model with 0 DOFs");
    }

    // 1. Identify constrained DOFs from boundary conditions
    const constrainedDOFSet = new Set<number>();
    for (const bc of model.boundaryConditions) {
      const dof = dofManager.getDOF(bc.nodeId, bc.dof);
      if (dof !== undefined) {
        constrainedDOFSet.add(dof.globalId);
      }
    }

    const constrainedDOFIndices = Array.from(constrainedDOFSet).sort((a, b) => a - b);
    const freeDOFIndices: number[] = [];
    for (let i = 0; i < totalDOFs; i++) {
      if (!constrainedDOFSet.has(i)) {
        freeDOFIndices.push(i);
      }
    }

    const N_f = freeDOFIndices.length;
    const N_c = constrainedDOFIndices.length;

    if (N_f === 0) {
      // Fully constrained model
      return {
        totalDOFs,
        freeDOFs: 0,
        constrainedDOFs: N_c,
        modes: [],
        maxMassOrthogonalityError: 0,
        maxStiffnessOrthogonalityError: 0,
        isOrthogonal: true,
        freeDOFIndices: [],
        constrainedDOFIndices
      };
    }

    // 2. Extract submatrices K_ff and M_ff
    const K_ff = new Matrix(N_f, N_f);
    const M_ff = new Matrix(N_f, N_f);

    for (let i = 0; i < N_f; i++) {
      const globalRow = freeDOFIndices[i];
      for (let j = 0; j < N_f; j++) {
        const globalCol = freeDOFIndices[j];
        K_ff.set(i, j, K_sparse.get(globalRow, globalCol));
        M_ff.set(i, j, M_sparse.get(globalRow, globalCol));
      }
    }

    // 3. Cholesky factorization of mass matrix M_ff = L_M * L_M^T
    const L_M = this.choleskyDecomposition(M_ff);
    const L_M_inv = this.invertLowerTriangular(L_M);

    // 4. Transform to standard symmetric eigenvalue problem: A = L_M^-1 * K_ff * L_M^-T
    // A_inter = L_M^-1 * K_ff
    const A_inter = L_M_inv.multiply(K_ff);
    // A = A_inter * L_M^-T
    const L_M_inv_T = L_M_inv.transpose();
    const A = A_inter.multiply(L_M_inv_T);

    // Enforce symmetry numerically
    for (let i = 0; i < N_f; i++) {
      for (let j = i + 1; j < N_f; j++) {
        const avg = 0.5 * (A.get(i, j) + A.get(j, i));
        A.set(i, j, avg);
        A.set(j, i, avg);
      }
    }

    // 5. Solve symmetric eigenvalue problem A * y = lambda * y via Jacobi Eigensolver
    const tol = options.eigensolverTolerance || 1e-12;
    const maxSweeps = options.maxSweepIterations || 100;
    const { eigenvalues, eigenvectors: Y } = this.jacobiEigensolver(A, tol, maxSweeps);

    // 6. Sort eigenvalues and eigenvectors ascending by eigenvalue
    const eigenPairs: { lambda: number; y: number[] }[] = [];
    for (let col = 0; col < N_f; col++) {
      const yCol: number[] = [];
      for (let row = 0; row < N_f; row++) {
        yCol.push(Y.get(row, col));
      }
      eigenPairs.push({ lambda: eigenvalues[col], y: yCol });
    }

    eigenPairs.sort((a, b) => a.lambda - b.lambda);

    // Determine how many modes to return
    const numRequested = options.numModes !== undefined ? Math.min(options.numModes, N_f) : N_f;

    // 7. Recover free mode shapes phi_f = L_M^-T * y and calculate metrics
    const modes: ModalModeResult[] = [];
    const massOrthMatrix = new Matrix(numRequested, numRequested);
    const stiffOrthMatrix = new Matrix(numRequested, numRequested);

    const freeModeShapes: number[][] = [];

    for (let m = 0; m < numRequested; m++) {
      const pair = eigenPairs[m];
      const lambda = pair.lambda;

      // Recover free mode shape phi_f = L_M^-T * y
      const phi_f = L_M_inv_T.multiplyVector(pair.y);

      // Mass normalization check/refinement: phi_f^T * M_ff * phi_f
      const M_phi = M_ff.multiplyVector(phi_f);
      let m_norm = 0;
      for (let i = 0; i < N_f; i++) {
        m_norm += phi_f[i] * M_phi[i];
      }

      if (m_norm > 0) {
        const scale = 1.0 / Math.sqrt(m_norm);
        for (let i = 0; i < N_f; i++) {
          phi_f[i] *= scale;
        }
      }

      freeModeShapes.push(phi_f);

      // Frequencies
      const effectiveLambda = Math.max(0, lambda);
      const omega = Math.sqrt(effectiveLambda);
      const frequencyHz = omega / (2 * Math.PI);

      // Classification
      let classification: ModeClassification = 'ELASTIC_MODE';
      if (Math.abs(lambda) < 1e-6 || frequencyHz < 1e-3) {
        classification = 'RIGID_BODY';
      }

      // Reconstruct full mode shape vector
      const fullModeShape = new Array(totalDOFs).fill(0);
      for (let i = 0; i < N_f; i++) {
        fullModeShape[freeDOFIndices[i]] = phi_f[i];
      }

      // Residual calculation: K_ff * phi_f - lambda * M_ff * phi_f
      const K_phi = K_ff.multiplyVector(phi_f);
      const M_phi_norm = M_ff.multiplyVector(phi_f);

      let residualNormSq = 0;
      let kNormSq = 0;
      let mNormSq = 0;

      for (let i = 0; i < N_f; i++) {
        const res_i = K_phi[i] - lambda * M_phi_norm[i];
        residualNormSq += res_i * res_i;
        kNormSq += K_phi[i] * K_phi[i];
        mNormSq += M_phi_norm[i] * M_phi_norm[i];
      }

      const absoluteResidual = Math.sqrt(residualNormSq);
      const denominator = Math.sqrt(kNormSq) + Math.abs(lambda) * Math.sqrt(mNormSq) + 1e-12;
      const relativeResidual = absoluteResidual / denominator;

      modes.push({
        modeIndex: m + 1,
        lambda,
        omega,
        frequencyHz,
        modeShape: fullModeShape,
        freeModeShape: phi_f,
        relativeResidual,
        absoluteResidual,
        classification
      });
    }

    // 8. Orthogonality Verification
    let maxMassOrthErr = 0;
    let maxStiffOrthErr = 0;

    for (let i = 0; i < numRequested; i++) {
      const phi_i = freeModeShapes[i];

      for (let j = 0; j < numRequested; j++) {
        const phi_j = freeModeShapes[j];
        const M_phi_j = M_ff.multiplyVector(phi_j);
        const K_phi_j = K_ff.multiplyVector(phi_j);

        let m_ij = 0;
        let k_ij = 0;
        for (let k = 0; k < N_f; k++) {
          m_ij += phi_i[k] * M_phi_j[k];
          k_ij += phi_i[k] * K_phi_j[k];
        }

        massOrthMatrix.set(i, j, m_ij);
        stiffOrthMatrix.set(i, j, k_ij);

        const expectedM = (i === j) ? 1.0 : 0.0;
        const expectedK = (i === j) ? modes[i].lambda : 0.0;

        const errM = Math.abs(m_ij - expectedM);
        const normFactorK = Math.max(1.0, Math.abs(expectedK));
        const errK = Math.abs(k_ij - expectedK) / normFactorK;

        if (errM > maxMassOrthErr) maxMassOrthErr = errM;
        if (errK > maxStiffOrthErr) maxStiffOrthErr = errK;
      }
    }

    return {
      totalDOFs,
      freeDOFs: N_f,
      constrainedDOFs: N_c,
      modes,
      maxMassOrthogonalityError: maxMassOrthErr,
      maxStiffnessOrthogonalityError: maxStiffOrthErr,
      isOrthogonal: maxMassOrthErr <= 1e-5 && maxStiffOrthErr <= 1e-4,
      freeDOFIndices,
      constrainedDOFIndices
    };
  }

  /**
   * Performs Cholesky decomposition of symmetric positive definite matrix A = L * L^T.
   */
  private choleskyDecomposition(A: Matrix): Matrix {
    const n = A.rows;
    const L = new Matrix(n, n);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = 0;
        for (let k = 0; k < j; k++) {
          sum += L.get(i, k) * L.get(j, k);
        }

        if (i === j) {
          const val = A.get(i, i) - sum;
          if (val <= 0 || !Number.isFinite(val)) {
            throw new Error(`[NOT_POSITIVE_DEFINITE] Mass matrix not positive definite at index ${i} (val=${val})`);
          }
          L.set(i, j, Math.sqrt(val));
        } else {
          const l_jj = L.get(j, j);
          if (l_jj === 0) {
            throw new Error(`[DIVISION_BY_ZERO] Zero diagonal element in Cholesky decomposition at ${j}`);
          }
          L.set(i, j, (A.get(i, j) - sum) / l_jj);
        }
      }
    }

    return L;
  }

  /**
   * Inverts a lower triangular matrix L.
   */
  private invertLowerTriangular(L: Matrix): Matrix {
    const n = L.rows;
    const inv = new Matrix(n, n);

    for (let i = 0; i < n; i++) {
      const l_ii = L.get(i, i);
      if (l_ii === 0) throw new Error("[SINGULAR_MATRIX] Singular lower triangular matrix");
      inv.set(i, i, 1.0 / l_ii);

      for (let j = 0; j < i; j++) {
        let sum = 0;
        for (let k = j; k < i; k++) {
          sum += L.get(i, k) * inv.get(k, j);
        }
        inv.set(i, j, -sum / l_ii);
      }
    }

    return inv;
  }

  /**
   * Cyclic Jacobi algorithm for symmetric matrix A * Y = Y * diag(lambda).
   */
  private jacobiEigensolver(
    A_in: Matrix,
    tolerance: number,
    maxSweeps: number
  ): { eigenvalues: number[]; eigenvectors: Matrix } {
    const n = A_in.rows;
    const A = A_in.clone();
    const V = Matrix.identity(n);

    const eigenvalues = new Array(n).fill(0);

    let sweep = 0;
    while (sweep < maxSweeps) {
      // Calculate sum of off-diagonal elements squared
      let offDiagSq = 0;
      for (let p = 0; p < n; p++) {
        for (let q = p + 1; q < n; q++) {
          const val = A.get(p, q);
          offDiagSq += val * val;
        }
      }

      if (Math.sqrt(2 * offDiagSq) < tolerance) {
        break; // Converged
      }

      for (let p = 0; p < n - 1; p++) {
        for (let q = p + 1; q < n; q++) {
          const app = A.get(p, p);
          const aqq = A.get(q, q);
          const apq = A.get(p, q);

          if (Math.abs(apq) < 1e-15) continue;

          const tau = (aqq - app) / (2 * apq);
          let t: number;
          if (tau >= 0) {
            t = 1.0 / (tau + Math.sqrt(1.0 + tau * tau));
          } else {
            t = -1.0 / (-tau + Math.sqrt(1.0 + tau * tau));
          }

          const c = 1.0 / Math.sqrt(1.0 + t * t);
          const s = t * c;

          // Apply Givens rotation to A
          A.set(p, p, app - t * apq);
          A.set(q, q, aqq + t * apq);
          A.set(p, q, 0);
          A.set(q, p, 0);

          for (let k = 0; k < n; k++) {
            if (k !== p && k !== q) {
              const akp = A.get(k, p);
              const akq = A.get(k, q);
              A.set(k, p, c * akp - s * akq);
              A.set(p, k, c * akp - s * akq);
              A.set(k, q, s * akp + c * akq);
              A.set(q, k, s * akp + c * akq);
            }

            // Update eigenvectors V
            const vkp = V.get(k, p);
            const vkq = V.get(k, q);
            V.set(k, p, c * vkp - s * vkq);
            V.set(k, q, s * vkp + c * vkq);
          }
        }
      }

      sweep++;
    }

    for (let i = 0; i < n; i++) {
      eigenvalues[i] = A.get(i, i);
    }

    return { eigenvalues, eigenvectors: V };
  }
}
