// SECP Industrial OS v2 — State Synchronization Types

export type StateStatus = 'CURRENT' | 'STALE' | 'CONFLICT' | 'INVALID' | 'UNKNOWN';
export type SyncStatus = 'PENDING' | 'PREPARING' | 'SYNCING' | 'VALIDATING' | 'COMMITTING' | 'COMPLETED' | 'PARTIAL' | 'CONFLICT' | 'FAILED' | 'ABORTED' | 'INVALID';

export interface EngineeringState {
  stateId: string;
  entityId: string;
  entityType: string;
  stateVersion: number;
  schemaVersion: string;
  parentStateId?: string;
  parentStateVersion?: number;
  timestamp: string;
  source: string;
  sourceVersion: string;
  configurationHash: string;
  payload: any;
  payloadHash: string;
  dependencyFingerprint: string;
  stateHash: string;
  status: StateStatus;
}

export interface SynchronizationSession {
  syncSessionId: string;
  startedAt: string;
  completedAt?: string;
  sourceEntityId: string;
  targetEntityId: string;
  baseStateHash: string;
  sourceStateHash: string;
  targetStateHash?: string;
  operationCount: number;
  conflictCount: number;
  status: SyncStatus;
  syncRootHash: string;
}

export interface StateSynchronizationEvent {
  eventId: string;
  syncSessionId: string;
  sourceStateHash: string;
  targetStateHash: string;
  operation: string;
  timestamp: string;
  sequenceNumber: number;
  previousEventHash: string;
  eventHash: string;
}

export interface StateConflict {
  conflictId: string;
  entityId: string;
  baseVersion: number;
  sourceVersion: number;
  targetVersion: number;
  conflictingFields: string[];
  detectedAt: string;
  severity: 'INFO' | 'WARNING' | 'MAJOR' | 'CRITICAL' | 'BLOCKING';
  resolutionStatus: 'UNRESOLVED' | 'RESOLVED';
  conflictType: 'VERSION_CONFLICT' | 'FIELD_CONFLICT' | 'CAUSAL_CONFLICT' | 'SCHEMA_CONFLICT' | 'OWNERSHIP_CONFLICT';
}

export interface StateEvidence {
  evidenceId: string;
  stateId: string;
  stateHash: string;
  parentHash: string;
  sourceEvent: string;
  runtimeSessionId: string;
  timestamp: string;
  evidenceHash: string;
}

export interface StateDependency {
  entityId: string;
  stateVersion: number;
  stateHash: string;
}
