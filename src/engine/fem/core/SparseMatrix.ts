/**
 * SECP Industrial OS — FEM Core Numerical Upgrade (SECP-FEM-UPGRADE-001)
 * SparseMatrix.ts
 * 
 * Production-grade Sparse Matrix implementation supporting:
 * 1. Fast Coordinate/DOK Assembly: O(1) accumulation of overlapping element DOFs.
 * 2. Compressed Sparse Row (CSR) storage: Zero-overhead memory footprint and cache-friendly SpMV.
 * 3. Finite value validation (rejects NaN, Inf).
 * 4. Symmetric submatrix extraction for direct elimination / DOF partitioning.
 * 5. Direct equivalence verification against dense matrices for mathematical validation.
 */

import { Matrix } from "./MathUtils";

export interface CSRData {
  readonly values: Float64Array;
  readonly colIndices: Int32Array;
  readonly rowPointers: Int32Array;
  readonly rows: number;
  readonly cols: number;
  readonly nnz: number;
}

export class SparseMatrix {
  public readonly rows: number;
  public readonly cols: number;

  // DOK (Dictionary of Keys) representation for dynamic assembly:
  // row -> Map(col -> value)
  private dok: Map<number, Map<number, number>>;
  
  // Cached CSR representation
  private cachedCSR: CSRData | null = null;
  private isDirty: boolean = true;

  constructor(rows: number, cols: number) {
    if (rows < 0 || cols < 0) {
      throw new Error(`[SPARSE_INVALID_DIMS] Matrix dimensions must be non-negative integers: rows=${rows}, cols=${cols}`);
    }
    this.rows = rows;
    this.cols = cols;
    this.dok = new Map<number, Map<number, number>>();
  }

  /**
   * Add a value to matrix at (r, c). Accumulates with existing entries (crucial for FEM assembly).
   */
  public add(r: number, c: number, v: number): void {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) {
      throw new Error(`[SPARSE_OUT_OF_BOUNDS] Index (${r}, ${c}) out of bounds for matrix ${this.rows}x${this.cols}`);
    }

    if (!Number.isFinite(v)) {
      throw new Error(`[NUMERICAL_ERROR] Attempted to insert non-finite value (${v}) at index (${r}, ${c})`);
    }

    if (Math.abs(v) < 1e-25) {
      return; // Ignore sub-numerical zero additions
    }

    let rowMap = this.dok.get(r);
    if (!rowMap) {
      rowMap = new Map<number, number>();
      this.dok.set(r, rowMap);
    }

