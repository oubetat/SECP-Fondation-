/**
 * SECP Industrial OS - PATCH-305 Hardware Acceleration Gate Types
 * Real Hardware Discovery, GPU Backend Proof, Numerical Validation,
 * Proof Levels (LEVEL_0 to LEVEL_7) & Digital Thread Evidence
 */

export type TruthModelStatus =
  | 'ABSENT'
  | 'SIMULATED'
  | 'IMPLEMENTED'
  | 'EXECUTED'
  | 'VERIFIED'
  | 'VALIDATED'
  | 'BENCHMARKED'
  | 'PRODUCTION_PROVEN';

export type BackendType =
  | 'WEBGPU_NATIVE'
  | 'WEBGPU_GENERIC'
  | 'NATIVE_GPU'
  | 'WASM_SIMD'
  | 'CPU_REFERENCE'
  | 'CPU_FALLBACK';

export type ProofLevel =
  | 'LEVEL_0' // GPU Architecture Exists
  | 'LEVEL_1' // GPU Backend Implemented
  | 'LEVEL_2' // GPU Kernel Implemented
  | 'LEVEL_3' // Real GPU Execution
  | 'LEVEL_4' // GPU Result Verified
  | 'LEVEL_5' // GPU Result Validated
  | 'LEVEL_6' // GPU Performance Benchmarked
  | 'LEVEL_7'; // GPU Production Proven

export type WorkloadDomain =
  | 'LINEAR_ALGEBRA'
  | 'FEM'
  | 'CFD'
  | 'MESHING'
  | 'OPTIMIZATION';

export type PrecisionMode = 'FP32' | 'FP64' | 'MIXED';

export interface CpuManifest {
  model: string;
  coreCount: number;
  threadCount: number;
  architecture: string;
  simdCapabilities: string[];
  memoryGb: number;
}

export interface GpuManifest {
  vendor: string;
  device: string;
  architecture: string;
  vramMb: number;
  driverVersion: string;
  api: string;
  computeCapability: string;
  adapterName: string;
  isWebGpuAvailable: boolean;
  supportsTimestampQuery: boolean;
  maxBufferSizeMb: number;
  maxComputeWorkgroupSize: number;
}

export interface HardwareDiscoveryResult {
  cpu: CpuManifest;
  gpu: GpuManifest;
  selectedBackend: BackendType;
  isRealHardware: boolean;
  timestamp: number;
}

export interface GPUExecutionManifest {
  executionId: string;
  hardwareId: string;
  gpuId: string;
  backend: BackendType;
  kernelId: string;
  kernelVersion: string;
  inputHash: string;
  configurationHash: string;
  outputHash: string;
  startTime: number;
  endTime: number;
  status: 'COMPLETED' | 'FAILED' | 'FALLBACK';
  workgroupSize: [number, number, number];
  dispatchSize: [number, number, number];
  bufferSizesBytes: number[];
}

export interface GPUKernelSpec {
  kernelId: string;
  version: string;
  hash: string;
  domain: WorkloadDomain;
  precision: PrecisionMode;
  wgslSource?: string;
  inputSchema: string;
  outputSchema: string;
}

export interface NumericalValidationResult {
  domain: WorkloadDomain;
  metric: 'L1' | 'L2' | 'LINF';
  absoluteError: number;
  relativeError: number;
  tolerance: number;
  isWithinTolerance: boolean;
  gpuResultHash: string;
  cpuResultHash: string;
  elementCount: number;
  conservationError?: number;
}

export interface HardwareAccelerationEvidenceRecord {
  evidenceId: string;
  executionId: string;
  hardwareId: string;
  gpuId: string;
  backend: BackendType;
  kernelId: string;
  kernelHash: string;
  inputHash: string;
  outputHash: string;
  configurationHash: string;
  gpuExecutionTimeMs: number;
  transferTimeMs: number;
  totalTimeMs: number;
  cpuReferenceTimeMs: number;
  speedup: number;
  proofLevel: ProofLevel;
  numericalError: number;
  validationStatus: 'VALIDATED' | 'REJECTED' | 'UNVERIFIED';
  digitalThreadToken: string;
  signatureSha256: string;
}

export interface ProductionClassificationStatus305 {
  capability: string;
  status: 'PROVEN' | 'PARTIAL' | 'ABSENT';
  verificationCount: number;
  lastVerifiedAt: number;
}
