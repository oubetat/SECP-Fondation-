import { BackendType, PrecisionMode } from '../engineering_gpu/types';

export type WASMErrorType =
  | 'WASM_MODULE_REJECTED'
  | 'WASM_IMPORT_REJECTED'
  | 'WASM_MEMORY_LIMIT'
  | 'WASM_EXECUTION_TIMEOUT'
  | 'WASM_SECURITY_VIOLATION'
  | 'WASM_PRECISION_UNSUPPORTED'
  | 'WASM_NUMERICAL_FAILURE'
  | 'WASM_VALIDATION_FAILED';

export type WASMTrustLevel = 'TRUSTED' | 'QUALIFIED' | 'UNTRUSTED' | 'REJECTED';

export interface WASMBuildFingerprint {
  sourceRevision: string;
  compilerVersion: string;
  target: 'wasm32' | 'wasm64';
  buildFlags: string[];
  moduleHash: string;
}

export interface WASMModule {
  moduleId: string;
  moduleVersion: number;
  moduleHash: string;
  runtimeVersion: string;
  exports: string[];
  imports: string[];
  memoryRequirementsMB: {
    initialMB: number;
    maximumMB: number;
  };
  precisionPolicy: PrecisionMode;
  trustLevel: WASMTrustLevel;
  buildFingerprint: WASMBuildFingerprint;
}

export interface WASMQualificationRecord {
  qualificationId: string;
  workloadId: string;
  moduleVersion: number;
  moduleHash: string;
  runtimeVersion: string;
  precision: PrecisionMode;
  testSuiteResults: {
    scalarSimdEquivalence: boolean;
    cpuComparison: boolean;
    maxRelativeError: number;
  };
  status: 'QUALIFIED' | 'REJECTED' | 'PENDING';
  timestamp: string;
}

export type MemoryStrategy = 'STATIC_BOUNDED' | 'DYNAMIC_AUDITED' | 'GROWTH_REJECTED';

export interface WASMPerformanceMetrics {
  coldStartMs: number;
  warmStartMs: number;
  compilationTimeMs: number;
  instantiationTimeMs: number;
  simdVariance: number; // Numerical variance between SIMD and Scalar paths
}

export interface WASMEngineeringEvidence {
  executionId: string;
  workloadId: string;
  moduleId: string;
  moduleVersion: number;
  moduleHash: string;
  buildFingerprint: WASMBuildFingerprint;
  runtimeFingerprint: string;
  browserFingerprint: string;
  cpuArchitecture: string;
  inputHash: string;
  outputHash: string;
  precision: PrecisionMode;
  memoryStrategy: MemoryStrategy;
  performance: WASMPerformanceMetrics;
  validationResult: 'VALIDATED' | 'NUMERICAL_DRIFT_DETECTED' | 'WASM_VALIDATION_FAILED';
  tolerance: number;
  timing: {
    loadTimeMs: number;
    computeTimeMs: number;
    transferTimeMs: number;
    totalTimeMs: number;
  };
  fallbackStatus: {
    occurred: boolean;
    reason?: string;
  };
  evidenceHash: string;
  timestamp: string;
}
