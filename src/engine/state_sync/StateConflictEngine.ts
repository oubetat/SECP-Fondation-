import { EngineeringState, StateConflict } from './types';

export class StateConflictEngine {
  public static detectConflicts(
    baseState: EngineeringState,
    sourceState: EngineeringState,
    targetState: EngineeringState
  ): StateConflict[] {
    const conflicts: StateConflict[] = [];

    // Version conflict
    if (sourceState.stateVersion !== baseState.stateVersion && targetState.stateVersion !== baseState.stateVersion) {
      if (sourceState.stateVersion !== targetState.stateVersion) {
         conflicts.push({
           conflictId: `CONF-VER-${Date.now()}`,
           entityId: sourceState.entityId,
           baseVersion: baseState.stateVersion,
           sourceVersion: sourceState.stateVersion,
           targetVersion: targetState.stateVersion,
           conflictingFields: [],
           detectedAt: new Date().toISOString(),
           severity: 'BLOCKING',
           resolutionStatus: 'UNRESOLVED',
           conflictType: 'VERSION_CONFLICT'
         });
      }
    }

    // Field conflict
    const conflictingFields: string[] = [];
    const allKeys = new Set([...Object.keys(sourceState.payload), ...Object.keys(targetState.payload)]);
    
    for (const key of allKeys) {
      const baseVal = baseState.payload[key];
      const sourceVal = sourceState.payload[key];
      const targetVal = targetState.payload[key];

      if (sourceVal !== baseVal && targetVal !== baseVal && sourceVal !== targetVal) {
        conflictingFields.push(key);
      }
    }

    if (conflictingFields.length > 0) {
      conflicts.push({
        conflictId: `CONF-FLD-${Date.now()}`,
        entityId: sourceState.entityId,
        baseVersion: baseState.stateVersion,
        sourceVersion: sourceState.stateVersion,
        targetVersion: targetState.stateVersion,
        conflictingFields,
        detectedAt: new Date().toISOString(),
        severity: 'BLOCKING',
        resolutionStatus: 'UNRESOLVED',
        conflictType: 'FIELD_CONFLICT'
      });
    }

    return conflicts;
  }
}