    const currentVal = rowMap.get(c) || 0;
    const newVal = currentVal + v;
    rowMap.set(c, newVal);
    this.isDirty = true;
  }

  /**
   * Set a value at (r, c).
   */
  public set(r: number, c: number, v: number): void {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) {
      throw new Error(`[SPARSE_OUT_OF_BOUNDS] Index (${r}, ${c}) out of bounds for matrix ${this.rows}x${this.cols}`);
    }

    if (!Number.isFinite(v)) {
      throw new Error(`[NUMERICAL_ERROR] Attempted to set non-finite value (${v}) at index (${r}, ${c})`);
    }

    let rowMap = this.dok.get(r);
    if (!rowMap) {
      rowMap = new Map<number, number>();
      this.dok.set(r, rowMap);
    }

    rowMap.set(c, v);
    this.isDirty = true;
  }

  /**
   * Get value at (r, c).
   */
  public get(r: number, c: number): number {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) {
      throw new Error(`[SPARSE_OUT_OF_BOUNDS] Index (${r}, ${c}) out of bounds for matrix ${this.rows}x${this.cols}`);
    }
    const rowMap = this.dok.get(r);
    if (!rowMap) return 0;
    return rowMap.get(c) || 0;
  }

  /**
   * Count total non-zero entries (nnz).
   */
  public getNNZ(): number {
    let count = 0;
    for (const rowMap of this.dok.values()) {
      for (const val of rowMap.values()) {
        if (Math.abs(val) > 1e-25) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Compile and cache the Compressed Sparse Row (CSR) representation.
   */
  public toCSR(): CSRData {
    if (!this.isDirty && this.cachedCSR) {
      return this.cachedCSR;
    }

    const nnz = this.getNNZ();
    const values = new Float64Array(nnz);
    const colIndices = new Int32Array(nnz);
    const rowPointers = new Int32Array(this.rows + 1);

    let currentIdx = 0;
    rowPointers[0] = 0;

    for (let r = 0; r < this.rows; r++) {
      const rowMap = this.dok.get(r);
      if (rowMap) {
        // Sort column indices for canonical CSR access
        const sortedCols = Array.from(rowMap.keys()).sort((a, b) => a - b);
        for (const c of sortedCols) {
          const val = rowMap.get(c)!;
          if (Math.abs(val) > 1e-25) {
            values[currentIdx] = val;
            colIndices[currentIdx] = c;
            currentIdx++;
          }
        }
      }
      rowPointers[r + 1] = currentIdx;
    }

    this.cachedCSR = {
      values,
      colIndices,
      rowPointers,
      rows: this.rows,
      cols: this.cols,
      nnz: currentIdx
    };
    this.isDirty = false;
    return this.cachedCSR;
  }

  /**
   * Fast Sparse Matrix-Vector Product: y = A * x
   * Time complexity: O(nnz). No dense memory allocation.
   */
  public multiplyVector(vec: number[] | Float64Array): Float64Array {
    if (vec.length !== this.cols) {
      throw new Error(`[SPARSE_DIM_MISMATCH] SpMV size mismatch: matrix cols=${this.cols}, vector length=${vec.length}`);
    }

    const csr = this.toCSR();
    const result = new Float64Array(this.rows);

    for (let r = 0; r < this.rows; r++) {
      let sum = 0;
      const start = csr.rowPointers[r];
      const end = csr.rowPointers[r + 1];
      for (let idx = start; idx < end; idx++) {
        sum += csr.values[idx] * vec[csr.colIndices[idx]];
      }
      result[r] = sum;
    }

    return result;
  }

  /**
   * Extract main diagonal entries.
   */
  public getDiagonal(): Float64Array {
    const minDim = Math.min(this.rows, this.cols);
    const diag = new Float64Array(minDim);
    for (let i = 0; i < minDim; i++) {
      diag[i] = this.get(i, i);
    }
    return diag;
  }

  /**
   * Extract an arbitrary submatrix given row indices and column indices.
   * Essential for Direct Elimination / Equation Partitioning (K_ff, K_fc, etc.).
   */
  public extractSubmatrix(rowIndices: readonly number[], colIndices: readonly number[]): SparseMatrix {
    const sub = new SparseMatrix(rowIndices.length, colIndices.length);

    // Map old column index to new submatrix column index for O(1) lookups
    const colMap = new Map<number, number>();
    for (let j = 0; j < colIndices.length; j++) {
      colMap.set(colIndices[j], j);
    }

    for (let newR = 0; newR < rowIndices.length; newR++) {
      const origR = rowIndices[newR];
      const origRowMap = this.dok.get(origR);
      if (!origRowMap) continue;

      for (const [origC, val] of origRowMap.entries()) {
        const newC = colMap.get(origC);
        if (newC !== undefined && Math.abs(val) > 1e-25) {
          sub.set(newR, newC, val);
        }
      }
    }

    return sub;
  }

  /**
   * Check for symmetry within relative tolerance.
   */
  public isSymmetric(tol = 1e-6): boolean {
    if (this.rows !== this.cols) return false;
    let maxVal = 0;
    for (const rowMap of this.dok.values()) {
      for (const v of rowMap.values()) {
        const abs = Math.abs(v);
        if (abs > maxVal) maxVal = abs;
      }
    }
    const absTol = maxVal > 1 ? tol * maxVal : tol;

    for (const [r, rowMap] of this.dok.entries()) {
      for (const [c, v1] of rowMap.entries()) {
        if (c > r) {
          const v2 = this.get(c, r);
          if (Math.abs(v1 - v2) > absTol) {
            return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * Converts to standard dense Matrix for testing, debugging, and verification against legacy solver.
   */
  public toDense(): Matrix {
    const dense = Matrix.zeros(this.rows, this.cols);
    for (const [r, rowMap] of this.dok.entries()) {
      for (const [c, val] of rowMap.entries()) {
        dense.set(r, c, val);
      }
    }
    return dense;
  }

  /**
   * Static constructor: Create SparseMatrix from an existing dense Matrix.
   */
  public static fromDense(dense: Matrix, zeroThreshold = 1e-25): SparseMatrix {
    const sparse = new SparseMatrix(dense.rows, dense.cols);
    for (let r = 0; r < dense.rows; r++) {
      for (let c = 0; c < dense.cols; c++) {
        const val = dense.get(r, c);
        if (Math.abs(val) > zeroThreshold) {
          sparse.set(r, c, val);
        }
      }
    }
    return sparse;
  }
}
