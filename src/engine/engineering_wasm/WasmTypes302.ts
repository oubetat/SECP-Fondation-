/**
 * SECP Industrial OS - PATCH-302: WASM Native Compute Types
 * Versioned ABI, module manifests, memory descriptors, and domain tolerances.
 */

export type WasmCapabilityState = 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE' | 'FAILED';

export type WasmExecutionMode = 'JS_CPU' | 'WASM_CPU' | 'WASM_SIMD' | 'WASM_WORKER_PARALLEL';

export type WasmAbiVersion = 'WASM_ABI_V1';

export type WasmTrustLevel = 'TRUSTED' | 'QUALIFIED' | 'UNTRUSTED' | 'REJECTED';

export type WasmMemoryLifecycleState = 'ALLOCATE' | 'WRITE' | 'COMPUTE' | 'READ' | 'RELEASE';

export type WasmBufferOwner = 'HOST' | 'WASM_RUNTIME' | 'BORROWED' | 'TRANSFERABLE';

export type WasmDomain = 'LINALG' | 'FEM' | 'CFD' | 'MESH' | 'GEOMETRY' | 'CAM' | 'BATCH';

export interface WasmBuildMetadata {
  compiler: string;
  compilerVersion: string;
  target: 'wasm32' | 'wasm64';
  buildFlags: string[];
  sourceRevision: string;
}

export interface WasmModuleDescriptor {
  moduleId: string;
  moduleVersion: string;
  abi: WasmAbiVersion;
  capabilities: {
    simd: boolean;
    float64: boolean;
    threads: boolean;
    dynamicMemory: boolean;
  };
  moduleHash: string; // SHA-256
  buildMetadata: WasmBuildMetadata;
  binary: Uint8Array;
}

export interface WasmMemoryDescriptor {
  bufferId: string;
  byteOffset: number;
  byteLength: number;
  elementCount: number;
  elementSize: number;
  type: 'Float32' | 'Float64' | 'Int32' | 'Uint32';
  owner: WasmBufferOwner;
  lifecycleState: WasmMemoryLifecycleState;
}

export interface WasmTransferMetrics {
  jsToWasmBytes: number;
  jsToWasmMs: number;
  wasmToJsBytes: number;
  wasmToJsMs: number;
  copyMinimizationAchieved: boolean;
}

export interface WasmTaskModel {
  taskId: string;
  moduleId: string;
  moduleVersion: string;
  inputHash: string;
  executionMode: WasmExecutionMode;
  domain: WasmDomain;
  payload: any;
  createdAt: number;
}

export interface WasmExecutionResult<T = any> {
  taskId: string;
  moduleId: string;
  moduleVersion: string;
  executionMode: WasmExecutionMode;
  actualBackend: 'WASM_NATIVE' | 'WASM_SIMD' | 'JS_FALLBACK';
  fallbackReason?: string;
  durationMs: number;
  memoryUsageBytes: number;
  transferMetrics: WasmTransferMetrics;
  result: T;
  outputHash: string;
  provenance: {
    moduleHash: string;
    abi: WasmAbiVersion;
    workerId?: string;
    deterministic: boolean;
  };
}

export interface DomainTolerances {
  linalg: { dotProductTol: number; normTol: number; gemvTol: number };
  fem: { stressTolPa: number; strainTol: number; stiffnessTol: number };
  cfd: { residualTol: number; fluxTol: number; pressureTol: number };
  mesh: { aspectRatioTol: number; normalTol: number; skewnessTol: number };
  geometry: { distanceTol: number; rayHitTol: number; areaTol: number };
  cam: { feedrateTol: number; curvatureTol: number; mrrTol: number };
}

export const SECP_DOMAIN_TOLERANCES: DomainTolerances = {
  linalg: { dotProductTol: 1e-10, normTol: 1e-10, gemvTol: 1e-9 },
  fem: { stressTolPa: 1e-3, strainTol: 1e-9, stiffnessTol: 1e-4 },
  cfd: { residualTol: 1e-7, fluxTol: 1e-8, pressureTol: 1e-4 },
  mesh: { aspectRatioTol: 1e-6, normalTol: 1e-6, skewnessTol: 1e-5 },
  geometry: { distanceTol: 1e-7, rayHitTol: 1e-7, areaTol: 1e-6 },
  cam: { feedrateTol: 1e-4, curvatureTol: 1e-6, mrrTol: 1e-4 }
};

export interface WasmBenchmarkComparison {
  kernelName: string;
  domain: WasmDomain;
  problemSize: number;
  jsDurationMs: number;
  wasmDurationMs: number;
  speedup: number;
  numericalError: number;
  tolerance: number;
  isCorrect: boolean;
  throughputOpsPerSec: number;
  memoryBytes: number;
}

export interface WasmEvidenceRecord {
  evidenceId: string;
  executionId: string;
  taskId: string;
  moduleId: string;
  moduleVersion: string;
  moduleHash: string;
  abi: WasmAbiVersion;
  inputHash: string;
  outputHash: string;
  backend: WasmExecutionMode;
  simdEnabled: boolean;
  workerId: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  memoryUsageBytes: number;
  status: 'PROVEN' | 'PARTIAL' | 'FAILED';
  fallback: {
    occurred: boolean;
    requestedBackend?: string;
    actualBackend?: string;
    reason?: string;
  };
  signatureSha256: string;
  timestamp: string;
}

export interface StatusSeparation302 {
  wasmRuntime: 'PROVEN' | 'PARTIAL' | 'UNPROVEN';
  wasmModuleExecution: 'PROVEN' | 'PARTIAL' | 'UNPROVEN';
  wasmAbi: 'PROVEN' | 'PARTIAL' | 'UNPROVEN';
  memoryInterface: 'PROVEN' | 'PARTIAL' | 'UNPROVEN';
  simd: 'PROVEN' | 'PARTIAL' | 'UNPROVEN';
  wasmLinearAlgebra: 'PROVEN' | 'PARTIAL' | 'UNPROVEN';
  wasmFEM: 'PROVEN' | 'PARTIAL' | 'UNPROVEN';
  wasmCFD: 'PROVEN' | 'PARTIAL' | 'UNPROVEN';
  wasmMesh: 'PROVEN' | 'PARTIAL' | 'UNPROVEN';
  wasmGeometry: 'PROVEN' | 'PARTIAL' | 'UNPROVEN';
  wasmCAM: 'PROVEN' | 'PARTIAL' | 'UNPROVEN';
  workerIntegration: 'PROVEN' | 'PARTIAL' | 'UNPROVEN';
  parallelWasm: 'PROVEN' | 'PARTIAL' | 'UNPROVEN';
  numericalCorrectness: 'PROVEN' | 'PARTIAL' | 'UNPROVEN';
  performanceGain: 'PROVEN' | 'NOT_PROVEN';
  reproducibility: 'PROVEN' | 'PARTIAL' | 'UNPROVEN';
  productionReadiness: 'PROVEN' | 'PARTIAL' | 'UNPROVEN';
}
