import { EngineeringEventStore } from '../event-model/EngineeringEventStore';

export class EngineeringObjectLockManager {
  private locks: Map<string, string> = new Map(); // objectId -> ownerId (e.g., taskId or executionId)
  private eventStore: EngineeringEventStore;

  constructor(eventStore = EngineeringEventStore.getInstance()) {
    this.eventStore = eventStore;
  }

  public acquire(objectId: string, ownerId: string): boolean {
    if (this.locks.has(objectId)) {
      if (this.locks.get(objectId) === ownerId) {
        return true; // Already held by same owner
      }
      return false; // Held by someone else
    }
    this.locks.set(objectId, ownerId);

    // Log the acquire event
    try {
      this.eventStore.append({
        eventType: 'USER_ACTION',
        actor: { type: 'SYSTEM', id: 'lock-manager' },
        source: { service: 'workflow-engine', component: 'lock-manager', version: '1.0' },
        objectRefs: [objectId],
        payload: { action: 'lock_acquired', objectId, ownerId, timestamp: new Date().toISOString() },
        correlationId: ownerId
      });
    } catch {
      // Suppress or ignore
    }

    return true;
  }

  public release(objectId: string, ownerId: string): boolean {
    if (!this.locks.has(objectId)) {
      return true; // Already free
    }
    if (this.locks.get(objectId) !== ownerId) {
      return false; // Owner mismatch
    }
    this.locks.delete(objectId);

    // Log the release event
    try {
      this.eventStore.append({
        eventType: 'USER_ACTION',
        actor: { type: 'SYSTEM', id: 'lock-manager' },
        source: { service: 'workflow-engine', component: 'lock-manager', version: '1.0' },
        objectRefs: [objectId],
        payload: { action: 'lock_released', objectId, ownerId, timestamp: new Date().toISOString() },
        correlationId: ownerId
      });
    } catch {
      // Suppress or ignore
    }

    return true;
  }

  public isLocked(objectId: string): boolean {
    return this.locks.has(objectId);
  }

  public getOwner(objectId: string): string | undefined {
    return this.locks.get(objectId);
  }

  public clear(): void {
    this.locks.clear();
  }
}
