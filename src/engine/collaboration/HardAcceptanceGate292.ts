import { CollaborationEngine } from './CollaborationEngine';
import { CollaborationChangeEvent } from './CollaborationTypes';

export interface Gate292Check {
  name: string;
  passed: boolean;
  message: string;
}

export interface Gate292Report {
  passed: boolean;
  checks: Gate292Check[];
}

export class HardAcceptanceGate292 {
  public static evaluate(): Gate292Report {
    const checks: Gate292Check[] = [];
    const engine = new CollaborationEngine();
    const projectId = 'PROJ-COLLAB-001';

    // 1. Multi-user session creation
    const sessA = engine.createSession(projectId, 'ENGINEER_A', 'DEV-001');
    const sessB = engine.createSession(projectId, 'ENGINEER_B', 'DEV-002');

    if (sessA && sessB && sessA.sessionId !== sessB.sessionId) {
      checks.push({
        name: 'Multi-user Session Lifecycle',
        passed: true,
        message: 'Successfully established independent concurrent sessions for multiple engineers.'
      });
    } else {
      checks.push({
        name: 'Multi-user Session Lifecycle',
        passed: false,
        message: 'Failed to create distinct sessions.'
      });
    }

    // 2. Presence tracking
    const state = engine.getProjectState(projectId);
    if (state && state.activeUsers.length === 2) {
      checks.push({
        name: 'Presence & Identity Awareness',
        passed: true,
        message: 'Active user registry correctly tracks multiple participants in real-time.'
      });
    } else {
      checks.push({
        name: 'Presence & Identity Awareness',
        passed: false,
        message: 'Presence registry failed to detect all active users.'
      });
    }

    // 3. Concurrency & Version Check (No Silent Overwrite)
    const event1: CollaborationChangeEvent = {
      eventId: 'EVT-001',
      userId: 'ENGINEER_A',
      sessionId: sessA.sessionId,
      objectId: 'PART-001',
      baseVersion: 0,
      newVersion: 1,
      operation: 'UPDATE',
      payload: { hole_dia: 20 },
      timestamp: Date.now()
    };

    engine.submitChange(projectId, event1);

    // Engineer B tries to update PART-001 using baseVersion 0 (stale)
    const event2: CollaborationChangeEvent = {
      eventId: 'EVT-002',
      userId: 'ENGINEER_B',
      sessionId: sessB.sessionId,
      objectId: 'PART-001',
      baseVersion: 0,
      newVersion: 1,
      operation: 'UPDATE',
      payload: { hole_dia: 30 },
      timestamp: Date.now() + 10
    };

    const result = engine.submitChange(projectId, event2);

    if (result.conflict && result.conflict.type === 'PARAMETER_CONFLICT') {
      checks.push({
        name: 'Optimistic Concurrency & Conflict Detection',
        passed: true,
        message: 'Successfully detected parametric conflict and blocked silent data loss on stale base version.'
      });
    } else {
      checks.push({
        name: 'Optimistic Concurrency & Conflict Detection',
        passed: false,
        message: 'Failed to detect concurrent edit conflict.'
      });
    }

    // 4. Fine-grained Locking
    const lock = engine.acquireLock(projectId, 'ENGINEER_A', sessA.sessionId, 'PART-002', 'HARD', 'Critical geometry edit');
    const lockAttempt = engine.acquireLock(projectId, 'ENGINEER_B', sessB.sessionId, 'PART-002', 'HARD', 'Bypass attempt');

    if (lock && !lockAttempt) {
      checks.push({
        name: 'Fine-grained Hard Locking',
        passed: true,
        message: 'Hard lock successfully protected object from concurrent modifications by unauthorized actors.'
      });
    } else {
      checks.push({
        name: 'Fine-grained Hard Locking',
        passed: false,
        message: 'Locking mechanism allowed unauthorized concurrent access.'
      });
    }

    // 5. Idempotency Check
    const resultDuplicate = engine.submitChange(projectId, event1); // Re-submit same event
    if (resultDuplicate.newState.history.filter(h => h.eventId === 'EVT-001').length === 1) {
      checks.push({
        name: 'Event Idempotency & Duplicate Guard',
        passed: true,
        message: 'Engine correctly ignored duplicate event broadcast to maintain state consistency.'
      });
    } else {
      checks.push({
        name: 'Event Idempotency & Duplicate Guard',
        passed: false,
        message: 'Duplicate event produced redundant history entry.'
      });
    }

    const passed = checks.every(c => c.passed);
    return { passed, checks };
  }
}
