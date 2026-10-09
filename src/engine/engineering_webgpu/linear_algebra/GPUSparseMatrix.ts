/**
 * GPUSparseMatrix.ts
 * PHASE 27 — Hardware Acceleration (PATCH-297 — GPU Linear Algebra)
 * Compressed Sparse Row (CSR) Format, Integrity Validation, FEM/CFD Matrix Generators,
 * Bounds Protection and Structural Equality Verification.
 */

import {
  CSRMatrixData,
  CSRValidationResult,
  GPUSparseMatrix,
} from './GPULinearAlgebraTypes';

export class GPUSparseMatrixHelper {
  /**
   * Validates CSR invariants:
   * 1. rowPointers length is rows + 1
   * 2. rowPointers[0] == 0 and rowPointers[rows] == nnz
   * 3. rowPointers is monotonically non-decreasing
   * 4. columnIndices length == nnz, values length == nnz
   * 5. columnIndices within bounds [0, columns - 1]
   * 6. columnIndices sorted per row (warning if unsorted)
   */
  public static validateCSR(csr: CSRMatrixData): CSRValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const { rows, columns, nnz, values, columnIndices, rowPointers } = csr;

    if (rows <= 0 || columns <= 0) {
      errors.push(`Invalid matrix dimensions: ${rows}x${columns}`);
    }

    if (rowPointers.length !== rows + 1) {
      errors.push(
        `rowPointers length (${rowPointers.length}) must equal rows + 1 (${rows + 1})`
      );
    }

    if (rowPointers.length > 0 && rowPointers[0] !== 0) {
      errors.push(`rowPointers[0] must be 0, found ${rowPointers[0]}`);
    }

    if (rowPointers.length > 0 && rowPointers[rows] !== nnz) {
      errors.push(
        `rowPointers[rows] (${rowPointers[rows]}) must equal nnz (${nnz})`
      );
    }

    if (values.length !== nnz) {
      errors.push(`values array length (${values.length}) must equal nnz (${nnz})`);
    }

    if (columnIndices.length !== nnz) {
      errors.push(
        `columnIndices array length (${columnIndices.length}) must equal nnz (${nnz})`
      );
    }

    let emptyRowCount = 0;
    let maxRowNNZ = 0;
    let minRowNNZ = Number.POSITIVE_INFINITY;
    let isSorted = true;

    if (rowPointers.length === rows + 1) {
      for (let r = 0; r < rows; r++) {
        const start = rowPointers[r];
        const end = rowPointers[r + 1];

        if (end < start) {
          errors.push(
            `rowPointers is not monotonic at row ${r}: start=${start}, end=${end}`
          );
          continue;
        }

        const rowLen = end - start;
        if (rowLen === 0) {
          emptyRowCount++;
        }
        if (rowLen > maxRowNNZ) maxRowNNZ = rowLen;
        if (rowLen < minRowNNZ) minRowNNZ = rowLen;

        let prevCol = -1;
        for (let idx = start; idx < end; idx++) {
          const col = columnIndices[idx];
          if (col >= columns) {
            errors.push(
              `Column index out of bounds at row ${r}, index ${idx}: col=${col} >= columns=${columns}`
            );
          }
          if (col <= prevCol) {
            isSorted = false;
            if (col === prevCol) {
              errors.push(
                `Duplicate column index ${col} detected in row ${r}`
              );
            } else {
              warnings.push(
                `Column indices unsorted in row ${r}: ${prevCol} before ${col}`
              );
            }
          }
          prevCol = col;
        }
      }
    }

    if (minRowNNZ === Number.POSITIVE_INFINITY) minRowNNZ = 0;

