
export type WorkflowStage =
  | 'REQUIREMENT_INTAKE'
  | 'CAD_CREATION'
  | 'ASSEMBLY_INTEGRATION'
  | 'SIMULATION_ANALYSIS'
  | 'DESIGN_OPTIMIZATION'
  | 'DRAWING_PRODUCTION'
  | 'CAM_GENERATION'
  | 'NC_VERIFICATION'
  | 'EVIDENCE_COMPILATION'
  | 'ENGINEERING_DECISION';

export type WorkflowStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'STALE' | 'RE-RUN_REQUIRED';

export interface EngineeringRequirement {
  id: string;
  description: string;
  constraints: Record<string, any>;
  material: string;
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL';
}

export interface WorkflowArtifact {
  artifactId: string;
  stage: WorkflowStage;
  revision: string;
  dataHash: string;
  status: WorkflowStatus;
  timestamp: string;
  evidenceId?: string;
}

export interface RealEngineerWorkflowContext {
  workflowId: string;
  projectId: string;
  engineerId: string;
  productId: string;
  currentRevision: string;
  requirements: EngineeringRequirement[];
  artifacts: Map<WorkflowStage, WorkflowArtifact>;
  dependencyGraph: Map<WorkflowStage, WorkflowStage[]>;
  logs: string[];
}

export interface WorkflowDecision {
  workflowId: string;
  verdict: 'ACCEPT' | 'REVISE' | 'REJECT' | 'INCONCLUSIVE';
  reasoning: string;
  approvedBy: string;
  timestamp: string;
}

export interface WorkflowEvidencePackage {
  workflowId: string;
  traceabilityMatrix: Record<string, string[]>;
  evidenceIds: string[];
  globalHash: string;
  verdict: string;
}
