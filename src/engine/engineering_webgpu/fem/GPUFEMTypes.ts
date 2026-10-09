export type FEMElementType = 'QUAD4' | 'TET4' | 'HEX8' | 'TRI3';

export interface FEMKernelExecutionResult {
  success: boolean;
  elementCount: number;
  gpuExecutionTimeMs: number;
  memoryAllocatedBytes: number;
  maxDisplacement: number;
  maxVonMisesStress: number;
}

export interface FEMCPUComparisonMetrics {
  maxDisplacementDelta: number;
  maxStressDelta: number;
  relativeResidualNorm: number;
  passedEquivalence: boolean;
}

export interface GPUFEMBenchmarkResult {
  elementType: FEMElementType;
  elementCount: number;
  workloadType: 'GENERIC_WEBGPU_COMPUTE' | 'GENERIC_VECTOR_ADD' | 'FEM_STIFFNESS';
  domainExecutionStatus: 'UNPROVEN' | 'UNIMPLEMENTED' | 'EXECUTED';
  cpuTimeMs: number;
  gpuTimeMs?: number;
  speedup?: number;
  backend: 'CPU' | 'WEBGPU' | 'UNAVAILABLE';
  status: 'EXECUTED' | 'UNAVAILABLE' | 'FAILED';
  numericallyEquivalent: boolean;
}
