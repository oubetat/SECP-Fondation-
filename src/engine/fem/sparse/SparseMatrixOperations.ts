import { CSRStorage } from "./CSRStorage";

export class SparseMatrixOperations {
  /**
   * Sparse Matrix-Vector Multiplication: y = A * x
   * Direct sparse execution O(nnz), zero dense matrix expansion.
   */
  static spmv(A: CSRStorage, x: ArrayLike<number>, yOut?: Float64Array): Float64Array {
    if (x.length !== A.cols) {
      throw new Error(`Incompatible dimensions for SpMV: Matrix ${A.rows}x${A.cols}, vector length ${x.length}`);
    }

    const y = yOut ?? new Float64Array(A.rows);
    if (y.length !== A.rows) {
      throw new Error(`Output vector length (${y.length}) does not match matrix rows (${A.rows})`);
    }

    for (let r = 0; r < A.rows; r++) {
      let sum = 0.0;
      const start = A.rowPointers[r];
      const end = A.rowPointers[r + 1];

      for (let idx = start; idx < end; idx++) {
        sum += A.values[idx] * x[A.columnIndices[idx]];
      }
      y[r] = sum;
    }

    return y;
  }

  /**
   * Sparse Transpose: A^T
   * Computes CSR format of transpose in O(nnz + cols) time using column counting.
   */
  static transpose(A: CSRStorage): CSRStorage {
    const rows = A.rows;
    const cols = A.cols;
    const nnz = A.nnz;

    // 1. Count entries per column in A (which becomes rows in A^T)
    const colCounts = new Int32Array(cols);
    for (let i = 0; i < nnz; i++) {
      colCounts[A.columnIndices[i]]++;
    }

    // 2. Build row pointers for A^T
    const tRowPointers = new Int32Array(cols + 1);
    tRowPointers[0] = 0;
    for (let c = 0; c < cols; c++) {
      tRowPointers[c + 1] = tRowPointers[c] + colCounts[c];
    }

    // 3. Fill values and column indices for A^T
    const nextPositions = new Int32Array(tRowPointers);
    const tValues = new Float64Array(nnz);
    const tColIndices = new Int32Array(nnz);

    for (let r = 0; r < rows; r++) {
      const start = A.rowPointers[r];
      const end = A.rowPointers[r + 1];

      for (let idx = start; idx < end; idx++) {
        const c = A.columnIndices[idx];
        const val = A.values[idx];
        const dest = nextPositions[c]++;
        tValues[dest] = val;
        tColIndices[dest] = r;
      }
    }

    const tCSR = new CSRStorage({
      rows: cols,
      cols: rows,
      nnz,
      values: tValues,
      columnIndices: tColIndices,
      rowPointers: tRowPointers,
      isCanonical: false
    });

    return tCSR.canonicalize();
  }

