import { CSRStorage } from '../sparse/CSRStorage';
import { SparseMatrix } from '../sparse/SparseMatrix';
import { SolverFailureType } from './types';

export interface SolverBackendStatistics {
  factorizationTimeMs: number;
  solveTimeMs: number;
  factorNNZ: number;
  fillInRatio: number;
  factorizationMemoryBytes: number;
  conditionEstimate: number;
}

export interface LinearSolverBackend {
  analyze(A: SparseMatrix): void;
  factorize(A: SparseMatrix): { success: boolean; failureType: SolverFailureType; reason?: string };
  solve(b: number[]): number[];
  estimateCondition(): number;
  getStatistics(): SolverBackendStatistics;
}

/**
 * Direct Sparse Solver Backend using Cholesky (L D L^T) / Sparse Elimination.
 * Operates directly on CSR sparse structures with zero dense intermediate allocations.
 * Detects singular systems and rigid body modes reliably.
 */
export class SparseDirectBackend implements LinearSolverBackend {
  private n: number = 0;
  private isFactorized: boolean = false;
  private factorNNZ: number = 0;
  private fillInRatio: number = 1.0;
  private factorizationTimeMs: number = 0;
  private solveTimeMs: number = 0;
  private condEstimate: number = 1.0;

  // Sparse LDLT representation: L lower triangular CSR, D diagonal array
  private L_csr?: CSRStorage;
  private D_diag?: Float64Array;

  analyze(A: SparseMatrix): void {
    this.n = A.rows;
    this.isFactorized = false;
  }

  /**
   * Factorizes symmetric matrix Kff into L D L^T using direct sparse LDLT decomposition.
   */
  factorize(A: SparseMatrix): { success: boolean; failureType: SolverFailureType; reason?: string } {
    const startTime = performance.now();
    this.n = A.rows;
    const n = this.n;

    if (n === 0) {
      return { success: false, failureType: 'INVALID_MODEL', reason: 'Zero-sized matrix' };
    }

    const csr = A.storage;

    // Convert CSR to an efficient sparse profile / row-lookup representation for LDL^T factorization
    // For each row i, store non-zero entries in column j <= i.
    const D = new Float64Array(n);
    const L_rows: { col: number; val: number }[][] = Array.from({ length: n }, () => []);

    // Fill initial entries from A into L structure
    for (let i = 0; i < n; i++) {
      const rowStart = csr.rowPointers[i];
      const rowEnd = csr.rowPointers[i + 1];
      for (let p = rowStart; p < rowEnd; p++) {
        const j = csr.columnIndices[p];
        const val = csr.values[p];
        if (j <= i) {
          if (j === i) {
            D[i] += val;
          } else {
            L_rows[i].push({ col: j, val });
          }
        }
      }
    }

    // Sparse LDL^T factorization
    // K = L D L^T where L is unit lower triangular (L_ii = 1)
    // For each row i:
    // L_ij = (A_ij - sum_{k < j} L_ik * D_k * L_jk) / D_j
    // D_i = A_ii - sum_{k < i} L_ik^2 * D_k
    for (let i = 0; i < n; i++) {
      // Process row i
      // First, sort L_rows[i] by column index
      L_rows[i].sort((a, b) => a.col - b.col);

      // Compute L_ij for j < i
      const row_i_map = new Map<number, number>();
      for (const item of L_rows[i]) {
        row_i_map.set(item.col, item.val);
      }

      for (let idx = 0; idx < L_rows[i].length; idx++) {
        const j = L_rows[i][idx].col;

        let sum = 0;
        // sum over k < j of L_ik * D_k * L_jk
        for (const item_k of L_rows[j]) {
          const k = item_k.col;
          const L_ik = row_i_map.get(k);
          if (L_ik !== undefined) {
            const L_jk = item_k.val;
            sum += L_ik * D[k] * L_jk;
          }
        }

        const A_ij = row_i_map.get(j)!;
        const L_ij = (A_ij - sum) / D[j];
        row_i_map.set(j, L_ij);
        L_rows[i][idx].val = L_ij;
      }

      // Compute D_i = A_ii - sum_{k < i} L_ik^2 * D_k
      let d_sum = 0;
      for (const item of L_rows[i]) {
        const k = item.col;
        const L_ik = item.val;
        d_sum += L_ik * L_ik * D[k];
      }

      D[i] = D[i] - d_sum;

      // Singularity & Zero Pivot Check
      if (!Number.isFinite(D[i]) || Math.abs(D[i]) < 1e-12) {
        const endTime = performance.now();
        this.factorizationTimeMs = endTime - startTime;
        return {
          success: false,
          failureType: 'SINGULAR_SYSTEM',
          reason: `Zero or near-zero pivot detected at row/DOF ${i} (pivot=${D[i]}). System is singular or has unconstrained rigid body modes.`
        };
      }
    }

    this.D_diag = D;

    // Convert L_rows back to canonical CSR format for fast sparse triangular solves
    let total_L_nnz = 0;
    for (let i = 0; i < n; i++) {
      total_L_nnz += L_rows[i].length + 1; // +1 for diagonal 1.0
    }

    const L_rowPointers = new Int32Array(n + 1);
    const L_columnIndices = new Int32Array(total_L_nnz);
    const L_values = new Float64Array(total_L_nnz);

    let ptr = 0;
    for (let i = 0; i < n; i++) {
      L_rowPointers[i] = ptr;
      // Add off-diagonal L_ij
      for (const item of L_rows[i]) {
        L_columnIndices[ptr] = item.col;
        L_values[ptr] = item.val;
        ptr++;
      }
      // Add diagonal 1.0
      L_columnIndices[ptr] = i;
      L_values[ptr] = 1.0;
      ptr++;
    }
    L_rowPointers[n] = ptr;

    this.L_csr = new CSRStorage({
      rows: n,
      cols: n,
      nnz: total_L_nnz,
      values: L_values,
      columnIndices: L_columnIndices,
      rowPointers: L_rowPointers,
      isCanonical: true
    });

    this.factorNNZ = total_L_nnz;
    this.fillInRatio = total_L_nnz / Math.max(1, A.nnz);
    this.isFactorized = true;

    // Estimate condition number via pivot ratio
    let minD = Infinity;
    let maxD = -Infinity;
    for (let i = 0; i < n; i++) {
      const absD = Math.abs(D[i]);
      if (absD < minD) minD = absD;
      if (absD > maxD) maxD = absD;
    }
    this.condEstimate = minD > 0 ? maxD / minD : Infinity;

    const endTime = performance.now();
    this.factorizationTimeMs = Math.max(0.001, endTime - startTime);

    return { success: true, failureType: 'NONE' };
  }

