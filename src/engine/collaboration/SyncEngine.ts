import { 
  CollaborationChangeEvent, 
  ProjectCollabState, 
  CollaborationConflict 
} from './CollaborationTypes';
import { CollaborationConflictEngine } from './ConflictEngine';

export class CollaborationSyncEngine {
  private pendingQueue: CollaborationChangeEvent[] = [];
  private processedEventIds: Set<string> = new Set();

  /**
   * RULE 38: Synchronization Engine
   */
  public processEvent(
    state: ProjectCollabState, 
    event: CollaborationChangeEvent
  ): { newState: ProjectCollabState; conflict: CollaborationConflict | null } {
    
    // RULE 43: Event Idempotency & RULE 44: Duplicate Detection
    if (this.processedEventIds.has(event.eventId)) {
      return { newState: state, conflict: null };
    }

    const conflict = CollaborationConflictEngine.detectConflict(state, event);

    if (conflict) {
      return { newState: state, conflict };
    }

    // Apply change
    const newState = { ...state };
    newState.versionMap[event.objectId] = event.newVersion;
    newState.history = [...newState.history, event];
    
    // Track edit intent
    newState.activeEdits[event.objectId] = event.userId;

    this.processedEventIds.add(event.eventId);
    return { newState, conflict: null };
  }

  /**
   * RULE 40: Incremental Synchronization
   */
  public getDeltas(state: ProjectCollabState, lastKnownVersion: number): CollaborationChangeEvent[] {
    return state.history.filter(h => h.timestamp > lastKnownVersion);
  }

  /**
   * RULE 46: Offline Queue
   */
  public queueOfflineChange(event: CollaborationChangeEvent) {
    this.pendingQueue.push(event);
  }

  public flushOfflineQueue(
    state: ProjectCollabState
  ): { newState: ProjectCollabState; conflicts: CollaborationConflict[] } {
    let currentState = state;
    const conflicts: CollaborationConflict[] = [];

    // RULE 47: Offline Reconciliation
    for (const event of this.pendingQueue) {
      const { newState, conflict } = this.processEvent(currentState, event);
      currentState = newState;
      if (conflict) conflicts.push(conflict);
    }

    this.pendingQueue = [];
    return { newState: currentState, conflicts };
  }
}
