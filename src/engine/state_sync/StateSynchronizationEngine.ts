import { 
  EngineeringState, 
  StateSynchronizationEvent, 
  SynchronizationSession, 
  StateDependency,
  SyncStatus
} from './types';
import { CanonicalStateSerializer } from './CanonicalStateSerializer';

export class StateSynchronizationEngine {
  public createState(
    entityId: string,
    entityType: string,
    stateVersion: number,
    schemaVersion: string,
    payload: any,
    dependencies: StateDependency[],
    parentStateId?: string,
    parentStateVersion?: number,
    parentStateHash?: string
  ): EngineeringState {
    const payloadStr = CanonicalStateSerializer.canonicalizePayload(payload);
    const payloadHash = CanonicalStateSerializer.sha256(payloadStr);
    const dependencyFingerprint = CanonicalStateSerializer.computeDependencyFingerprint(dependencies);

    const stateHash = CanonicalStateSerializer.computeStateHash(
      payloadHash,
      entityId,
      stateVersion,
      schemaVersion,
      parentStateHash || 'GENESIS',
      dependencyFingerprint
    );

    return {
      stateId: `STATE-${entityId}-v${stateVersion}`,
      entityId,
      entityType,
      stateVersion,
      schemaVersion,
      parentStateId,
      parentStateVersion,
      timestamp: new Date().toISOString(),
      source: 'ENGINEERING_SYSTEM',
      sourceVersion: 'v1.0',
      configurationHash: 'CONF-HASH-1',
      payload,
      payloadHash,
      dependencyFingerprint,
      stateHash,
      status: 'CURRENT'
    };
  }

  public createSyncSession(
    syncSessionId: string,
    sourceState: EngineeringState,
    targetState: EngineeringState,
    baseStateHash: string
  ): SynchronizationSession {
    return {
      syncSessionId,
      startedAt: new Date().toISOString(),
      sourceEntityId: sourceState.entityId,
      targetEntityId: targetState.entityId,
      baseStateHash,
      sourceStateHash: sourceState.stateHash,
      targetStateHash: targetState.stateHash,
      operationCount: 0,
      conflictCount: 0,
      status: 'PREPARING',
      syncRootHash: ''
    };
  }

  public createSyncEvent(
    eventId: string,
    syncSessionId: string,
    sourceStateHash: string,
    targetStateHash: string,
    operation: string,
    sequenceNumber: number,
    previousEventHash: string
  ): StateSynchronizationEvent {
    const payloadStr = JSON.stringify({ syncSessionId, sourceStateHash, targetStateHash, operation, sequenceNumber });
    const eventHash = CanonicalStateSerializer.computeSyncEventHash(payloadStr, previousEventHash);

    return {
      eventId,
      syncSessionId,
      sourceStateHash,
      targetStateHash,
      operation,
      timestamp: new Date().toISOString(),
      sequenceNumber,
      previousEventHash,
      eventHash
    };
  }
}
