export enum WorkflowMaturity {
  NOT_STARTED = 'NOT_STARTED',
  PRODUCTION_PROVEN = 'PRODUCTION_PROVEN',
  VALIDATED = 'VALIDATED',
  VERIFIED = 'VERIFIED',
  PARTIAL = 'PARTIAL',
  BLOCKED = 'BLOCKED'
}

export interface WorkflowStage {
  id: string;
  name: string;
  domain: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | WorkflowMaturity;
  isCritical?: boolean;
  evidenceIds: string[];
  failureReason?: string;
  executionTimeMs?: number;
}

export interface DataLineageNode {
  id: string;
  label: string;
  domain: string;
  hash: string;
  transform: string;
  timestamp: string;
  evidenceId: string;
}

export interface EngineeringWorkflow {
  id: string;
  name: string;
  maturity: WorkflowMaturity;
  stages: WorkflowStage[];
  lineage: DataLineageNode[];
}

export interface WorkflowExecutionResult {
  workflowId: string;
  status?: 'SUCCESS' | 'FAILURE';
  overallMaturity: WorkflowMaturity;
  stages: Record<string, WorkflowStage>;
  lineage: DataLineageNode[];
  qualificationScore: number;
  timestamp: string;
  hasRegressions: boolean;
  logs?: string[];
}
