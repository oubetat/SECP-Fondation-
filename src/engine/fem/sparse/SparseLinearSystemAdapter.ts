import { CSRStorage } from "./CSRStorage";
import { SparseMatrix } from "./SparseMatrix";

export interface MatrixPropertiesReport {
  isSquare: boolean;
  isSymmetric: boolean;
  symmetryMaxDiff: number;
  hasPositiveDiagonal: boolean;
  minDiagonalValue: number;
  maxDiagonalValue: number;
  isStrictlyDiagonallyDominant: boolean;
  isWeaklyDiagonallyDominant: boolean;
  gershgorinLowerBound: number;
  gershgorinUpperBound: number;
  choleskyEligible: boolean;
}

export class MatrixPropertyAnalyzer {
  static analyze(A: CSRStorage, tolerance: number = 1e-8): MatrixPropertiesReport {
    const isSquare = A.rows === A.cols;
    let isSymmetric = false;
    let symmetryMaxDiff = Infinity;

    if (isSquare) {
      const symCheck = A.canonicalize();
      let maxDiff = 0;
      let sym = true;
      for (let r = 0; r < A.rows; r++) {
        const start = symCheck.rowPointers[r];
        const end = symCheck.rowPointers[r + 1];
        for (let idx = start; idx < end; idx++) {
          const c = symCheck.columnIndices[idx];
          if (c < r) continue;
          const valRC = symCheck.values[idx];
          const valCR = symCheck.get(c, r);
          const diff = Math.abs(valRC - valCR);
          if (diff > maxDiff) maxDiff = diff;
          const scale = Math.max(Math.abs(valRC), Math.abs(valCR), 1.0);
          if (diff > tolerance * scale && diff > tolerance) {
            sym = false;
          }
        }
      }
      isSymmetric = sym && maxDiff <= tolerance;
      symmetryMaxDiff = maxDiff;
    }

    let hasPositiveDiagonal = true;
    let minDiag = Infinity;
    let maxDiag = -Infinity;
    let isStrictlyDD = true;
    let isWeaklyDD = true;
    let gershgorinMin = Infinity;
    let gershgorinMax = -Infinity;

    for (let r = 0; r < A.rows; r++) {
      const diagVal = A.get(r, r);
      if (diagVal <= 0) {
        hasPositiveDiagonal = false;
      }
      if (diagVal < minDiag) minDiag = diagVal;
      if (diagVal > maxDiag) maxDiag = diagVal;

      // Sum of off-diagonal absolute entries
      let offDiagSum = 0;
      const start = A.rowPointers[r];
      const end = A.rowPointers[r + 1];
      for (let idx = start; idx < end; idx++) {
        const c = A.columnIndices[idx];
        if (c !== r) {
          offDiagSum += Math.abs(A.values[idx]);
        }
      }

      if (Math.abs(diagVal) <= offDiagSum) {
        isStrictlyDD = false;
      }
      if (Math.abs(diagVal) < offDiagSum - 1e-12) {
        isWeaklyDD = false;
      }

      const circleLeft = diagVal - offDiagSum;
      const circleRight = diagVal + offDiagSum;
      if (circleLeft < gershgorinMin) gershgorinMin = circleLeft;
      if (circleRight > gershgorinMax) gershgorinMax = circleRight;
    }

    const choleskyEligible = isSquare && isSymmetric && hasPositiveDiagonal && minDiag > 0;

    return {
      isSquare,
      isSymmetric,
      symmetryMaxDiff,
      hasPositiveDiagonal,
      minDiagonalValue: minDiag === Infinity ? 0 : minDiag,
      maxDiagonalValue: maxDiag === -Infinity ? 0 : maxDiag,
      isStrictlyDiagonallyDominant: isStrictlyDD,
      isWeaklyDiagonallyDominant: isWeaklyDD,
      gershgorinLowerBound: gershgorinMin === Infinity ? 0 : gershgorinMin,
      gershgorinUpperBound: gershgorinMax === -Infinity ? 0 : gershgorinMax,
      choleskyEligible
    };
  }
}

export interface DirichletBC {
  dofIndex: number;
  prescribedValue: number;
}

export class SparseLinearSystemAdapter {
  /**
   * Applies Dirichlet boundary conditions directly onto Sparse Matrix and RHS vector
   * Zeroing row/column or penalty replacement
   */
  static applyDirichletBC(
    matrix: SparseMatrix,
    rhs: Float64Array,
    bcs: DirichletBC[],
    method: 'DIRECT_ELIMINATION' | 'PENALTY' = 'DIRECT_ELIMINATION'
  ): { matrix: SparseMatrix; rhs: Float64Array } {
    const n = matrix.rows;
    const modifiedRHS = new Float64Array(rhs);
    const storage = matrix.storage.isCanonical ? matrix.storage : matrix.storage.canonicalize();

    if (method === 'DIRECT_ELIMINATION') {
      const bcMap = new Map<number, number>();
      for (const bc of bcs) {
        bcMap.set(bc.dofIndex, bc.prescribedValue);
      }

      // Modify values in place on a cloned copy
      const newValues = new Float64Array(storage.values);
      for (let r = 0; r < n; r++) {
        const isPrescribedRow = bcMap.has(r);
        const start = storage.rowPointers[r];
        const end = storage.rowPointers[r + 1];

        if (isPrescribedRow) {
          const prescribedVal = bcMap.get(r)!;
          modifiedRHS[r] = prescribedVal;
          for (let idx = start; idx < end; idx++) {
            const c = storage.columnIndices[idx];
            newValues[idx] = (c === r) ? 1.0 : 0.0;
          }
        } else {
          // Subtract A_rc * prescribedVal from RHS for prescribed columns
          for (let idx = start; idx < end; idx++) {
            const c = storage.columnIndices[idx];
            if (bcMap.has(c)) {
              modifiedRHS[r] -= newValues[idx] * bcMap.get(c)!;
              newValues[idx] = 0.0;
            }
          }
        }
      }

      const modifiedStorage = new CSRStorage({
        rows: storage.rows,
        cols: storage.cols,
        nnz: storage.nnz,
        values: newValues,
        columnIndices: storage.columnIndices,
        rowPointers: storage.rowPointers,
        isCanonical: true
      });

      return {
        matrix: new SparseMatrix(modifiedStorage, 'SOLVER_READY'),
        rhs: modifiedRHS
      };
    } else {
      // Penalty method
      const penalty = 1e12;
      const newValues = new Float64Array(storage.values);
      for (const bc of bcs) {
        const r = bc.dofIndex;
        const start = storage.rowPointers[r];
        const end = storage.rowPointers[r + 1];
        for (let idx = start; idx < end; idx++) {
          if (storage.columnIndices[idx] === r) {
            newValues[idx] += penalty;
            modifiedRHS[r] += penalty * bc.prescribedValue;
            break;
          }
        }
      }

      const modifiedStorage = new CSRStorage({
        rows: storage.rows,
        cols: storage.cols,
        nnz: storage.nnz,
        values: newValues,
        columnIndices: storage.columnIndices,
        rowPointers: storage.rowPointers,
        isCanonical: true
      });

      return {
        matrix: new SparseMatrix(modifiedStorage, 'SOLVER_READY'),
        rhs: modifiedRHS
      };
    }
  }
}
