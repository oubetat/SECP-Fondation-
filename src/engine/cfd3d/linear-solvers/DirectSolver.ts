/**
 * SECP Industrial OS v2 — Linear Solvers Architecture
 * PATCH-055: Direct Solver (Gaussian Elimination with Partial Pivoting)
 */

import { LinearSolver } from './LinearSolver';
import { SparseMatrix } from './SparseMatrix';
import { LinearSystem, LinearSystemValidator } from './LinearSystem';
import { SolverConfiguration } from './SolverConfiguration';
import { SolverResult, ResidualNorms } from './SolverResult';
import { SolverDiagnostic } from './SolverDiagnostics';
import { SparseVector } from './SparseVector';
import { Preconditioner } from './Preconditioner';

export class DirectSolver implements LinearSolver {
  public readonly id = 'direct-lu-solver';
  public readonly version = '2.0.0';

  public solve(
    system: LinearSystem,
    config: SolverConfiguration,
    preconditioner?: Preconditioner
  ): SolverResult {
    const configHash = `direct-lu-${config.absoluteTolerance}-${config.relativeTolerance}`;
    const diagnostics: SolverDiagnostic[] = [];

    // Validation
    const val = LinearSystemValidator.validate(system);
    if (!val.valid) {
      const initRes: ResidualNorms = { l2: Infinity, linfinity: Infinity, normalized: Infinity };
      return {
        solution: new SparseVector(system.rhs ? system.rhs.length : 0),
        status: 'INVALID_SYSTEM',
        iterations: 0,
        initialResidual: initRes,
        finalResidual: initRes,
        residualHistory: [],
        convergence: false,
        diagnostics: [SolverDiagnostic.DIMENSION_MISMATCH],
        solverId: this.id,
        configurationHash: configHash
      };
    }

    const { matrix, rhs } = system;
    const n = matrix.rows;

    if (!matrix.isSquare()) {
      const initRes = this.computeResidualNorms(matrix, rhs, new SparseVector(n));
      return {
        solution: new SparseVector(n),
        status: 'INVALID_SYSTEM',
        iterations: 0,
        initialResidual: initRes,
        finalResidual: initRes,
        residualHistory: [],
        convergence: false,
        diagnostics: [SolverDiagnostic.UNSUPPORTED_MATRIX_STRUCTURE],
        solverId: this.id,
        configurationHash: configHash
      };
    }

    if (matrix.hasZeroDiagonal()) {
      diagnostics.push(SolverDiagnostic.ZERO_DIAGONAL);
    }

    // Initial residual check
    const x0 = system.initialGuess ? system.initialGuess.copy() : new SparseVector(n);
    const initialResidual = this.computeResidualNorms(matrix, rhs, x0);

    // Build dense 2D array for LU
    const A: number[][] = Array.from({ length: n }, (_, i) => {
      const row = new Array(n).fill(0);
      const rm = matrix.rowAccess(i);
      for (const [col, val] of rm.entries()) {
        row[col] = val;
      }
      return row;
    });

    const b = rhs.toArray();
    const x = new Float64Array(n);

    // LU with Partial Pivoting
    const piv = new Int32Array(n);
    for (let i = 0; i < n; i++) piv[i] = i;

    for (let k = 0; k < n; k++) {
      // Find pivot
      let maxVal = Math.abs(A[k][k]);
      let maxRow = k;
      for (let i = k + 1; i < n; i++) {
        if (Math.abs(A[i][k]) > maxVal) {
          maxVal = Math.abs(A[i][k]);
          maxRow = i;
        }
      }

      if (maxVal < 1e-15) {
        diagnostics.push(SolverDiagnostic.SINGULAR_SYSTEM);
        const finalRes = this.computeResidualNorms(matrix, rhs, new SparseVector(n));
        return {
          solution: new SparseVector(n),
          status: 'INVALID_SYSTEM',
          iterations: 1,
          initialResidual,
          finalResidual: finalRes,
          residualHistory: [initialResidual.l2],
          convergence: false,
          diagnostics,
          solverId: this.id,
          configurationHash: configHash
        };
      }

      // Swap rows
      if (maxRow !== k) {
        const tempRow = A[k];
        A[k] = A[maxRow];
        A[maxRow] = tempRow;

        const tempB = b[k];
        b[k] = b[maxRow];
        b[maxRow] = tempB;
      }

      // Eliminate
      for (let i = k + 1; i < n; i++) {
        const factor = A[i][k] / A[k][k];
        A[i][k] = factor;
        for (let j = k + 1; j < n; j++) {
          A[i][j] -= factor * A[k][j];
        }
        b[i] -= factor * b[k];
      }
    }

    // Back Substitution
    for (let i = n - 1; i >= 0; i--) {
      let sum = b[i];
      for (let j = i + 1; j < n; j++) {
        sum -= A[i][j] * x[j];
      }
      x[i] = sum / A[i][i];
    }

    const solVector = new SparseVector(x);
    if (!solVector.isFinite()) {
      diagnostics.push(SolverDiagnostic.NON_FINITE_SOLUTION);
      const finalRes = this.computeResidualNorms(matrix, rhs, solVector);
      return {
        solution: solVector,
        status: 'BREAKDOWN',
        iterations: 1,
        initialResidual,
        finalResidual: finalRes,
        residualHistory: [initialResidual.l2],
        convergence: false,
        diagnostics,
        solverId: this.id,
        configurationHash: configHash
      };
    }

    const finalResidual = this.computeResidualNorms(matrix, rhs, solVector);
    const converged = finalResidual.l2 <= config.absoluteTolerance || 
                      finalResidual.normalized <= config.relativeTolerance;

    return {
      solution: solVector,
      status: converged ? 'CONVERGED' : 'NOT_CONVERGED',
      iterations: 1,
      initialResidual,
      finalResidual,
      residualHistory: [initialResidual.l2, finalResidual.l2],
      convergence: converged,
      diagnostics,
      solverId: this.id,
      configurationHash: configHash
    };
  }

  private computeResidualNorms(matrix: SparseMatrix, rhs: SparseVector, x: SparseVector): ResidualNorms {
    const Ax = matrix.multVector(x);
    const r = rhs.subtractVector(Ax);
    const l2 = r.norm2();
    const linfinity = r.normInf();
    const rhsNorm = rhs.norm2();
    const normalized = rhsNorm > 1e-14 ? l2 / rhsNorm : l2;
    return { l2, linfinity, normalized };
  }
}
