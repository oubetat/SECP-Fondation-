import { SparseMatrix } from '../sparse/SparseMatrix';

export interface ConditioningAnalysis {
  isIllConditioned: boolean;
  minDiagonal: number;
  maxDiagonal: number;
  diagonalRatio: number;
  hasZeroDiagonal: boolean;
  hasNegativeDiagonal: boolean;
  zeroDiagonalIndices: number[];
}

export class ConditioningAnalyzer {
  static analyze(Kff: SparseMatrix, thresholdRatio: number = 1e14): ConditioningAnalysis {
    const csr = Kff.storage;
    const n = Kff.rows;

    let minDiag = Infinity;
    let maxDiag = -Infinity;
    let hasZeroDiagonal = false;
    let hasNegativeDiagonal = false;
    const zeroDiagonalIndices: number[] = [];

    for (let i = 0; i < n; i++) {
      let diagVal = 0;
      const start = csr.rowPointers[i];
      const end = csr.rowPointers[i + 1];

      for (let p = start; p < end; p++) {
        if (csr.columnIndices[p] === i) {
          diagVal = csr.values[p];
          break;
        }
      }

      if (Math.abs(diagVal) < 1e-12) {
        hasZeroDiagonal = true;
        zeroDiagonalIndices.push(i);
      }
      if (diagVal < -1e-12) {
        hasNegativeDiagonal = true;
      }

      const absDiag = Math.abs(diagVal);
      if (absDiag < minDiag) minDiag = absDiag;
      if (absDiag > maxDiag) maxDiag = absDiag;
    }

    const diagonalRatio = minDiag > 0 ? maxDiag / minDiag : Infinity;
    const isIllConditioned = diagonalRatio > thresholdRatio || hasZeroDiagonal || hasNegativeDiagonal;

    return {
      isIllConditioned,
      minDiagonal: minDiag === Infinity ? 0 : minDiag,
      maxDiagonal: maxDiag === -Infinity ? 0 : maxDiag,
      diagonalRatio,
      hasZeroDiagonal,
      hasNegativeDiagonal,
      zeroDiagonalIndices
    };
  }
}
