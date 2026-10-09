
export type AssemblyScaleClass = 'SMALL' | 'MEDIUM' | 'LARGE' | 'VERY_LARGE' | 'EXTREME';

export interface AssemblyWorkload {
  partCount: number;
  subAssemblyCount: number;
  constraintCount: number;
  geometryComplexity: number; // e.g. triangle count
  bomSize: number;
}

export interface AssemblyIntegrityResults {
  geometryIntegrity: boolean;
  bomIntegrity: boolean;
  constraintIntegrity: boolean;
  revisionIntegrity: boolean;
  missingReferences: number;
}

export interface AssemblyPerformanceMetrics {
  loadTimeMs: number;
  regenerationTimeMs: number;
  interactionLatencyMs: number;
  memoryUsageMb: number;
  gpuVramMb?: number;
  fps: number;
}

export interface LargeAssemblyQualificationRecord {
  qualificationId: string;
  assemblyId: string;
  revision: string;
  scaleClass: AssemblyScaleClass;
  workload: AssemblyWorkload;
  performance: AssemblyPerformanceMetrics;
  integrity: AssemblyIntegrityResults;
  verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  timestamp: string;
}
