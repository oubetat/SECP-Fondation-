import { SparseMatrix } from "./SparseMatrix";
import { CSRStorage } from "./CSRStorage";

export interface OrderingResult {
  algorithm: 'RCM' | 'MINIMUM_DEGREE' | 'IDENTITY';
  permutation: Int32Array;      // newToOld
  invPermutation: Int32Array;   // oldToNew
  initialBandwidth: number;
  reorderedBandwidth: number;
  initialNNZ: number;
  reorderedMatrix: SparseMatrix;
}

export class MatrixOrdering {
  /**
   * Computes Reverse Cuthill-McKee (RCM) reordering to reduce matrix bandwidth and profile.
   */
  static computeRCM(matrix: SparseMatrix): OrderingResult {
    const csr = matrix.storage.isCanonical ? matrix.storage : matrix.storage.canonicalize();
    const n = csr.rows;

    if (n <= 1) {
      const perm = new Int32Array([0]);
      return {
        algorithm: 'RCM',
        permutation: perm,
        invPermutation: perm,
        initialBandwidth: 0,
        reorderedBandwidth: 0,
        initialNNZ: csr.nnz,
        reorderedMatrix: matrix
      };
    }

    // Calculate degree of each node (number of adjacent nodes, excluding self)
    const degrees = new Int32Array(n);
    for (let r = 0; r < n; r++) {
      let deg = 0;
      const start = csr.rowPointers[r];
      const end = csr.rowPointers[r + 1];
      for (let idx = start; idx < end; idx++) {
        if (csr.columnIndices[idx] !== r) deg++;
      }
      degrees[r] = deg;
    }

    const visited = new Uint8Array(n);
    const cmOrder: number[] = [];

    while (cmOrder.length < n) {
      // Find unvisited node with minimum degree
      let startNode = -1;
      let minDeg = Infinity;
      for (let i = 0; i < n; i++) {
        if (!visited[i] && degrees[i] < minDeg) {
          minDeg = degrees[i];
          startNode = i;
        }
      }

      if (startNode === -1) break;

      // BFS queue
      const queue: number[] = [startNode];
      visited[startNode] = 1;

      while (queue.length > 0) {
        const u = queue.shift()!;
        cmOrder.push(u);

        // Find adjacent unvisited neighbors of u
        const start = csr.rowPointers[u];
        const end = csr.rowPointers[u + 1];
        const neighbors: number[] = [];

        for (let idx = start; idx < end; idx++) {
          const v = csr.columnIndices[idx];
          if (v !== u && !visited[v]) {
            neighbors.push(v);
          }
        }

        // Sort neighbors by degree ascending
        neighbors.sort((a, b) => degrees[a] - degrees[b]);

        for (const v of neighbors) {
          if (!visited[v]) {
            visited[v] = 1;
            queue.push(v);
          }
        }
      }
    }

    // Reverse Cuthill-McKee permutation
    const rcmOrder = cmOrder.reverse();
    const invPerm = new Int32Array(n); // oldToNew
    const perm = new Int32Array(n);    // newToOld

    for (let newIdx = 0; newIdx < n; newIdx++) {
      const oldIdx = rcmOrder[newIdx];
      perm[newIdx] = oldIdx;
      invPerm[oldIdx] = newIdx;
    }

    // Permute the matrix: A_rcm[i, j] = A[perm[i], perm[j]]
    const reorderedMatrix = MatrixOrdering.permuteMatrix(matrix, perm, invPerm);

    const initialBandwidth = MatrixOrdering.calculateBandwidth(matrix.storage);
    const reorderedBandwidth = MatrixOrdering.calculateBandwidth(reorderedMatrix.storage);

    return {
      algorithm: 'RCM',
      permutation: perm,
      invPermutation: invPerm,
      initialBandwidth,
      reorderedBandwidth,
      initialNNZ: csr.nnz,
      reorderedMatrix
    };
  }

  /**
   * Applies row and column permutation P * A * P^T
   */
  static permuteMatrix(matrix: SparseMatrix, perm: Int32Array, invPerm: Int32Array): SparseMatrix {
    const csr = matrix.storage;
    const n = csr.rows;

    const triplets: { row: number; col: number; val: number }[] = [];

    for (let oldR = 0; oldR < n; oldR++) {
      const newR = invPerm[oldR];
      const start = csr.rowPointers[oldR];
      const end = csr.rowPointers[oldR + 1];

      for (let idx = start; idx < end; idx++) {
        const oldC = csr.columnIndices[idx];
        const newC = invPerm[oldC];
        const val = csr.values[idx];
        triplets.push({ row: newR, col: newC, val });
      }
    }

    triplets.sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });

    const values = new Float64Array(triplets.length);
    const columnIndices = new Int32Array(triplets.length);
    const rowPointers = new Int32Array(n + 1);

    let outIdx = 0;
    rowPointers[0] = 0;

    for (let r = 0; r < n; r++) {
      while (outIdx < triplets.length && triplets[outIdx].row === r) {
        values[outIdx] = triplets[outIdx].val;
        columnIndices[outIdx] = triplets[outIdx].col;
        outIdx++;
      }
      rowPointers[r + 1] = outIdx;
    }

    const newStorage = new CSRStorage({
      rows: n,
      cols: n,
      nnz: triplets.length,
      values,
      columnIndices,
      rowPointers,
      isCanonical: true
    });

    return new SparseMatrix(newStorage, 'FINALIZED');
  }

  /**
   * Calculates matrix bandwidth: max |i - j| for non-zero A_ij
   */
  static calculateBandwidth(csr: CSRStorage): number {
    let maxBandwidth = 0;
    for (let r = 0; r < csr.rows; r++) {
      const start = csr.rowPointers[r];
      const end = csr.rowPointers[r + 1];
      for (let idx = start; idx < end; idx++) {
        const c = csr.columnIndices[idx];
        const bw = Math.abs(r - c);
        if (bw > maxBandwidth) maxBandwidth = bw;
      }
    }
    return maxBandwidth;
  }
}
