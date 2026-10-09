import { EngineeringClock } from '../../core/clock';

export type EngineeringEventType =
  | 'OBJECT_CREATED'
  | 'OBJECT_UPDATED'
  | 'OBJECT_REVISED'
  | 'OBJECT_DELETED'
  | 'OBJECT_ARCHIVED'
  | 'STATE_CHANGED'
  | 'DEPENDENCY_CREATED'
  | 'DEPENDENCY_CHANGED'
  | 'DEPENDENCY_REMOVED'
  | 'OBJECT_INVALIDATED'
  | 'SIMULATION_STARTED'
  | 'SIMULATION_COMPLETED'
  | 'SIMULATION_FAILED'
  | 'SIMULATION_CANCELLED'
  | 'MESH_CREATED'
  | 'MESH_UPDATED'
  | 'MESH_INVALIDATED'
  | 'SOLVER_STARTED'
  | 'SOLVER_COMPLETED'
  | 'SOLVER_FAILED'
  | 'SOLVER_NOT_CONVERGED'
  | 'RESULT_CREATED'
  | 'RESULT_VERIFIED'
  | 'RESULT_INVALIDATED'
  | 'EVIDENCE_CREATED'
  | 'EVIDENCE_VERIFIED'
  | 'EVIDENCE_INVALIDATED'
  | 'TOOLPATH_CREATED'
  | 'TOOLPATH_VERIFIED'
  | 'USER_ACTION'
  | 'SYSTEM_ERROR'
  | 'POLICY_VIOLATION'
  | 'EVENT_REJECTED'
  | 'WORKFLOW_CREATED'
  | 'WORKFLOW_VALIDATED'
  | 'WORKFLOW_STARTED'
  | 'TASK_READY'
  | 'TASK_STARTED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'TASK_RETRIED'
  | 'TASK_BLOCKED'
  | 'WORKFLOW_PAUSED'
  | 'WORKFLOW_RESUMED'
  | 'WORKFLOW_CANCELLED'
  | 'WORKFLOW_COMPLETED'
  | 'WORKFLOW_FAILED'
  | 'EXPLODE_VIEW_RECONSTRUCTED'
  | 'INTERFERENCE_ANALYZED'
  | 'CLEARANCE_ANALYZED';

export type EngineeringEventActorType =
  | 'USER'
  | 'SYSTEM'
  | 'ENGINE'
  | 'SOLVER'
  | 'AI'
  | 'SCHEDULER'
  | 'WORKER'
  | 'EXTERNAL_SYSTEM'
  | 'ENGINEER';

export interface EngineeringEventActor {
  readonly type?: EngineeringEventActorType;
  readonly id: string;
  readonly name?: string;
  readonly role?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface EngineeringEventSource {
  readonly service?: string;
  readonly component?: string;
  readonly engine?: string;
  readonly version?: string;
  readonly systemId?: string;
  readonly componentId?: string;
}

export interface EngineeringEvent {
  readonly id: string;
  readonly eventType: EngineeringEventType;
  readonly timestamp: string;
  readonly sequence: number;
  readonly actor: EngineeringEventActor;
  readonly source: EngineeringEventSource;
  readonly objectRefs: readonly string[];
  readonly entityIdentityId?: string;
  readonly entityType?: string;
  readonly entityRevision?: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly schemaVersion: string; // e.g., "1.0"
  readonly provenance: Readonly<{
    signature: string;
    payloadHash: string;
    previousEventHash?: string;
  }>;
}

export interface EventValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
}