  /**
   * Sparse Matrix Addition: C = A + B
   * Merges row entries of two sparse matrices in O(nnz(A) + nnz(B)) time.
   */
  static add(A: CSRStorage, B: CSRStorage): CSRStorage {
    if (A.rows !== B.rows || A.cols !== B.cols) {
      throw new Error(`Matrix dimension mismatch in sparse addition: (${A.rows}x${A.cols}) vs (${B.rows}x${B.cols})`);
    }

    const rows = A.rows;
    const cols = A.cols;

    // First pass: count NNZ for each row
    const cRowCounts = new Int32Array(rows);
    let estimatedTotalNNZ = 0;

    for (let r = 0; r < rows; r++) {
      let count = 0;
      let pA = A.rowPointers[r];
      const endA = A.rowPointers[r + 1];
      let pB = B.rowPointers[r];
      const endB = B.rowPointers[r + 1];

      while (pA < endA && pB < endB) {
        const colA = A.columnIndices[pA];
        const colB = B.columnIndices[pB];
        if (colA === colB) {
          count++;
          pA++;
          pB++;
        } else if (colA < colB) {
          count++;
          pA++;
        } else {
          count++;
          pB++;
        }
      }
      count += (endA - pA) + (endB - pB);
      cRowCounts[r] = count;
      estimatedTotalNNZ += count;
    }

    // Allocate C
    const cRowPointers = new Int32Array(rows + 1);
    cRowPointers[0] = 0;
    for (let r = 0; r < rows; r++) {
      cRowPointers[r + 1] = cRowPointers[r] + cRowCounts[r];
    }

    const cValues = new Float64Array(estimatedTotalNNZ);
    const cColIndices = new Int32Array(estimatedTotalNNZ);

    // Second pass: fill entries
    for (let r = 0; r < rows; r++) {
      let destIdx = cRowPointers[r];
      let pA = A.rowPointers[r];
      const endA = A.rowPointers[r + 1];
      let pB = B.rowPointers[r];
      const endB = B.rowPointers[r + 1];

      while (pA < endA && pB < endB) {
        const colA = A.columnIndices[pA];
        const colB = B.columnIndices[pB];
        if (colA === colB) {
          cColIndices[destIdx] = colA;
          cValues[destIdx] = A.values[pA] + B.values[pB];
          pA++;
          pB++;
          destIdx++;
        } else if (colA < colB) {
          cColIndices[destIdx] = colA;
          cValues[destIdx] = A.values[pA];
          pA++;
          destIdx++;
        } else {
          cColIndices[destIdx] = colB;
          cValues[destIdx] = B.values[pB];
          pB++;
          destIdx++;
        }
      }

      while (pA < endA) {
        cColIndices[destIdx] = A.columnIndices[pA];
        cValues[destIdx] = A.values[pA];
        pA++;
        destIdx++;
      }

      while (pB < endB) {
        cColIndices[destIdx] = B.columnIndices[pB];
        cValues[destIdx] = B.values[pB];
        pB++;
        destIdx++;
      }
    }

    return new CSRStorage({
      rows,
      cols,
      nnz: estimatedTotalNNZ,
      values: cValues,
      columnIndices: cColIndices,
      rowPointers: cRowPointers,
      isCanonical: true
    });
  }

  /**
   * Sparse Scalar Multiplication: C = alpha * A
   */
  static scale(A: CSRStorage, alpha: number): CSRStorage {
    const newValues = new Float64Array(A.nnz);
    for (let i = 0; i < A.nnz; i++) {
      newValues[i] = A.values[i] * alpha;
    }
    return new CSRStorage({
      rows: A.rows,
      cols: A.cols,
      nnz: A.nnz,
      values: newValues,
      columnIndices: new Int32Array(A.columnIndices),
      rowPointers: new Int32Array(A.rowPointers),
      isCanonical: A.isCanonical
    });
  }

  /**
   * Frobenius Norm: sqrt(sum(A_ij^2))
   */
  static frobeniusNorm(A: CSRStorage): number {
    let sumSq = 0.0;
    for (let i = 0; i < A.nnz; i++) {
      sumSq += A.values[i] * A.values[i];
    }
    return Math.sqrt(sumSq);
  }

  /**
   * Infinity Norm: max_i (sum_j |A_ij|)
   */
  static infNorm(A: CSRStorage): number {
    let maxRowSum = 0.0;
    for (let r = 0; r < A.rows; r++) {
      let rowSum = 0.0;
      const start = A.rowPointers[r];
      const end = A.rowPointers[r + 1];
      for (let idx = start; idx < end; idx++) {
        rowSum += Math.abs(A.values[idx]);
      }
      if (rowSum > maxRowSum) maxRowSum = rowSum;
    }
    return maxRowSum;
  }

  /**
   * 1-Norm: max_j (sum_i |A_ij|)
   */
  static oneNorm(A: CSRStorage): number {
    const colSums = new Float64Array(A.cols);
    for (let i = 0; i < A.nnz; i++) {
      colSums[A.columnIndices[i]] += Math.abs(A.values[i]);
    }
    let maxColSum = 0.0;
    for (let c = 0; c < A.cols; c++) {
      if (colSums[c] > maxColSum) maxColSum = colSums[c];
    }
    return maxColSum;
  }

  /**
   * Sparse Matrix Subtraction: C = A - B
   */
  static subtract(A: CSRStorage, B: CSRStorage): CSRStorage {
    const scaledB = SparseMatrixOperations.scale(B, -1.0);
    return SparseMatrixOperations.add(A, scaledB);
  }

