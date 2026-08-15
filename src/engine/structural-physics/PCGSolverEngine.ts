/**
 * PATCH-SECP-073.2: PCG Solver Engine
 * Industrial-scale Preconditioned Conjugate Gradient (PCG) iterative solver.
 * Capable of solving massive systems (e.g., 100,000+ DOFs) by utilizing Sparse Matrices
 * and Jacobi (diagonal) preconditioning.
 */

import { SparseMatrix } from './SparseMatrixEngine';

export class PCGSolverEngine {
  /**
   * Solves A * x = b using Preconditioned Conjugate Gradient.
   */
  public static solve(
    A: SparseMatrix,
    b: number[],
    tol: number = 1e-8,
    maxIter: number = 5000
  ): { x: number[]; iterations: number; converged: boolean; residualNorm: number } {
    const n = b.length;
    const x = new Array(n).fill(0);
    const r = [...b]; // Since x0 = 0, r0 = b - A*x0 = b

    // Preconditioner M^-1 (Jacobi: inverse of diagonal)
    const M_inv = new Array(n).fill(1.0);
    for (let i = 0; i < n; i++) {
      const diag = A.get(i, i);
      if (Math.abs(diag) > 1e-12) {
        M_inv[i] = 1.0 / diag;
      }
    }

    const z = new Array(n);
    const p = new Array(n);
    let rz = 0;

    // Initial z and p
    for (let i = 0; i < n; i++) {
      z[i] = r[i] * M_inv[i];
      p[i] = z[i];
      rz += r[i] * z[i];
    }

    let iter = 0;
    let rNorm = 0;

    for (; iter < maxIter; iter++) {
      // Ap = A * p
      const Ap = A.multiplyVector(p);

      // pAp = p^T * Ap
      let pAp = 0;
      for (let i = 0; i < n; i++) {
        pAp += p[i] * Ap[i];
      }

      if (Math.abs(pAp) < 1e-16) {
        break; // Matrix might be singular or non-positive-definite
      }

      const alpha = rz / pAp;

      // Update x and r
      rNorm = 0;
      for (let i = 0; i < n; i++) {
        x[i] += alpha * p[i];
        r[i] -= alpha * Ap[i];
        rNorm += r[i] * r[i];
      }
      rNorm = Math.sqrt(rNorm);

      // Check convergence
      if (rNorm < tol) {
        break;
      }

      // Update z
      let rz_new = 0;
      for (let i = 0; i < n; i++) {
        z[i] = r[i] * M_inv[i];
        rz_new += r[i] * z[i];
      }

      const beta = rz_new / rz;

      // Update p
      for (let i = 0; i < n; i++) {
        p[i] = z[i] + beta * p[i];
      }

      rz = rz_new;
    }

    return {
      x,
      iterations: iter,
      converged: rNorm < tol,
      residualNorm: rNorm
    };
  }
}
