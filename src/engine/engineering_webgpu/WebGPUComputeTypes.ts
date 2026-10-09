/**
 * WebGPUComputeTypes.ts
 * PHASE 27 — Hardware Acceleration (PATCH-296)
 * Strict typing for Real WebGPU Compute Backend, Device Lifecycle, Buffer Management,
 * Shader Execution, Numerical Tolerance Policy, and Backend Truth States.
 */

export type ComputeBackendMode = 'AUTO' | 'CPU' | 'WEBGPU';

export type BackendTruthState =
  | 'UNAVAILABLE'
  | 'INITIALIZING'
  | 'READY'
  | 'EXECUTING'
  | 'FAILED'
  | 'FALLBACK_CPU';

export type WebGPUErrorCode =
  | 'WEBGPU_UNAVAILABLE'
  | 'ADAPTER_FAILURE'
  | 'DEVICE_FAILURE'
  | 'SHADER_COMPILATION_FAILURE'
  | 'PIPELINE_FAILURE'
  | 'BUFFER_FAILURE'
  | 'DISPATCH_FAILURE'
  | 'READBACK_FAILURE'
  | 'DEVICE_LOST'
  | 'RESOURCE_LIMIT'
  | 'SECURITY_VIOLATION'
  | 'NUMERICAL_TOLERANCE_EXCEEDED'
  | 'INVALID_WORKLOAD'
  | 'JOB_CANCELLED';

export type KernelCategory =
  | 'VECTOR_MATH'
  | 'ELEMENT_WISE'
  | 'PARALLEL_REDUCTION'
  | 'MATRIX_MATH'
  | 'TRANSFORMATION'
  | 'PHYSICS_KERNEL';

export type PrecisionMode = 'FP32' | 'FP16' | 'FP64';

export interface NumericalTolerancePolicy {
  absoluteTolerance: number;
  relativeTolerance: number;
  description: string;
  allowReductionOrderDrift?: boolean;
}

export interface WebGPUDeviceLimits {
  maxBufferSize: number;
  maxStorageBufferBindingSize: number;
  maxUniformBufferBindingSize: number;
  maxComputeWorkgroupStorageSize: number;
  maxComputeInvocationsPerWorkgroup: number;
  maxComputeWorkgroupSizeX: number;
  maxComputeWorkgroupSizeY: number;
  maxComputeWorkgroupSizeZ: number;
  maxComputeWorkgroupsPerDimension: number;
}

export interface WebGPUAdapterInfo {
  vendor: string;
  architecture: string;
  device: string;
  description: string;
  isSoftwareRenderer?: boolean;
}

export interface WebGPUCapabilityMatrix {
  isAvailable: boolean;
  adapterAvailable: boolean;
  deviceCreated: boolean;
  adapterInfo: WebGPUAdapterInfo;
  features: string[];
  limits: WebGPUDeviceLimits;
  supportedPrecisions: PrecisionMode[];
  runtimeEnvironment: 'BROWSER_WEBGPU' | 'HEADLESS_FALLBACK' | 'WORKER_WEBGPU';
  timestamp: string;
}

export type BufferUsageType =
  | 'STORAGE'
  | 'UNIFORM'
  | 'COPY_SRC'
  | 'COPY_DST'
  | 'MAP_READ'
  | 'MAP_WRITE';

export type BufferState = 'ALLOCATED' | 'IN_USE' | 'STAGED' | 'MAPPED' | 'RELEASED';

export interface ManagedGPUBuffer {
  id: string;
  name: string;
  sizeBytes: number;
  elementCount: number;
  usage: BufferUsageType[];
  state: BufferState;
  ownerJobId?: string;
  createdAt: number;
  releasedAt?: number;
  rawBufferRef?: any;
}

export interface KernelDefinition {
  kernelId: string;
  name: string;
  version: string;
  category: KernelCategory;
  wgslSource: string;
  shaderHash: string;
  entryPoint: string;
  workgroupSize: [number, number, number];
  precision: PrecisionMode;
  tolerancePolicy: NumericalTolerancePolicy;
  description: string;
  cpuReference: (inputs: Record<string, Float32Array | number[]>, uniforms?: Record<string, number>) => Float32Array;
}

export interface ComputeJobRequest {
  jobId: string;
  kernelId: string;
  requestedBackend: ComputeBackendMode;
  inputs: Record<string, Float32Array>;
  uniforms?: Record<string, number>;
  elementCount: number;
  validateAgainstCPU?: boolean;
  fallbackAllowed?: boolean;
  userContext?: {
    userId: string;
    organizationId: string;
    clearanceLevel?: string;
  };
}

export interface TransferTiming {
  uploadMs: number;
  computeMs: number;
  readbackMs: number;
  totalMs: number;
  transferOverheadPercent: number;
}

export interface NumericalVerificationResult {
  verified: boolean;
  maxAbsoluteError: number;
  maxRelativeError: number;
  meanSquaredError: number;
  elementsChecked: number;
  passedTolerance: boolean;
  cpuReferenceAvailable: boolean;
  driftSamples: Array<{ index: number; gpuVal: number; cpuVal: number; absDiff: number }>;
}

export interface ComputeJobResult {
  jobId: string;
  kernelId: string;
  kernelVersion: string;
  requestedBackend: ComputeBackendMode;
  actualBackend: 'WEBGPU' | 'CPU';
  truthState: BackendTruthState;
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'INTERRUPTED';
  outputData: Float32Array;
  outputLength: number;
  inputHash: string;
  outputHash: string;
  timing: TransferTiming;
  isColdStart: boolean;
  verification: NumericalVerificationResult;
  provenance: {
    deviceFingerprint: string;
    adapterName: string;
    shaderHash: string;
    pipelineVersion: string;
    digitalThreadEvidenceHash: string;
    executionTimestamp: string;
    hostEnvironment: string;
  };
  fallbackInfo?: {
    gpuAttempted: boolean;
    gpuFailed: boolean;
    gpuFailureReason?: string;
    cpuFallbackUsed: boolean;
  };
  error?: string;
  errorCode?: WebGPUErrorCode;
}

export interface BenchmarkCaseResult {
  workloadName: string;
  category: KernelCategory;
  dataSize: number;
  gpuResult?: ComputeJobResult;
  cpuResult: ComputeJobResult;
  gpuSpeedup: number;
  transferOverheadPercent: number;
  numericallyEquivalent: boolean;
  maxAbsDiff: number;
  timingBreakdown: {
    gpuUploadMs: number;
    gpuComputeOnlyMs: number;
    gpuReadbackMs: number;
    gpuTotalMs: number;
    cpuTotalMs: number;
  };
  notes: string;
}

export interface WebGPUHealthReport {
  timestamp: string;
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'FAILED';
  truthState: BackendTruthState;
  webGPUAvailable: boolean;
  adapterPresent: boolean;
  deviceFunctional: boolean;
  queueFunctional: boolean;
  shaderCompilationPassed: boolean;
  computeDispatchPassed: boolean;
  readbackPassed: boolean;
  memoryLeakDetected: boolean;
  activeAllocatedBuffersCount: number;
  totalAllocatedBytes: number;
  activeJobsCount: number;
  diagnostics: string[];
}
