export type BackendType = 'CUDA' | 'ROCm' | 'WebGPU' | 'CPU_REFERENCE';

export type PrecisionMode = 'FP64' | 'FP32' | 'FP16' | 'BF16';

export type PrecisionClass =
  | 'ENGINEERING_REFERENCE'
  | 'ENGINEERING_PRODUCTION'
  | 'ACCELERATED_APPROXIMATION'
  | 'AI_ONLY';

export type GPUFailureReason =
  | 'DRIVER_FAILURE'
  | 'DEVICE_FAILURE'
  | 'KERNEL_FAILURE'
  | 'MEMORY_FAILURE'
  | 'NUMERICAL_FAILURE'
  | 'TIMEOUT'
  | 'THERMAL_THROTTLE'
  | 'OUT_OF_MEMORY'
  | 'VALIDATION_FAILURE';

export interface GPUCapability {
  vendor: string;
  architecture: string;
  computeCapability: string;
  memoryMB: number;
  precisionModes: PrecisionMode[];
  tensorCapabilities: boolean;
  supportedKernels: string[];
  driverVersion: string;
  runtimeVersion: string;
}

export interface GPUDevice {
  deviceId: string;
  gpuFingerprint: string;
  capability: GPUCapability;
  health: 'HEALTHY' | 'DEGRADED' | 'FAILED';
  utilizationPercent: number;
  temperatureC: number;
  powerWatts: number;
  availableVramMB: number;
}

export interface GPUKernelInfo {
  kernelId: string;
  kernelName: string;
  version: number;
  backend: BackendType;
  precision: PrecisionMode;
  category: 'VECTOR' | 'MATRIX' | 'SPARSE' | 'FEM' | 'CFD' | 'REDUCTION';
}

export interface GPUQualificationRecord {
  qualificationId: string;
  backend: BackendType;
  deviceFingerprint: string;
  driverVersion: string;
  kernelVersions: Record<string, number>;
  testSuiteResults: {
    referenceTests: boolean;
    numericalEquivalence: boolean;
    maxRelativeError: number;
  };
  precision: PrecisionMode;
  status: 'QUALIFIED' | 'REJECTED' | 'PENDING';
  timestamp: string;
}

export interface GPUExecutionEvidence {
  executionId: string;
  kernelId: string;
  kernelVersion: number;
  gpuFingerprint: string;
  buildFingerprint?: any;
  runtimeFingerprint?: any;
  evidenceHash?: string;
  performance?: any;
  fallbackStatus?: any;
  backend: BackendType;
  inputHash: string;
  outputHash: string;
  precision: PrecisionMode;
  runtimeMs: number;
  validationResult: 'VALIDATED' | 'NUMERICAL_DRIFT_DETECTED' | 'GPU_VALIDATION_FAILED';
  fallbackOccurred: boolean;
  fallbackReason?: GPUFailureReason;
  timestamp: string;
}
