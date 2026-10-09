import { CSRStorage } from "./CSRStorage";
import { CSCData } from "./types";

export class CSCStorage {
  readonly rows: number;
  readonly cols: number;
  readonly nnz: number;
  readonly values: Float64Array;
  readonly rowIndices: Int32Array;
  readonly colPointers: Int32Array;

  constructor(data: CSCData) {
    this.rows = data.rows;
    this.cols = data.cols;
    this.nnz = data.nnz;
    this.values = data.values;
    this.rowIndices = data.rowIndices;
    this.colPointers = data.colPointers;
  }

  /**
   * Constructs CSCStorage from CSRStorage deterministically
   */
  static fromCSR(csr: CSRStorage): CSCStorage {
    const rows = csr.rows;
    const cols = csr.cols;
    const nnz = csr.nnz;

    const colCounts = new Int32Array(cols);
    for (let i = 0; i < nnz; i++) {
      colCounts[csr.columnIndices[i]]++;
    }

    const colPointers = new Int32Array(cols + 1);
    colPointers[0] = 0;
    for (let c = 0; c < cols; c++) {
      colPointers[c + 1] = colPointers[c] + colCounts[c];
    }

    const nextColPositions = new Int32Array(colPointers);
    const cscValues = new Float64Array(nnz);
    const cscRowIndices = new Int32Array(nnz);

    for (let r = 0; r < rows; r++) {
      const start = csr.rowPointers[r];
      const end = csr.rowPointers[r + 1];
      for (let idx = start; idx < end; idx++) {
        const c = csr.columnIndices[idx];
        const val = csr.values[idx];
        const destIdx = nextColPositions[c]++;
        cscValues[destIdx] = val;
        cscRowIndices[destIdx] = r;
      }
    }

    return new CSCStorage({
      rows,
      cols,
      nnz,
      values: cscValues,
      rowIndices: cscRowIndices,
      colPointers
    });
  }

  /**
   * Converts CSCStorage back to CSRStorage
   */
  toCSR(): CSRStorage {
    const rowCounts = new Int32Array(this.rows);
    for (let i = 0; i < this.nnz; i++) {
      rowCounts[this.rowIndices[i]]++;
    }

    const rowPointers = new Int32Array(this.rows + 1);
    rowPointers[0] = 0;
    for (let r = 0; r < this.rows; r++) {
      rowPointers[r + 1] = rowPointers[r] + rowCounts[r];
    }

    const nextRowPositions = new Int32Array(rowPointers);
    const csrValues = new Float64Array(this.nnz);
    const csrColIndices = new Int32Array(this.nnz);

    for (let c = 0; c < this.cols; c++) {
      const start = this.colPointers[c];
      const end = this.colPointers[c + 1];
      for (let idx = start; idx < end; idx++) {
        const r = this.rowIndices[idx];
        const val = this.values[idx];
        const destIdx = nextRowPositions[r]++;
        csrValues[destIdx] = val;
        csrColIndices[destIdx] = c;
      }
    }

    const csr = new CSRStorage({
      rows: this.rows,
      cols: this.cols,
      nnz: this.nnz,
      values: csrValues,
      columnIndices: csrColIndices,
      rowPointers,
      isCanonical: false
    });

    return csr.canonicalize();
  }
}
