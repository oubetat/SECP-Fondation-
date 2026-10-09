export class SparseMatrixValidator {
  static validate(
    storage: any,
    limits?: { maxRows?: number; maxCols?: number; maxNNZ?: number; maxMemoryBytes?: number }
  ): {
    isValid: boolean;
    verdict?: string;
    errors: string[];
    invariants: {
      rowPointersLengthValid: boolean;
      rowPointersBoundaryValid: boolean;
      rowPointersMonotonic: boolean;
      columnIndicesLengthValid: boolean;
      columnIndicesBoundsValid: boolean;
      valuesLengthValid: boolean;
      noNaNOrInf: boolean;
    };
  } {
    if (!storage) {
      return {
        isValid: false,
        errors: ['Storage is null or undefined'],
        invariants: {
          rowPointersLengthValid: false,
          rowPointersBoundaryValid: false,
          rowPointersMonotonic: false,
          columnIndicesLengthValid: false,
          columnIndicesBoundsValid: false,
          valuesLengthValid: false,
          noNaNOrInf: false
        }
      };
    }

    const errors: string[] = [];
    let verdict: string | undefined = undefined;

    const rows = storage.rows ?? 0;
    const cols = storage.cols ?? 0;
    const nnz = storage.nnz ?? 0;
    const rowPointers = storage.rowPointers || [];
    const columnIndices = storage.columnIndices || [];
    const values = storage.values || [];

    if (limits) {
      if (
        (limits.maxRows !== undefined && rows > limits.maxRows) ||
        (limits.maxCols !== undefined && cols > limits.maxCols) ||
        (limits.maxNNZ !== undefined && nnz > limits.maxNNZ) ||
        (limits.maxMemoryBytes !== undefined && (storage.memoryBytes ?? nnz * 8) > limits.maxMemoryBytes)
      ) {
        errors.push('Resource limit exceeded');
        verdict = 'RESOURCE_LIMIT_EXCEEDED';
      }
    }

    const rowPointersLengthValid = rowPointers.length === rows + 1;
    const rowPointersBoundaryValid = rowPointers[0] === 0 && rowPointers[rows] === nnz;

    let rowPointersMonotonic = true;
    for (let i = 0; i < rowPointers.length - 1; i++) {
      if (rowPointers[i + 1] < rowPointers[i]) {
        rowPointersMonotonic = false;
        break;
      }
    }

    const columnIndicesLengthValid = columnIndices.length === nnz;
    let columnIndicesBoundsValid = true;
    for (let i = 0; i < columnIndices.length; i++) {
      if (columnIndices[i] < 0 || columnIndices[i] >= cols) {
        columnIndicesBoundsValid = false;
        break;
      }
    }

    const valuesLengthValid = values.length === nnz;
    let noNaNOrInf = true;
    for (let i = 0; i < values.length; i++) {
      if (!Number.isFinite(values[i])) {
        noNaNOrInf = false;
        break;
      }
    }

    if (!rowPointersLengthValid) errors.push('Row pointers length invalid');
    if (!rowPointersBoundaryValid) errors.push('Row pointers boundary invalid');
    if (!rowPointersMonotonic) errors.push('Row pointers not monotonic');
    if (!columnIndicesLengthValid) errors.push('Column indices length invalid');
    if (!columnIndicesBoundsValid) errors.push('Column indices bounds invalid');
    if (!valuesLengthValid) errors.push('Values length invalid');
    if (!noNaNOrInf) errors.push('Values contain non-finite numbers');

    return {
      isValid: errors.length === 0,
      verdict,
      errors,
      invariants: {
        rowPointersLengthValid,
        rowPointersBoundaryValid,
        rowPointersMonotonic,
        columnIndicesLengthValid,
        columnIndicesBoundsValid,
        valuesLengthValid,
        noNaNOrInf
      }
    };
  }
}
