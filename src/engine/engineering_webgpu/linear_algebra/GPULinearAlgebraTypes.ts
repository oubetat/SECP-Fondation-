/**
 * GPULinearAlgebraTypes.ts
 * PHASE 27 — Hardware Acceleration (PATCH-297 — GPU Linear Algebra)
 * Core Types, Interfaces, Matrix Layouts, CSR Formats, and Linear Algebra Job Contracts
 */

import {
  BackendTruthState,
  ComputeBackendMode,
  NumericalTolerancePolicy,
  PrecisionMode,
  TransferTiming,
  WebGPUErrorCode,
} from '../WebGPUComputeTypes';

export type MatrixLayout = 'ROW_MAJOR' | 'COLUMN_MAJOR';

export type ReductionOpType =
  | 'SUM'
  | 'DOT'
  | 'L2_NORM'
  | 'INF_NORM'
  | 'MIN'
  | 'MAX';

export type LinearAlgebraOpType =
  | 'VECTOR_ADD'
  | 'VECTOR_SCALE'
  | 'AXPY'
  | 'ELEMENT_WISE_MUL'
  | 'ELEMENT_WISE_DIV'
  | 'DOT_PRODUCT'
  | 'L2_NORM'
  | 'INFINITY_NORM'
  | 'REDUCE_SUM'
  | 'REDUCE_MIN'
  | 'REDUCE_MAX'
  | 'MATRIX_ADD'
  | 'MATRIX_SCALE'
  | 'MATRIX_TRANSPOSE'
  | 'MATVEC'
  | 'MATMUL'
  | 'SPMV_CSR'
  | 'SPARSE_SCALE'
  | 'SPARSE_ADD'
  | 'EXTRACT_DIAGONAL'
  | 'DIAGONAL_SCALE'
  | 'GATHER'
  | 'SCATTER';

export interface GPUVector {
  id: string;
  length: number;
  precision: PrecisionMode;
  bufferId?: string;
  backend: 'WEBGPU' | 'CPU';
  data?: Float32Array;
  metadata?: {
    label?: string;
    createdAt: number;
    isAllocatedOnGPU: boolean;
  };
}

export interface GPUMatrix {
  id: string;
  rows: number;
  columns: number;
  layout: MatrixLayout;
  precision: PrecisionMode;
  bufferId?: string;
  backend: 'WEBGPU' | 'CPU';
  data?: Float32Array;
  metadata?: {
    label?: string;
    createdAt: number;
    isAllocatedOnGPU: boolean;
  };
}

/**
 * Compressed Sparse Row (CSR) Format Representation
 */
export interface CSRMatrixData {
  rows: number;
  columns: number;
  nnz: number;
  values: Float32Array;
  columnIndices: Uint32Array;
  rowPointers: Uint32Array;
}

export interface GPUSparseMatrix {
  id: string;
  format: 'CSR';
  rows: number;
  columns: number;
  nnz: number;
  precision: PrecisionMode;
  valuesBufferId?: string;
  columnIndicesBufferId?: string;
  rowPointersBufferId?: string;
  backend: 'WEBGPU' | 'CPU';
  csrData?: CSRMatrixData;
  metadata?: {
    label?: string;
    sparsityRatio: number;
    hasEmptyRows: boolean;
    isSymmetric?: boolean;
    createdAt: number;
  };
}

export interface CSRValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metrics: {
    rows: number;
    columns: number;
    nnz: number;
    sparsityRatio: number;
    emptyRowCount: number;
    maxRowNNZ: number;
    minRowNNZ: number;
    avgRowNNZ: number;
    isSortedColumns: boolean;
  };
}

export interface LinearAlgebraJobRequest {
  jobId: string;
  operation: LinearAlgebraOpType;
  requestedBackend: ComputeBackendMode;
  alpha?: number;
  beta?: number;
  vectorA?: Float32Array;
  vectorB?: Float32Array;
  matrixA?: {
    rows: number;
    cols: number;
    layout?: MatrixLayout;
    data: Float32Array;
  };
  matrixB?: {
    rows: number;
    cols: number;
    layout?: MatrixLayout;
    data: Float32Array;
  };
  sparseMatrixA?: CSRMatrixData;
  indices?: Uint32Array;
  validateAgainstCPU?: boolean;
  fallbackAllowed?: boolean;
  customTolerance?: NumericalTolerancePolicy;
}

export interface LinearAlgebraComparisonResult {
  verified: boolean;
  operation: LinearAlgebraOpType;
  maxAbsoluteError: number;
  maxRelativeError: number;
  l2RelativeError: number;
  meanSquaredError: number;
  elementsChecked: number;
  passedTolerance: boolean;
  cpuReferenceDurationMs: number;
  gpuExecutionDurationMs: number;
  driftSamples: Array<{ index: number; gpuVal: number; cpuVal: number; absDiff: number }>;
}

export interface LinearAlgebraJobResult {
  jobId: string;
  operation: LinearAlgebraOpType;
  requestedBackend: ComputeBackendMode;
  actualBackend: 'WEBGPU' | 'CPU';
  truthState: BackendTruthState;
  status: 'COMPLETED' | 'FAILED' | 'VALIDATION_FAILED';
  vectorOutput?: Float32Array;
  matrixOutput?: {
    rows: number;
    cols: number;
    layout: MatrixLayout;
    data: Float32Array;
  };
  sparseOutput?: CSRMatrixData;
  scalarOutput?: number;
  timing: TransferTiming;
  comparison: LinearAlgebraComparisonResult;
  provenance: {
    deviceFingerprint: string;
    kernelId: string;
    kernelVersion: string;
    shaderHash: string;
    precision: PrecisionMode;
    evidenceHash: string;
    timestamp: string;
  };
  error?: string;
  errorCode?: WebGPUErrorCode;
}

export interface LinearAlgebraBenchmarkMetric {
  benchmarkId: string;
  operation: LinearAlgebraOpType;
  datasetName: string;
  sizeDescription: string;
  dimensions: { rows?: number; cols?: number; length?: number; nnz?: number };
  cpuTimeMs: number;
  gpuUploadMs: number;
  gpuComputeMs: number;
  gpuReadbackMs: number;
  gpuTotalMs: number;
  speedupTotal: number;
  speedupComputeOnly: number;
  transferOverheadPercent: number;
  gflops: number;
  bandwidthGBs: number;
  numericallyEquivalent: boolean;
  maxAbsDiff: number;
}
