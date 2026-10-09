export type WorkflowStatus =
  | "DRAFT"
  | "READY"
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "BLOCKED"
  | "UNPROVEN";

export type WorkflowTaskStatus =
  | "PENDING"
  | "READY"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED"
  | "BLOCKED"
  | "CANCELLED"
  | "UNPROVEN";

export interface EngineeringWorkflow {
  id: string;
  version: string;

  name: string;
  description?: string;

  status: WorkflowStatus;

  objectIds: string[];

  taskIds: string[];

  requiredCapabilities: string[];

  policyIds: string[];

  inputSchema?: unknown;
  outputSchema?: unknown;

  deterministic: boolean;
  replayable: boolean;

  evidenceIds: string[];

  metadata: Record<string, unknown>;
}

export interface EngineeringWorkflowTask {
  id: string;

  workflowId: string;

  name: string;

  capabilityId: string;

  dependsOn: string[];

  objectIds: string[];

  status: WorkflowTaskStatus;

  input?: unknown;
  output?: unknown;

  retryPolicy?: {
    maxAttempts: number;
    backoffMs: number;
  };

  evidenceIds: string[];

  metadata: Record<string, unknown>;
}

export interface WorkflowDefinition {
  id: string;
  version: string;

  tasks: EngineeringWorkflowTask[];

  entryTaskIds: string[];

  outputTaskIds: string[];

  metadata?: Record<string, unknown>;
}

export interface WorkflowExecutionContext {
  executionId: string;

  workflowId: string;
  workflowVersion: string;

  startedAt: string;

  objectRevisionMap: Record<string, string>;

  inputHash: string;

  correlationId: string;

  eventIds: string[];

  evidenceIds: string[];

  metadata: Record<string, unknown>;
}

export type EngineeringVerdictType =
  | "PASS"
  | "FAIL"
  | "UNPROVEN"
  | "INCONCLUSIVE"
  | "INVALID";
