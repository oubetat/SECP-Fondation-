/**
 * PATCH-SECP-084: Production Command & Execution Contracts
 * Unified contract definitions for interactive production integration across CAD, B-Rep,
 * Class-A Surfacing, FEA, CFD, 5-Axis CAM, and Assembly/Kinematics.
 */

export type ProductionOperationType =
  | 'BREP_HEALING_SEWING'
  | 'CLASS_A_SURFACING_ZEBRA'
  | 'LINEAR_STRUCTURAL_FEA'
  | 'NONLINEAR_FEA_CONTACT'
  | 'CFD_3D_FVM_FLOW'
  | 'CAM_5AXIS_SIMULTANEOUS'
  | 'ASSEMBLY_KINEMATICS_SOLVE'
  | 'STEP_AP242_PMI_WORKFLOW';

export type ProductionExecutionStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'REJECTED'
  | 'VERIFICATION_FAILED';

export interface ProductionEntityReference {
  entityId: string;
  entityName: string;
  revisionId: string;
  geometryData?: any;
}

export interface ProductionEngineeringCommand<TConfig = any> {
  commandId: string;
  operationType: ProductionOperationType;
  engineId: string;
  entityRef: ProductionEntityReference;
  config: TConfig;
  submittedBy: string;
  submittedAt: string;
  timeoutMs?: number;
  deterministicReplayKey?: string;
}

export interface IndependentVerificationResult {
  passed: boolean;
  verifierName: string;
  checksPerformed: number;
  residualMetric: number;
  tolerance: number;
  verifierDetails: string;
  failureReason?: string;
}

export interface ResourceUsageMetadata {
  executionTimeMs: number;
  memoryEstimatedBytes: number;
  cpuPercentageEstimated: number;
  runtimeUsed?: 'WASM_NATIVE' | 'TS_FALLBACK';
  kernelVersion?: string;
  wasmModuleHash?: string;
  throughputMflops?: number;
}

export interface ProductionExecutionResult<TNumerical = any, TVisualization = any> {
  executionId: string;
  commandId: string;
  operationType: ProductionOperationType;
  engineId: string;
  status: ProductionExecutionStatus;
  submittedAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs: number;
  inputRevisionId: string;
  numericalResult?: TNumerical;
  verificationResult?: IndependentVerificationResult;
  visualizationData?: TVisualization;
  provenanceDigest?: string;
  reproducibilityKey?: string;
  errorMessage?: string;
  resourceUsage?: ResourceUsageMetadata;
}
