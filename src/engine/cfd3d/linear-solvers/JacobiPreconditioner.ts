/**
 * SECP Industrial OS v2 — Linear Solvers Architecture
 * PATCH-055: Jacobi (Diagonal) Preconditioner
 */

import { Preconditioner } from './Preconditioner';
import { SparseVector } from './SparseVector';
import { SparseMatrix } from './SparseMatrix';

export class JacobiPreconditioner implements Preconditioner {
  public readonly id = 'jacobi-preconditioner';
  private invDiag: Float64Array | null = null;

  public setup(matrix: SparseMatrix): void {
    const minDim = Math.min(matrix.rows, matrix.cols);
    this.invDiag = new Float64Array(minDim);

    for (let i = 0; i < minDim; i++) {
      const d = matrix.get(i, i);
      if (Math.abs(d) < 1e-15 || !Number.isFinite(d)) {
        this.invDiag[i] = 1.0; // Fallback if diagonal element is near zero
      } else {
        this.invDiag[i] = 1.0 / d;
      }
    }
  }

  public apply(r: SparseVector): SparseVector {
    if (!this.invDiag) {
      return r.copy();
    }
    const z = new SparseVector(r.length);
    const n = Math.min(r.length, this.invDiag.length);
    for (let i = 0; i < n; i++) {
      z.set(i, r.get(i) * this.invDiag[i]);
    }
    return z;
  }
}
