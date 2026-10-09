export type SparseFormat = 'CSR' | 'CSC' | 'COO' | 'BCSR';

export type MatrixState =
  | 'BUILDING'
  | 'FINALIZED'
  | 'VALIDATED'
  | 'SOLVER_READY'
  | 'FACTORIZED'
  | 'INVALID';

export type SparseInfrastructureVerdict =
  | 'VERIFIED'
  | 'NOT_VERIFIED'
  | 'INVALID_STRUCTURE'
  | 'PATTERN_MISMATCH'
  | 'NUMERICAL_FAILURE'
  | 'RESOURCE_LIMIT_EXCEEDED'
  | 'INTEGRITY_FAILURE';

export type ZeroPolicy = 'RETAIN' | 'PRUNE';

export interface CSRData {
  rows: number;
  cols: number;
  nnz: number;
  values: Float64Array;
  columnIndices: Int32Array;
  rowPointers: Int32Array;
  isCanonical?: boolean;
}

export interface CSCData {
  rows: number;
  cols: number;
  nnz: number;
  values: Float64Array;
  rowIndices: Int32Array;
  colPointers: Int32Array;
}

export interface COOTriplet {
  row: number;
  col: number;
  val: number;
}

export interface SparsityPatternData {
  rows: number;
  cols: number;
  nnz: number;
  rowPointers: Int32Array;
  columnIndices: Int32Array;
  patternHash: string;
  constructionSource: string;
  generationVersion: string;
}

export interface SparsityStatisticsData {
  rows: number;
  cols: number;
  nnz: number;
  density: number;
  sparsity: number;
  avgNnzPerRow: number;
  minNnzPerRow: number;
  maxNnzPerRow: number;
  lowerBandwidth: number;
  upperBandwidth: number;
  totalBandwidth: number;
  profile: number;
  diagonalCount: number;
  hasZeroDiagonal: boolean;
}

export interface SparseMemoryBreakdown {
  valuesBytes: number;
  indicesBytes: number;
  pointersBytes: number;
  totalSparseBytes: number;
  denseEquivalentBytes: number;
  compressionRatio: number;
  savingsPercentage: number;
  indexWidthBits: number;
  numericType: string;
}

export interface ElementContributionTrace {
  globalRow: number;
  globalCol: number;
  totalValue: number;
  contributions: {
    elementId: string;
    localRow: number;
    localCol: number;
    value: number;
  }[];
}

export interface SparseMatrixEvidenceData {
  matrixId: string;
  format: SparseFormat;
  dimensions: { rows: number; cols: number };
  nnz: number;
  density: number;
  sparsity: number;
  bandwidth: { lower: number; upper: number; total: number };
  patternHash: string;
  matrixHash: string;
  indexWidth: string;
  numericType: string;
  memoryBytes: number;
  assemblySource: string;
  validationStatus: string;
  timestamp: string;
}

export interface ResourceLimits {
  maxRows: number;
  maxCols: number;
  maxNNZ: number;
  maxMemoryBytes: number;
}

export const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  maxRows: 5_000_000,
  maxCols: 5_000_000,
  maxNNZ: 200_000_000,
  maxMemoryBytes: 4 * 1024 * 1024 * 1024 // 4 GB
};
