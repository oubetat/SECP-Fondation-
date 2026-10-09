
import { WorkflowStage } from '../workflow/RealEngineerWorkflowTypes';

export type ReferenceClassification = 
  | 'EXTERNAL_SOLVER' 
  | 'ANALYTICAL_SOLUTION' 
  | 'EXPERIMENTAL_DATA' 
  | 'LITERATURE_BENCHMARK';

export type CaeDomain = 'STRUCTURAL' | 'FLUID' | 'THERMAL' | 'MODAL' | 'MULTIPHYSICS';

export interface ExternalSolverMetadata {
  solverId: string;
  name: string;
  version: string;
  vendor: string;
  type: string;
}

export interface CaeResultPoint {
  coordinate: [number, number, number];
  value: number;
  variable: string;
  unit: string;
}

export interface CaeValidationMetrics {
  absoluteError: number;
  relativeError: number;
  mae: number;
  rmse: number;
  maxAbsoluteError: number;
  meanBias: number;
  rSquared: number;
}

export interface CaeComparisonRecord {
  comparisonId: string;
  secpRunId: string;
  externalRunId: string;
  domain: CaeDomain;
  referenceType: ReferenceClassification;
  metrics: CaeValidationMetrics;
  verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  timestamp: string;
}