    const totalElements = rows * columns;
    const sparsityRatio = totalElements > 0 ? 1 - nnz / totalElements : 1.0;

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metrics: {
        rows,
        columns,
        nnz,
        sparsityRatio,
        emptyRowCount,
        maxRowNNZ,
        minRowNNZ,
        avgRowNNZ: rows > 0 ? nnz / rows : 0,
        isSortedColumns: isSorted,
      },
    };
  }

  /**
   * Converts a dense 2D matrix (represented as 1D array row-major) to CSR format.
   */
  public static fromDense(
    denseData: Float32Array | number[],
    rows: number,
    columns: number,
    epsilonZero = 1e-12
  ): CSRMatrixData {
    const valList: number[] = [];
    const colList: number[] = [];
    const rowPointers = new Uint32Array(rows + 1);

    let currentNNZ = 0;
    rowPointers[0] = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const val = denseData[r * columns + c];
        if (Math.abs(val) > epsilonZero) {
          valList.push(val);
          colList.push(c);
          currentNNZ++;
        }
      }
      rowPointers[r + 1] = currentNNZ;
    }

    return {
      rows,
      columns,
      nnz: currentNNZ,
      values: new Float32Array(valList),
      columnIndices: new Uint32Array(colList),
      rowPointers,
    };
  }

  /**
   * Converts CSR back to a dense matrix representation.
   */
  public static toDense(csr: CSRMatrixData): Float32Array {
    const { rows, columns, values, columnIndices, rowPointers } = csr;
    const dense = new Float32Array(rows * columns);

    for (let r = 0; r < rows; r++) {
      const start = rowPointers[r];
      const end = rowPointers[r + 1];
      for (let idx = start; idx < end; idx++) {
        const c = columnIndices[idx];
        dense[r * columns + c] = values[idx];
      }
    }

    return dense;
  }

  /**
   * Generates a 1D/2D Laplacian / Poisson discretization matrix in CSR (CFD/Thermal stencil)
   * 5-point stencil on grid of size N x N (yielding matrix of dimension N^2 x N^2)
   */
  public static generatePoisson2DCSR(gridSize: number): CSRMatrixData {
    const n = gridSize;
    const rows = n * n;
    const columns = rows;

    const valList: number[] = [];
    const colList: number[] = [];
    const rowPointers = new Uint32Array(rows + 1);

    let nnzCount = 0;
    rowPointers[0] = 0;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const row = i * n + j;

        // Collect elements for this row sorted by col index
        const rowEntries: Array<{ col: number; val: number }> = [];

        // Down neighbor
        if (i > 0) rowEntries.push({ col: (i - 1) * n + j, val: -1.0 });
        // Left neighbor
        if (j > 0) rowEntries.push({ col: i * n + (j - 1), val: -1.0 });
        // Center diagonal
        rowEntries.push({ col: row, val: 4.0 });
        // Right neighbor
        if (j < n - 1) rowEntries.push({ col: i * n + (j + 1), val: -1.0 });
        // Up neighbor
        if (i < n - 1) rowEntries.push({ col: (i + 1) * n + j, val: -1.0 });

        // Sort by column index
        rowEntries.sort((a, b) => a.col - b.col);

        for (const e of rowEntries) {
          valList.push(e.val);
          colList.push(e.col);
          nnzCount++;
        }

        rowPointers[row + 1] = nnzCount;
      }
    }

    return {
      rows,
      columns,
      nnz: nnzCount,
      values: new Float32Array(valList),
      columnIndices: new Uint32Array(colList),
      rowPointers,
    };
  }

  /**
   * Generates an FEM 1D/2D Structural Stiffness matrix preset in CSR format
   */
  public static generateFEMStiffnessCSR(numNodes: number, dofPerNode = 2): CSRMatrixData {
    const totalDof = numNodes * dofPerNode;
    const rows = totalDof;
    const columns = totalDof;

    const valList: number[] = [];
    const colList: number[] = [];
    const rowPointers = new Uint32Array(rows + 1);

    let nnzCount = 0;
    rowPointers[0] = 0;

    for (let r = 0; r < rows; r++) {
      const rowEntries: Array<{ col: number; val: number }> = [];

      // Banded structural coupling with neighboring nodes
      const nodeIdx = Math.floor(r / dofPerNode);
      const dofIdx = r % dofPerNode;

      for (let offset = -1; offset <= 1; offset++) {
        const neighborNode = nodeIdx + offset;
        if (neighborNode >= 0 && neighborNode < numNodes) {
          for (let d = 0; d < dofPerNode; d++) {
            const col = neighborNode * dofPerNode + d;
            if (col === r) {
              // Main diagonal: high positive stiffness
              rowEntries.push({ col, val: 240.0 + (d + 1) * 10.0 });
            } else {
              // Off-diagonal coupling
              const dist = Math.abs(r - col);
              rowEntries.push({ col, val: -60.0 / (dist + 0.5) });
            }
          }
        }
      }

      rowEntries.sort((a, b) => a.col - b.col);

      for (const e of rowEntries) {
        valList.push(e.val);
        colList.push(e.col);
        nnzCount++;
      }

      rowPointers[r + 1] = nnzCount;
    }

    return {
      rows,
      columns,
      nnz: nnzCount,
      values: new Float32Array(valList),
      columnIndices: new Uint32Array(colList),
      rowPointers,
    };
  }

  /**
   * Extracts diagonal elements from CSR matrix
   */
  public static extractDiagonal(csr: CSRMatrixData): Float32Array {
    const { rows, columns, values, columnIndices, rowPointers } = csr;
    const minDim = Math.min(rows, columns);
    const diagonal = new Float32Array(minDim);

    for (let r = 0; r < minDim; r++) {
      const start = rowPointers[r];
      const end = rowPointers[r + 1];
      let found = false;
      for (let idx = start; idx < end; idx++) {
        if (columnIndices[idx] === r) {
          diagonal[r] = values[idx];
          found = true;
          break;
        }
      }
      if (!found) {
        diagonal[r] = 0.0;
      }
    }

    return diagonal;
  }
}
