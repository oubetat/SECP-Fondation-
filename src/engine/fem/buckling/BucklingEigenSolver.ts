/**
 * SECP Industrial OS — Engineering Truth OS
 * BucklingEigenSolver.ts
 * 
 * SECP-FEM-UPGRADE-006: Generalized Eigenvalue Solver for Linear Elastic Buckling.
 * Solves K_ff * phi_f = lambda * K_G_ff * phi_f using Cholesky reduction to symmetric standard
 * eigenvalue problem A * y = mu * y (where mu = 1 / lambda) and Jacobi diagonalisation.
 * Computes exact load multipliers lambda_i, critical loads P_cr, normalized mode shapes,
 * and relative residual convergence metrics.
 */

import { Matrix } from "../core/MathUtils";
import { LinearBucklingModeResult, LinearBucklingOptions } from "./BucklingTypes";

export class BucklingEigenSolver {
  /**
   * Performs Cholesky factorization of symmetric positive definite matrix K (n x n): K = L * L^T.
   * Returns lower triangular matrix L (n x n).
   */
  public choleskyFactorization(K: Matrix): Matrix {
    const n = K.rows;
    const L = new Matrix(n, n);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = K.get(i, j);
        for (let k = 0; k < j; k++) {
          sum -= L.get(i, k) * L.get(j, k);
        }

        if (i === j) {
          if (sum <= 1e-14 || !Number.isFinite(sum)) {
            throw new Error(
              `[NON_SPD_STIFFNESS_MATRIX] Partitioned stiffness matrix K_ff is not symmetric positive definite (non-positive pivot ${sum.toExponential(4)} at index ${i}). Verify boundary conditions.`
            );
          }
          L.set(i, j, Math.sqrt(sum));
        } else {
          L.set(i, j, sum / L.get(j, j));
        }
      }
    }

    return L;
  }

  /**
   * Solves L * X = B for X (forward substitution with lower triangular matrix L).
   */
  public solveForwardSubstitution(L: Matrix, B: Matrix): Matrix {
    const n = L.rows;
    const m = B.cols;
    const X = new Matrix(n, m);

    for (let col = 0; col < m; col++) {
      for (let i = 0; i < n; i++) {
        let sum = B.get(i, col);
        for (let k = 0; k < i; k++) {
          sum -= L.get(i, k) * X.get(k, col);
        }
        X.set(i, col, sum / L.get(i, i));
      }
    }

    return X;
  }

  /**
   * Solves L^T * X = B for X (back substitution with upper triangular matrix L^T).
   */
  public solveBackSubstitutionLt(L: Matrix, B: Matrix): Matrix {
    const n = L.rows;
    const m = B.cols;
    const X = new Matrix(n, m);

    for (let col = 0; col < m; col++) {
      for (let i = n - 1; i >= 0; i--) {
        let sum = B.get(i, col);
        for (let k = i + 1; k < n; k++) {
          sum -= L.get(k, i) * X.get(k, col);
        }
        X.set(i, col, sum / L.get(i, i));
      }
    }

    return X;
  }

  /**
   * Solves L^T * x = b for vector x.
   */
  public solveBackSubstitutionLtVector(L: Matrix, b: number[]): number[] {
    const n = L.rows;
    const x = new Array(n).fill(0);

    for (let i = n - 1; i >= 0; i--) {
      let sum = b[i];
      for (let k = i + 1; k < n; k++) {
        sum -= L.get(k, i) * x[k];
      }
      x[i] = sum / L.get(i, i);
    }

    return x;
  }

  /**
   * Jacobi Eigenvalue Algorithm for real symmetric matrix A (n x n).
   * Computes all eigenvalues D = diag(mu_1..mu_n) and eigenvector matrix V (n x n).
   */
  public jacobiEigenDecomposition(A: Matrix, maxIterations = 200, tolerance = 1e-12): { eigenvalues: number[]; eigenvectors: Matrix } {
    const n = A.rows;
    const D = A.clone();
    const V = Matrix.identity(n);

    for (let iter = 0; iter < maxIterations; iter++) {
      // Find largest off-diagonal element
      let maxOff = 0;
      let p = 0;
      let q = 1;

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const absVal = Math.abs(D.get(i, j));
          if (absVal > maxOff) {
            maxOff = absVal;
            p = i;
            q = j;
          }
        }
      }

      if (maxOff < tolerance) {
        break; // Converged
      }

      const App = D.get(p, p);
      const Aqq = D.get(q, q);
      const Apq = D.get(p, q);

      let theta = 0;
      if (Math.abs(App - Aqq) < 1e-15) {
        theta = Math.PI / 4;
      } else {
        theta = 0.5 * Math.atan2(2 * Apq, App - Aqq);
      }

      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      // Perform Jacobi rotation on D
      for (let i = 0; i < n; i++) {
        if (i !== p && i !== q) {
          const Dip = D.get(i, p);
          const Diq = D.get(i, q);
          D.set(i, p, Dip * cos + Diq * sin);
          D.set(p, i, Dip * cos + Diq * sin);
          D.set(i, q, -Dip * sin + Diq * cos);
          D.set(q, i, -Dip * sin + Diq * cos);
        }
      }

      D.set(p, p, App * cos * cos + 2 * Apq * cos * sin + Aqq * sin * sin);
      D.set(q, q, App * sin * sin - 2 * Apq * cos * sin + Aqq * cos * cos);
      D.set(p, q, 0);
      D.set(q, p, 0);

      // Update eigenvector matrix V
      for (let i = 0; i < n; i++) {
        const Vip = V.get(i, p);
        const Viq = V.get(i, q);
        V.set(i, p, Vip * cos + Viq * sin);
        V.set(i, q, -Vip * sin + Viq * cos);
      }
    }

    const eigenvalues: number[] = [];
    for (let i = 0; i < n; i++) {
      eigenvalues.push(D.get(i, i));
    }

    return { eigenvalues, eigenvectors: V };
  }

  /**
   * Solves generalized eigenvalue problem: K_ff * phi_f = lambda * K_G_ff * phi_f
   */
  public solveGeneralizedEigenvalue(
    K_ff: Matrix,
    K_G_ff: Matrix,
    referenceLoad: number,
    options: LinearBucklingOptions = {}
  ): LinearBucklingModeResult[] {
    const n = K_ff.rows;
    if (n === 0) {
      throw new Error(`[EMPTY_SYSTEM] Partitioned stiffness system has 0 free degrees of freedom.`);
    }

    if (K_ff.rows !== K_ff.cols || K_G_ff.rows !== K_G_ff.cols || K_ff.rows !== K_G_ff.rows) {
      throw new Error(`[MATRIX_DIMENSION_MISMATCH] K_ff (${K_ff.rows}x${K_ff.cols}) and K_G_ff (${K_G_ff.rows}x${K_G_ff.cols}) dimensions must match.`);
    }

    const targetModes = options.numModes ?? 3;
    const tol = options.tolerance ?? 1e-4;
    const normType = options.normalization ?? "MAX_COMPONENT";

    // 1. Cholesky Factorization K_ff = L * L^T
    const L = this.choleskyFactorization(K_ff);

    // 2. Solve L * Z = K_G_ff => Z = L^-1 * K_G_ff
    const Z = this.solveForwardSubstitution(L, K_G_ff);

    // 3. Form A = Z * L^-T = L^-1 * K_G_ff * L^-T (Symmetric Matrix)
    const Zt = Z.transpose();
    const A_raw = this.solveForwardSubstitution(L, Zt);
    const A = A_raw.transpose(); // Guarantee exact numerical symmetry

    // 4. Solve standard eigenvalue problem A * y = mu * y
    const { eigenvalues: mu_list, eigenvectors: Y } = this.jacobiEigenDecomposition(
      A,
      options.maxEigenIterations ?? 200,
      1e-12
    );

    // 5. Recover load multipliers lambda_k = 1 / mu_k and mode vectors
    const candidates: { lambda: number; mu: number; mode_f: number[] }[] = [];

    for (let k = 0; k < n; k++) {
      const mu = mu_list[k];
      if (mu > 1e-12 && Number.isFinite(mu)) {
        const lambda = 1.0 / mu;

        // Extract eigenvector y_k (column k of Y)
        const y_k: number[] = [];
        for (let r = 0; r < n; r++) {
          y_k.push(Y.get(r, k));
        }

        // Recover free mode shape phi_f = L^-T * y_k
        const mode_f = this.solveBackSubstitutionLtVector(L, y_k);
        candidates.push({ lambda, mu, mode_f });
      }
    }

    if (candidates.length === 0) {
      throw new Error(`[NO_POSITIVE_EIGENVALUES] No positive eigenvalues found in buckling system. Check load orientation or stress state.`);
    }

    // 6. Sort candidates by ascending positive load factor lambda_1 <= lambda_2 <= ...
    candidates.sort((a, b) => a.lambda - b.lambda);

    const selectedModes = candidates.slice(0, targetModes);
    const modeResults: LinearBucklingModeResult[] = [];

    for (let m = 0; m < selectedModes.length; m++) {
      const cand = selectedModes[m];
      let modeVec = Array.from(cand.mode_f);

      // Normalization
      if (normType === "MAX_COMPONENT") {
        let maxComp = 0;
        let maxCompVal = 0;
        for (const val of modeVec) {
          if (Math.abs(val) > maxComp) {
            maxComp = Math.abs(val);
            maxCompVal = val;
          }
        }
        if (maxComp > 1e-12) {
          const scale = 1.0 / maxCompVal; // Keep sign of peak displacement
          modeVec = modeVec.map(v => v * scale);
        }
      } else if (normType === "L2") {
        const l2Norm = Math.sqrt(modeVec.reduce((sum, v) => sum + v * v, 0));
        if (l2Norm > 1e-12) {
          modeVec = modeVec.map(v => v / l2Norm);
        }
      }

      // Compute residual: r = K_ff * phi_f - lambda * K_G_ff * phi_f
      const K_phi = K_ff.multiplyVector(modeVec);
      const KG_phi = K_G_ff.multiplyVector(modeVec);

      const resVec = new Array(n).fill(0);
      let normR = 0;
      let normKPhi = 0;
      let normKGPhi = 0;

      for (let i = 0; i < n; i++) {
        resVec[i] = K_phi[i] - cand.lambda * KG_phi[i];
        normR += resVec[i] * resVec[i];
        normKPhi += K_phi[i] * K_phi[i];
        normKGPhi += KG_phi[i] * KG_phi[i];
      }

      normR = Math.sqrt(normR);
      normKPhi = Math.sqrt(normKPhi);
      normKGPhi = Math.sqrt(normKGPhi);

      const relResidual = normR / (normKPhi + Math.abs(cand.lambda) * normKGPhi + 1e-12);
      const isConverged = relResidual <= tol && Number.isFinite(relResidual);

      const rejectionReasons: string[] = [];
      if (!isConverged) {
        rejectionReasons.push(`Relative residual ${relResidual.toExponential(4)} exceeds tolerance ${tol.toExponential(1)}`);
      }

      modeResults.push({
        modeIndex: m + 1,
        eigenvalue: cand.lambda,
        loadFactor: cand.lambda,
        referenceLoad,
        criticalLoad: cand.lambda * referenceLoad,
        modeShape: new Map(), // Filled during full model reconstruction
        modeShapeVector: modeVec,
        relativeResidual: relResidual,
        normalization: normType,
        convergenceStatus: isConverged ? "CONVERGED" : "NOT_CONVERGED",
        verificationStatus: isConverged ? "VERIFIED" : "FAILED",
        rejectionReasons
      });
    }

    return modeResults;
  }
}
