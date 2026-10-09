import { CSRStorage } from "./CSRStorage";
import { SparseMatrixHasher } from "./SparseMatrixHasher";
import { DEFAULT_RESOURCE_LIMITS, ResourceLimits } from "./types";

export interface SerializedSparseMatrix {
  format: 'CSR';
  version: string;
  dimensions: { rows: number; cols: number };
  nnz: number;
  rowPointers: number[];
  columnIndices: number[];
  values: number[];
  indexWidth: string;
  numericType: string;
  patternHash: string;
  matrixHash: string;
  timestamp: string;
}

export class SparseMatrixSerializer {
  static serialize(csr: CSRStorage): SerializedSparseMatrix {
    const matrixHash = SparseMatrixHasher.hash(csr);
    const patternHash = SparseMatrixHasher.hashPattern(csr);

    return {
      format: 'CSR',
      version: '1.0.0-PATCH-078',
      dimensions: { rows: csr.rows, cols: csr.cols },
      nnz: csr.nnz,
      rowPointers: Array.from(csr.rowPointers),
      columnIndices: Array.from(csr.columnIndices),
      values: Array.from(csr.values),
      indexWidth: '32-bit signed integer',
      numericType: 'Float64 (64-bit IEEE 754)',
      patternHash,
      matrixHash,
      timestamp: new Date().toISOString()
    };
  }

  static deserialize(payload: SerializedSparseMatrix, limits: ResourceLimits = DEFAULT_RESOURCE_LIMITS): CSRStorage {
    if (payload.format !== 'CSR') {
      throw new Error(`Unsupported sparse format during deserialization: ${payload.format}`);
    }

    const { rows, cols } = payload.dimensions;
    const nnz = payload.nnz;

    if (rows <= 0 || cols <= 0 || nnz < 0) {
      throw new Error(`Invalid dimensions in serialized payload: ${rows}x${cols}, nnz=${nnz}`);
    }

    if (rows > limits.maxRows || cols > limits.maxCols || nnz > limits.maxNNZ) {
      throw new Error(`Payload exceeds resource limits: ${rows}x${cols}, nnz=${nnz}`);
    }

    if (payload.rowPointers.length !== rows + 1) {
      throw new Error(`Corrupted rowPointers length in payload: ${payload.rowPointers.length} (expected ${rows + 1})`);
    }

    if (payload.columnIndices.length !== nnz || payload.values.length !== nnz) {
      throw new Error(`Corrupted arrays length in payload: colIndices=${payload.columnIndices.length}, values=${payload.values.length}, expected ${nnz}`);
    }

    const rowPointers = new Int32Array(payload.rowPointers);
    const columnIndices = new Int32Array(payload.columnIndices);
    const values = new Float64Array(payload.values);

    const csr = new CSRStorage({
      rows,
      cols,
      nnz,
      values,
      columnIndices,
      rowPointers,
      isCanonical: true
    });

    const expectedHash = payload.matrixHash;
    const computedHash = SparseMatrixHasher.hash(csr);

    if (expectedHash && computedHash !== expectedHash) {
      throw new Error(`Integrity error: deserialized matrix hash mismatch (${computedHash} vs expected ${expectedHash})`);
    }

    return csr;
  }
}
