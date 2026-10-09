export type ManufacturingObjectiveType =
  | 'MINIMIZE_CYCLE_TIME'
  | 'MINIMIZE_MACHINING_COST'
  | 'MINIMIZE_TOOLPATH_LENGTH'
  | 'MINIMIZE_TOOL_WEAR'
  | 'MINIMIZE_ENERGY'
  | 'MINIMIZE_SCRAP_RISK'
  | 'MAXIMIZE_SURFACE_QUALITY'
  | 'MAXIMIZE_MATERIAL_REMOVAL_RATE'
  | 'MAXIMIZE_MACHINE_UTILIZATION'
  | 'MAXIMIZE_PROCESS_ROBUSTNESS';

export type ManufacturingConstraintCategory =
  | 'GEOMETRY' | 'MACHINE' | 'KINEMATIC' | 'TOOL' | 'MATERIAL'
  | 'CUTTING' | 'THERMAL' | 'FORCE' | 'SURFACE' | 'TOLERANCE'
  | 'COLLISION' | 'ACCESS' | 'FIXTURE' | 'WORKHOLDING'
  | 'ENERGY' | 'COST' | 'TIME' | 'QUALITY' | 'SAFETY';

export type ManufacturingSeverity = 'HARD_CONSTRAINT' | 'SOFT_CONSTRAINT';

export type CollisionSeverity = 'WARNING' | 'CRITICAL' | 'FATAL';

export type ManufacturingVerdict =
  | 'VERIFIED_MANUFACTURING_PLAN'
  | 'NO_VERIFIED_MANUFACTURING_PLAN'
  | 'MANUFACTURING_INFEASIBLE'
  | 'COLLISION_DETECTED'
  | 'KINEMATIC_VIOLATION'
  | 'TOOL_INFEASIBLE'
  | 'MACHINE_INFEASIBLE'
  | 'BUDGET_EXHAUSTED'
  | 'VERIFICATION_FAILURE';

export interface ManufacturingConstraint {
  constraintId: string;
  category: ManufacturingConstraintCategory;
  expression: string;
  operator: '<=' | '>=' | '==' | 'IN_RANGE' | 'NOT_IN_RANGE' | 'BOOLEAN';
  limit: number | [number, number] | boolean;
  unit: string;
  tolerance: number;
  severity: ManufacturingSeverity;
}

export interface ProcessPlan {
  planId: string;
  operations: any[];
  machineId: string;
  tools: any[];
  fixtures: any[];
  parameters: Record<string, any>;
  estimatedTime: number;
  estimatedCost: number;
  verificationState: string;
}

export interface ManufacturingCandidate {
  candidateId: string;
  processPlan: ProcessPlan;
  objectives: Record<string, number>;
  constraintViolations: any[];
  feasibility: boolean;
  collisionStatus: CollisionSeverity | 'NONE';
  kinematicsStatus: 'VALID' | 'INVALID';
  gcodeVerified: boolean;
  machineTwinVerified: boolean;
}

export interface ManufacturingOptimizationProblem {
  problemId: string;
  partId: string;
  materialId: string;
  objectives: { type: ManufacturingObjectiveType, weight: number }[];
  constraints: ManufacturingConstraint[];
}

export interface ManufacturingEvidenceBundle {
  problemId: string;
  optimizationHash: string;
  candidateHistory: ManufacturingCandidate[];
  finalVerdict: ManufacturingVerdict;
  verifiedPlan?: ProcessPlan;
  timestamp: string;
}
