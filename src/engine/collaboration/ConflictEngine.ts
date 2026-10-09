import { 
  CollaborationChangeEvent, 
  CollaborationConflict, 
  ConflictType, 
  ResolutionStrategy,
  ProjectCollabState
} from './CollaborationTypes';

export class CollaborationConflictEngine {
  public static detectConflict(
    state: ProjectCollabState, 
    event: CollaborationChangeEvent
  ): CollaborationConflict | null {
    const currentVersion = state.versionMap[event.objectId] || 0;

    // RULE 12: Version Check (CLIENT VERSION == SERVER VERSION)
    // RULE 13: No Silent Overwrite
    if (event.baseVersion !== currentVersion) {
      return {
        conflictId: `CONF-${Math.random().toString(36).substr(2, 9)}`,
        type: this.classifyConflict(state, event),
        objectId: event.objectId,
        competingEvents: [
          ...state.history.filter(h => h.objectId === event.objectId && h.newVersion > event.baseVersion),
          event
        ],
        status: 'PENDING'
      };
    }

    return null;
  }

  private static classifyConflict(
    state: ProjectCollabState, 
    event: CollaborationChangeEvent
  ): ConflictType {
    // Logic to determine conflict type based on operation and data
    const payload = event.payload;

    if (payload?.geometry) return 'GEOMETRY_CONFLICT';
    if (payload?.parameters) return 'PARAMETER_CONFLICT';
    if (payload?.featureTree) return 'FEATURE_TREE_CONFLICT';
    if (event.operation === 'REVISE') return 'REVISION_CONFLICT';
    
    return 'OBJECT_CONFLICT';
  }

  public static resolve(
    conflict: CollaborationConflict,
    strategy: ResolutionStrategy,
    userId: string
  ): CollaborationConflict {
    return {
      ...conflict,
      status: 'RESOLVED',
      resolution: {
        strategy,
        resolvedBy: userId,
        resolvedAt: Date.now(),
        resultVersion: Math.max(...conflict.competingEvents.map(e => e.newVersion)) + 1
      }
    };
  }

  /**
   * RULE 22: No Automatic Geometry Merge Without Validation
   */
  public static validateMerge(
    type: ConflictType, 
    strategy: ResolutionStrategy
  ): boolean {
    if (type === 'GEOMETRY_CONFLICT' && strategy === 'MERGE') {
      // Complex CAD merges are forbidden without explicit validation (mocked here as false)
      return false; 
    }
    return true;
  }
}
