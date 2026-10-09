import { CSRStorage } from "./CSRStorage";
import { SparseMemoryBreakdown } from "./types";

export class SparseMemoryProfiler {
  /**
   * Computes exact memory consumption in bytes of CSR data structures
   */
  static profile(csr: CSRStorage): SparseMemoryBreakdown {
    const bytesPerFloat64 = 8;
    const bytesPerInt32 = 4;

    const valuesBytes = csr.nnz * bytesPerFloat64;
    const indicesBytes = csr.nnz * bytesPerInt32;
    const pointersBytes = (csr.rows + 1) * bytesPerInt32;
    const totalSparseBytes = valuesBytes + indicesBytes + pointersBytes;

    const denseEquivalentBytes = csr.rows * csr.cols * bytesPerFloat64;
    const compressionRatio = denseEquivalentBytes > 0 ? totalSparseBytes / denseEquivalentBytes : 1.0;
    const savingsPercentage = Math.max(0, (1.0 - compressionRatio) * 100.0);

    return {
      valuesBytes,
      indicesBytes,
      pointersBytes,
      totalSparseBytes,
      denseEquivalentBytes,
      compressionRatio,
      savingsPercentage,
      indexWidthBits: 32,
      numericType: "Float64 (64-bit IEEE 754)"
    };
  }

  /**
   * Compares Sparse vs Dense memory for a given row, col, nnz configuration
   */
  static compareTheoretical(rows: number, cols: number, nnz: number): SparseMemoryBreakdown {
    const valuesBytes = nnz * 8;
    const indicesBytes = nnz * 4;
    const pointersBytes = (rows + 1) * 4;
    const totalSparseBytes = valuesBytes + indicesBytes + pointersBytes;
    const denseEquivalentBytes = rows * cols * 8;
    const compressionRatio = denseEquivalentBytes > 0 ? totalSparseBytes / denseEquivalentBytes : 1.0;
    const savingsPercentage = Math.max(0, (1.0 - compressionRatio) * 100.0);

    return {
      valuesBytes,
      indicesBytes,
      pointersBytes,
      totalSparseBytes,
      denseEquivalentBytes,
      compressionRatio,
      savingsPercentage,
      indexWidthBits: 32,
      numericType: "Float64 (64-bit IEEE 754)"
    };
  }
}
