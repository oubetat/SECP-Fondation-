import { CSRStorage } from "./CSRStorage";
import { SparseMatrixAnalyzer } from "./SparsityStatistics";
import { SparseMatrixHasher } from "./SparseMatrixHasher";
import { SparseMemoryProfiler } from "./SparseMemoryProfiler";
import { SparseMatrixValidator } from "./SparseMatrixValidator";
import { SparseMatrixEvidenceData } from "./types";

export class SparseMatrixEvidence {
  static createEvidence(
    matrixId: string,
    csr: CSRStorage,
    assemblySource: string = "DIRECT_FEM_SPARSE_ASSEMBLY"
  ): SparseMatrixEvidenceData {
    const stats = SparseMatrixAnalyzer.getStatistics(csr);
    const memory = SparseMemoryProfiler.profile(csr);
    const validation = SparseMatrixValidator.validate(csr);
    const matrixHash = SparseMatrixHasher.hash(csr);
    const patternHash = SparseMatrixHasher.hashPattern(csr);

    return {
      matrixId,
      format: "CSR",
      dimensions: { rows: csr.rows, cols: csr.cols },
      nnz: csr.nnz,
      density: stats.density,
      sparsity: stats.sparsity,
      bandwidth: {
        lower: stats.lowerBandwidth,
        upper: stats.upperBandwidth,
        total: stats.totalBandwidth
      },
      patternHash,
      matrixHash,
      indexWidth: "32-bit",
      numericType: "Float64 (64-bit IEEE 754)",
      memoryBytes: memory.totalSparseBytes,
      assemblySource,
      validationStatus: validation.isValid ? "VALIDATED_AND_VERIFIED" : `INVALID (${validation.verdict})`,
      timestamp: new Date().toISOString()
    };
  }
}
