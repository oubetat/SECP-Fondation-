/**
 * PATCH-SECP-085: High-Performance Computing (HPC) Contracts
 * Contracts and types for WebAssembly compute kernels, CSR sparse matrices,
 * worker execution, performance benchmarking, and cross-runtime equivalence checks.
 */

export type HpcRuntimeMode = 'WASM_NATIVE' | 'TS_FALLBACK';

export type HpcExecutionStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'CANCELLING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMEOUT';

export interface SparseMatrixCSR {
  numRows: number;
  numCols: number;
  nnz: number;
  rowPtr: Int32Array;
  colInd: Int32Array;
  values: Float64Array;
}

export interface HpcMemoryBufferLayout {
  totalBytesAllocated: number;
  wasmMemoryPages: number;
  csrRowPtrOffset: number;
  csrColIndOffset: number;
  csrValuesOffset: number;
  vectorXOffset: number;
  vectorYOffset: number;
  resultOffset: number;
}

export interface HpcKernelExecutionRequest {
  taskId: string;
  kernelName: 'FEA_SPARSE_SOLVER' | 'CFD_FLUX_SOLVER' | 'CAM_5AXIS_KINEMATICS' | 'NURBS_EVALUATION' | 'NATIVE_PROOF_OF_LIFE_ADD' | 'NATIVE_PROOF_OF_LIFE_MULT' | 'GEOM_BULK_SOLVER';
  workloadSize: 'SMALL' | 'MEDIUM' | 'LARGE' | 'STRESS';
  inputBufferData: Float64Array;
  csrMatrixData?: {
    numRows: number;
    numCols: number;
    nnz: number;
    rowPtr: number[];
    colInd: number[];
    values: number[];
  };
  options?: {
    maxIterations?: number;
    tolerance?: number;
    timeoutMs?: number;
    preferWasm?: boolean;
  };
}

export interface HpcKernelExecutionResult {
  taskId: string;
  kernelName: string;
  runtimeUsed: HpcRuntimeMode;
  status: HpcExecutionStatus;
  executionTimeMs: number;
  dataTransferTimeMs: number;
  outputBufferData: Float64Array;
  residualMetric: number;
  iterationsCompleted: number;
  wasmModuleHash: string;
  kernelVersion: string;
  provenanceDigest: string;
  errorMessage?: string;
  memoryUsageMb: number;
  throughputMflops?: number;
}

export interface CrossRuntimeEquivalenceReport {
  kernelName: string;
  tsExecutionTimeMs: number;
  wasmExecutionTimeMs: number;
  speedupFactor: number;
  maxAbsoluteDifference: number;
  relativeNormDifference: number;
  isNumericallyEquivalent: boolean;
  tolerance: number;
  checkedMetrics: string[];
}

export interface BenchmarkBenchmarkResult {
  workloadName: string;
  workloadSize: string;
  itemCount: number;
  tsTimeMs: number;
  wasmTimeMs: number;
  speedupRatio: number;
  tsMemoryMb: number;
  wasmMemoryMb: number;
  throughputOpsPerSec: number;
}
