import { BackendType, PrecisionMode } from '../engineering_gpu/types';

export type WebGPUErrorType =
  | 'WEBGPU_DEVICE_UNAVAILABLE'
  | 'WEBGPU_FEATURE_UNSUPPORTED'
  | 'WEBGPU_LIMIT_EXCEEDED'
  | 'WEBGPU_SHADER_COMPILATION_FAILED'
  | 'WEBGPU_PIPELINE_FAILED'
  | 'WEBGPU_BUFFER_ERROR'
  | 'WEBGPU_MEMORY_LIMIT'
  | 'WEBGPU_SUBMISSION_FAILED'
  | 'WEBGPU_TIMEOUT'
  | 'WEBGPU_NUMERICAL_FAILURE'
  | 'WEBGPU_VALIDATION_FAILED'
  | 'WEBGPU_PRECISION_UNSUPPORTED'
  | 'WEBGPU_SECURITY_VIOLATION';

export type ShaderTrustLevel = 'TRUSTED' | 'QUALIFIED' | 'UNTRUSTED' | 'REJECTED';

export interface WebGPUDeviceLimits {
  maxBufferSize: number;
  maxStorageBufferBindingSize: number;
  maxUniformBufferBindingSize: number;
  maxComputeWorkgroupsPerDimension: number;
  maxComputeWorkgroupsPerWorkgroup: number;
  maxComputeInvocationsPerWorkgroup: number;
}

export interface WebGPUAdapterFingerprint {
  adapterId: string;
  vendor: string;
  architecture: string;
  limits: WebGPUDeviceLimits;
  supportedFeatures: string[];
  browser: string;
  browserVersion: string;
  os: string;
  timestamp: string;
}

export interface WGSLKernel {
  kernelId: string;
  kernelVersion: number;
  shaderHash: string;
  entryPoint: string;
  wgslSource: string;
  bindings: Array<{ binding: number; type: 'storage' | 'uniform'; name: string }>;
  workgroupSize: [number, number, number];
  precisionPolicy: PrecisionMode;
  trustLevel: ShaderTrustLevel;
}

export interface WebGPUQualificationRecord {
  qualificationId: string;
  workloadId: string;
  kernelVersion: number;
  shaderHash: string;
  adapterFingerprint: string;
  browserRuntime: string;
  limits: WebGPUDeviceLimits;
  precision: PrecisionMode;
  testSuiteResults: {
    analyticalTest: boolean;
    cpuComparison: boolean;
    maxRelativeError: number;
  };
  status: 'QUALIFIED' | 'REJECTED' | 'PENDING';
  timestamp: string;
}

export interface WebGPUEngineeringEvidence {
  executionId: string;
  workloadId: string;
  kernelId: string;
  kernelVersion: number;
  shaderHash: string;
  adapterFingerprint: string;
  browserFingerprint: string;
  inputHash: string;
  outputHash: string;
  precision: PrecisionMode;
  validationResult: 'VALIDATED' | 'NUMERICAL_DRIFT_DETECTED' | 'WEBGPU_VALIDATION_FAILED';
  tolerance: number;
  timing: {
    uploadTimeMs: number;
    kernelTimeMs: number;
    readbackTimeMs: number;
    totalTimeMs: number;
  };
  fallbackStatus: {
    occurred: boolean;
    reason?: string;
  };
  evidenceHash: string;
  timestamp: string;
}
