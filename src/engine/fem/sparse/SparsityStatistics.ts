import { CSRStorage } from "./CSRStorage";
import { SparsityStatisticsData } from "./types";

export class SparsityStatistics {
  static analyze(csr: CSRStorage): SparsityStatisticsData {
    const rows = csr.rows;
    const cols = csr.cols;
    const nnz = csr.nnz;

    const totalEntries = rows * cols;
    const density = totalEntries > 0 ? nnz / totalEntries : 0;
    const sparsity = 1.0 - density;

    let minNnz = rows > 0 ? Infinity : 0;
    let maxNnz = 0;
    let lowerBandwidth = 0;
    let upperBandwidth = 0;
    let profile = 0;
    let diagonalCount = 0;

    for (let r = 0; r < rows; r++) {
      const start = csr.rowPointers[r];
      const end = csr.rowPointers[r + 1];
      const count = end - start;

      if (count < minNnz) minNnz = count;
      if (count > maxNnz) maxNnz = count;

      let minColInRow = r;
      for (let idx = start; idx < end; idx++) {
        const c = csr.columnIndices[idx];
        if (c === r) {
          diagonalCount++;
        }
        if (r > c) {
          const bw = r - c;
          if (bw > lowerBandwidth) lowerBandwidth = bw;
        }
        if (c > r) {
          const bw = c - r;
          if (bw > upperBandwidth) upperBandwidth = bw;
        }
        if (c < minColInRow) {
          minColInRow = c;
        }
      }
      profile += (r - minColInRow);
    }

    const avgNnzPerRow = rows > 0 ? nnz / rows : 0;
    const totalBandwidth = lowerBandwidth + upperBandwidth + 1;
    const hasZeroDiagonal = diagonalCount < Math.min(rows, cols);

    return {
      rows,
      cols,
      nnz,
      density,
      sparsity,
      avgNnzPerRow,
      minNnzPerRow: minNnz === Infinity ? 0 : minNnz,
      maxNnzPerRow: maxNnz,
      lowerBandwidth,
      upperBandwidth,
      totalBandwidth,
      profile,
      diagonalCount,
      hasZeroDiagonal
    };
  }
}

export class SparseMatrixAnalyzer {
  static getStatistics(csr: CSRStorage): SparsityStatisticsData {
    return SparsityStatistics.analyze(csr);
  }
}
