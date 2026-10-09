import { CSRStorage } from "./CSRStorage";

export class SparseMatrixHasher {
  /**
   * Computes a deterministic 64-bit hexadecimal hash for a CSR matrix
   * Covers dimensions, row pointers, column indices, and floating point values.
   */
  static hash(csr: CSRStorage): string {
    let h1 = 2166136261;
    let h2 = 1000000007;

    const mix = (val: number) => {
      const v = val | 0;
      h1 = Math.imul(h1 ^ v, 16777619);
      h2 = Math.imul(h2 ^ ((v >>> 16) | (v << 16)), 1000003);
    };

    mix(csr.rows);
    mix(csr.cols);
    mix(csr.nnz);

    // Hash row pointers
    for (let r = 0; r <= csr.rows; r++) {
      mix(csr.rowPointers[r]);
    }

    // Hash column indices and values
    const buf = new Float64Array(1);
    const intView = new Int32Array(buf.buffer);

    for (let i = 0; i < csr.nnz; i++) {
      mix(csr.columnIndices[i]);
      buf[0] = csr.values[i];
      // If -0.0, normalize to +0.0
      if (buf[0] === 0) buf[0] = 0;
      mix(intView[0]);
      mix(intView[1]);
    }

    const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
    const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');

    return `SP_HASH_${hex1}${hex2}_R${csr.rows}_C${csr.cols}_NNZ${csr.nnz}`.toUpperCase();
  }

  /**
   * Computes hash of pattern only
   */
  static hashPattern(csr: CSRStorage): string {
    let h = 2166136261;
    const mix = (val: number) => {
      h = Math.imul(h ^ (val | 0), 16777619);
    };

    mix(csr.rows);
    mix(csr.cols);
    mix(csr.nnz);

    for (let r = 0; r <= csr.rows; r++) {
      mix(csr.rowPointers[r]);
    }
    for (let i = 0; i < csr.nnz; i++) {
      mix(csr.columnIndices[i]);
    }

    return `PAT_HASH_${(h >>> 0).toString(16).padStart(8, '0')}`.toUpperCase();
  }
}

export interface MatrixComparisonResult {
  arePatternIdentical: boolean;
  areValuesIdentical: boolean;
  maxAbsoluteDifference: number;
  maxRelativeDifference: number;
  mismatchCount: number;
  summary: string;
}

export class SparseMatrixComparator {
  /**
   * Compares two sparse matrices structurally and numerically
   */
  static compare(A: CSRStorage, B: CSRStorage, tolerance: number = 1e-9): MatrixComparisonResult {
    if (A.rows !== B.rows || A.cols !== B.cols) {
      return {
        arePatternIdentical: false,
        areValuesIdentical: false,
        maxAbsoluteDifference: Infinity,
        maxRelativeDifference: Infinity,
        mismatchCount: -1,
        summary: `Dimension mismatch: (${A.rows}x${A.cols}) vs (${B.rows}x${B.cols})`
      };
    }

    const canA = A.isCanonical ? A : A.canonicalize();
    const canB = B.isCanonical ? B : B.canonicalize();

    let patternMatch = canA.nnz === canB.nnz;
    if (patternMatch) {
      for (let r = 0; r <= canA.rows; r++) {
        if (canA.rowPointers[r] !== canB.rowPointers[r]) {
          patternMatch = false;
          break;
        }
      }
      if (patternMatch) {
        for (let i = 0; i < canA.nnz; i++) {
          if (canA.columnIndices[i] !== canB.columnIndices[i]) {
            patternMatch = false;
            break;
          }
        }
      }
    }

    let maxAbsDiff = 0.0;
    let maxRelDiff = 0.0;
    let mismatches = 0;

    for (let r = 0; r < canA.rows; r++) {
      const entriesA = canA.getRowEntries(r);
      const entriesB = canB.getRowEntries(r);

      const mapA = new Map<number, number>();
      for (const e of entriesA) mapA.set(e.col, e.val);

      const mapB = new Map<number, number>();
      for (const e of entriesB) mapB.set(e.col, e.val);

      const allCols = new Set<number>([...mapA.keys(), ...mapB.keys()]);
      for (const c of allCols) {
        const vA = mapA.get(c) ?? 0.0;
        const vB = mapB.get(c) ?? 0.0;
        const absDiff = Math.abs(vA - vB);
        if (absDiff > maxAbsDiff) maxAbsDiff = absDiff;

        const scale = Math.max(Math.abs(vA), Math.abs(vB), 1.0);
        const relDiff = absDiff / scale;
        if (relDiff > maxRelDiff) maxRelDiff = relDiff;

        if (absDiff > tolerance) {
          mismatches++;
        }
      }
    }

    const valuesIdentical = mismatches === 0;

    return {
      arePatternIdentical: patternMatch,
      areValuesIdentical: valuesIdentical,
      maxAbsoluteDifference: maxAbsDiff,
      maxRelativeDifference: maxRelDiff,
      mismatchCount: mismatches,
      summary: valuesIdentical
        ? (patternMatch ? "Matrices are structurally and numerically identical" : "Values match within tolerance, but sparsity patterns differ")
        : `Matrices differ: ${mismatches} mismatches, maxAbsDiff=${maxAbsDiff.toExponential(3)}`
    };
  }
}