  /**
   * Solves L D L^T u = b
   * 1. Forward substitution: L y = b
   * 2. Diagonal scaling: z = D^-1 y
   * 3. Backward substitution: L^T u = z
   */
  solve(b: number[]): number[] {
    if (!this.isFactorized || !this.L_csr || !this.D_diag) {
      throw new Error('Backend is not factorized. Call factorize() first.');
    }

    const startTime = performance.now();
    const n = this.n;
    if (b.length !== n) {
      throw new Error(`RHS dimension mismatch: expected ${n}, got ${b.length}`);
    }

    const L = this.L_csr;
    const D = this.D_diag;

    // 1. Forward solve: L y = b (L is unit lower triangular)
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sum = b[i];
      const rowStart = L.rowPointers[i];
      const rowEnd = L.rowPointers[i + 1];
      // Off-diagonal entries are all j < i
      for (let p = rowStart; p < rowEnd - 1; p++) {
        const j = L.columnIndices[p];
        sum -= L.values[p] * y[j];
      }
      y[i] = sum; // L_ii = 1.0
    }

    // 2. Diagonal solve: z_i = y_i / D_i
    const z = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      z[i] = y[i] / D[i];
    }

    // 3. Backward solve: L^T u = z
    const u = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let sum = z[i];
      // For row i in L^T, it corresponds to column i in L.
      // We can use accumulated backward substitution or scatter:
      sum -= u[i]; // U_ii = 1.0
      // Instead of column search in L, scatter u[i] to earlier entries in L
      // u[i] is already sum
      u[i] = sum;

      // Update remaining right-hand sides for k < i where L_{i, k} is non-zero
      const rowStart = L.rowPointers[i];
      const rowEnd = L.rowPointers[i + 1];
      for (let p = rowStart; p < rowEnd - 1; p++) {
        const k = L.columnIndices[p];
        z[k] -= L.values[p] * u[i];
      }
    }

    const endTime = performance.now();
    this.solveTimeMs = Math.max(0.001, endTime - startTime);

    return Array.from(u);
  }

  estimateCondition(): number {
    return this.condEstimate;
  }

  getStatistics(): SolverBackendStatistics {
    return {
      factorizationTimeMs: this.factorizationTimeMs,
      solveTimeMs: this.solveTimeMs,
      factorNNZ: this.factorNNZ,
      fillInRatio: this.fillInRatio,
      factorizationMemoryBytes: (this.factorNNZ * 12) + (this.n * 8),
      conditionEstimate: this.condEstimate
    };
  }
}
