/**
 * SECP Industrial OS v2 — Linear Solvers Architecture
 * PATCH-055: LinearSystem Contract
 */

import { SparseMatrix } from './SparseMatrix';
import { SparseVector } from './SparseVector';

export type MatrixSymmetry = 'SYMMETRIC' | 'NON_SYMMETRIC' | 'UNKNOWN';

export interface LinearSystem {
  readonly matrix: SparseMatrix;
  readonly rhs: SparseVector;
  readonly initialGuess?: SparseVector;
  readonly symmetry?: MatrixSymmetry;
  readonly positiveDefinite?: boolean;
}

export class LinearSystemValidator {
  public static validate(system: LinearSystem): { valid: boolean; error?: string } {
    if (!system.matrix) {
      return { valid: false, error: 'LinearSystem matrix is undefined' };
    }
    if (!system.rhs) {
      return { valid: false, error: 'LinearSystem rhs is undefined' };
    }
    if (system.matrix.rows !== system.rhs.length) {
      return { 
        valid: false, 
        error: `Dimension mismatch: matrix rows (${system.matrix.rows}) != rhs length (${system.rhs.length})` 
      };
    }
    if (system.initialGuess && system.initialGuess.length !== system.matrix.cols) {
      return {
        valid: false,
        error: `Dimension mismatch: initialGuess length (${system.initialGuess.length}) != matrix cols (${system.matrix.cols})`
      };
    }
    if (!system.matrix.isFinite()) {
      return { valid: false, error: 'LinearSystem matrix contains non-finite values (NaN or Infinity)' };
    }
    if (!system.rhs.isFinite()) {
      return { valid: false, error: 'LinearSystem rhs contains non-finite values (NaN or Infinity)' };
    }
    if (system.initialGuess && !system.initialGuess.isFinite()) {
      return { valid: false, error: 'LinearSystem initialGuess contains non-finite values (NaN or Infinity)' };
    }
    return { valid: true };
  }
}
