
export type WorkloadClass = 'SMALL' | 'MEDIUM' | 'LARGE' | 'EXTREME';
export type PerformanceMetricType = 
  | 'LATENCY' 
  | 'THROUGHPUT' 
  | 'SOLVE_TIME' 
  | 'MEMORY_PEAK' 
  | 'GPU_UTILIZATION' 
  | 'MESH_TIME';

export interface PerformanceRequirement {
  metric: PerformanceMetricType;
  target: number;
  tolerance: number;
  workloadClass: WorkloadClass;
}

export interface EnvironmentFingerprint {
  os: string;
  cpu: string;
  gpu?: string;
  ramGb: number;
  runtime: string;
  driverVersion?: string;
}

export interface EngineeringWorkload {
  workloadId: string;
  name: string;
  class: WorkloadClass;
  domain: string;
  complexity: number; // e.g., part count or element count
}

export interface PerformanceMeasurement {
  metric: PerformanceMetricType;
  value: number;
  unit: string;
  timestamp: string;
}

export interface PerformanceQualificationRecord {
  qualificationId: string;
  workloadId: string;
  environment: EnvironmentFingerprint;
  measurements: PerformanceMeasurement[];
  verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  timestamp: string;
}

export interface PerformanceReport {
  qualificationId: string;
  summary: string;
  metrics: Record<string, number>;
  verdict: 'PASS' | 'FAIL';
  limitations: string[];
}