  /**
   * Sparse Matrix-Matrix Multiplication: C = A * B
   * Computes CSR product directly in O(nnz(A) * avg_nnz_row(B)) without dense expansion.
   */
  static multiplyMatrix(A: CSRStorage, B: CSRStorage): CSRStorage {
    if (A.cols !== B.rows) {
      throw new Error(`Incompatible matrix dimensions for multiplication: (${A.rows}x${A.cols}) * (${B.rows}x${B.cols})`);
    }

    const rowsA = A.rows;
    const colsB = B.cols;

    // Use a dense accumulator array per row (size colsB) to aggregate non-zero values
    const denseRow = new Float64Array(colsB);
    const marker = new Int32Array(colsB);
    marker.fill(-1);

    const rowTriplets: { row: number; col: number; val: number }[] = [];

    for (let i = 0; i < rowsA; i++) {
      const startA = A.rowPointers[i];
      const endA = A.rowPointers[i + 1];

      let nonZeroColsInRow: number[] = [];

      for (let pA = startA; pA < endA; pA++) {
        const k = A.columnIndices[pA];
        const valA = A.values[pA];

        const startB = B.rowPointers[k];
        const endB = B.rowPointers[k + 1];

        for (let pB = startB; pB < endB; pB++) {
          const j = B.columnIndices[pB];
          const valB = B.values[pB];

          if (marker[j] !== i) {
            marker[j] = i;
            denseRow[j] = valA * valB;
            nonZeroColsInRow.push(j);
          } else {
            denseRow[j] += valA * valB;
          }
        }
      }

      for (const j of nonZeroColsInRow) {
        if (Math.abs(denseRow[j]) > 1e-15) {
          rowTriplets.push({ row: i, col: j, val: denseRow[j] });
        }
        denseRow[j] = 0.0;
      }
    }

    // Convert rowTriplets to CSR
    const nnzC = rowTriplets.length;
    rowTriplets.sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });

    const cValues = new Float64Array(nnzC);
    const cColIndices = new Int32Array(nnzC);
    const cRowPointers = new Int32Array(rowsA + 1);

    let outIdx = 0;
    cRowPointers[0] = 0;

    for (let r = 0; r < rowsA; r++) {
      while (outIdx < nnzC && rowTriplets[outIdx].row === r) {
        cValues[outIdx] = rowTriplets[outIdx].val;
        cColIndices[outIdx] = rowTriplets[outIdx].col;
        outIdx++;
      }
      cRowPointers[r + 1] = outIdx;
    }

    return new CSRStorage({
      rows: rowsA,
      cols: colsB,
      nnz: nnzC,
      values: cValues,
      columnIndices: cColIndices,
      rowPointers: cRowPointers,
      isCanonical: true
    });
  }

  /**
   * Extract Diagonal Vector: d_i = A_ii
   */
  static extractDiagonal(A: CSRStorage): Float64Array {
    const minDim = Math.min(A.rows, A.cols);
    const diag = new Float64Array(minDim);
    for (let i = 0; i < minDim; i++) {
      diag[i] = A.get(i, i);
    }
    return diag;
  }

  /**
   * Pure Sparse-to-Sparse Symmetry Verification:
   * Compares A[i, j] against A[j, i] directly without any dense matrix conversion.
   * Tracks exact maxDiff = max |A_ij - A_ji|.
   */
  static isSymmetric(A: CSRStorage, tolerance: number = 1e-8): { isSymmetric: boolean; maxDiff: number } {
    if (A.rows !== A.cols) {
      return { isSymmetric: false, maxDiff: Infinity };
    }

    const canonicalA = A.isCanonical ? A : A.canonicalize();
    let maxDiff = 0.0;

    for (let r = 0; r < canonicalA.rows; r++) {
      const start = canonicalA.rowPointers[r];
      const end = canonicalA.rowPointers[r + 1];

      for (let idx = start; idx < end; idx++) {
        const c = canonicalA.columnIndices[idx];
        if (c < r) continue; // Only check upper triangle against lower triangle

        const valRC = canonicalA.values[idx];
        const valCR = canonicalA.get(c, r);
        const diff = Math.abs(valRC - valCR);

        if (diff > maxDiff) {
          maxDiff = diff;
        }

        const scale = Math.max(Math.abs(valRC), Math.abs(valCR), 1.0);
        if (diff > tolerance * scale && diff > tolerance) {
          return { isSymmetric: false, maxDiff };
        }
      }
    }

    return { isSymmetric: maxDiff <= tolerance, maxDiff };
  }
}
