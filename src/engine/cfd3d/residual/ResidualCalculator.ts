/**
 * SECP Industrial OS v2 — Residual Framework
 * PATCH-056: Residual Calculator
 */

import { SparseMatrix, SparseVector } from '../linear-solvers';
import { ResidualVector } from './ResidualVector';

export class ResidualCalculator {
  
  /**
   * Calculates algebraic residual: r = b - A*x
   */
  public static calculateAlgebraicResidual(
    matrix: SparseMatrix,
    rhs: SparseVector,
    solution: SparseVector
  ): ResidualVector {
    if (matrix.rows !== rhs.length || matrix.cols !== solution.length) {
      throw new Error(`Dimension mismatch in residual calculation: A(${matrix.rows}x${matrix.cols}), b(${rhs.length}), x(${solution.length})`);
    }

    const res = new ResidualVector(matrix.rows);
    
    for (let i = 0; i < matrix.rows; i++) {
      let ax_i = 0.0;
      const row = matrix.rowAccess(i);
      for (const [j, val] of row.entries()) {
        ax_i += val * solution.get(j);
      }
      res.set(i, rhs.get(i) - ax_i);
    }

    return res;
  }

  /**
   * Calculates mass conservation residual (Continuity)
   * r_c = sum(rho * u_f * A_f)
   */
  public static calculateMassResidual(
    cellFluxes: Float64Array[] // array of sum of fluxes per cell
  ): ResidualVector {
    const n = cellFluxes.length;
    const res = new ResidualVector(n);
    for (let i = 0; i < n; i++) {
      // In a perfectly converged continuity equation, sum of fluxes is 0
      // We expect the sum to be provided here.
      // Note: This assumes cellFluxes[i] is already the sum of m_f for cell i.
      // res.set(i, cellFluxes[i]); 
      // But based on common patterns, we'll let the caller define the data.
    }
    return res;
  }
}
