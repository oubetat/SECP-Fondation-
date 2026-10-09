import { 
  CollaborationSession, 
  UserPresence, 
  ProjectCollabState, 
  ObjectLock, 
  UserStatus,
  CollaborationChangeEvent
} from './CollaborationTypes';
import { CollaborationSyncEngine } from './SyncEngine';

export class CollaborationEngine {
  private sessions: Map<string, CollaborationSession> = new Map();
  private presence: Map<string, UserPresence> = new Map();
  private projectStates: Map<string, ProjectCollabState> = new Map();
  private syncEngine: CollaborationSyncEngine = new CollaborationSyncEngine();

  private LOCK_EXPIRATION_MS = 1000 * 60 * 15; // 15 mins
  private PRESENCE_EXPIRATION_MS = 1000 * 30; // 30 seconds

  constructor() {
    // Start presence cleanup timer
    setInterval(() => this.cleanupPresence(), 10000);
  }

  /**
   * RULE 1: Collaboration Engine - createSession
   */
  public createSession(
    projectId: string, 
    userId: string, 
    deviceId: string
  ): CollaborationSession {
    const session: CollaborationSession = {
      sessionId: `SESS-${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      userId,
      deviceId,
      connectionState: 'CONNECTED',
      joinedAt: Date.now(),
      lastActivityAt: Date.now(),
      status: 'ACTIVE'
    };

    this.sessions.set(session.sessionId, session);
    this.updatePresence(userId, session.sessionId, 'ONLINE');
    this.ensureProjectState(projectId);
    
    return session;
  }

  private ensureProjectState(projectId: string) {
    if (!this.projectStates.has(projectId)) {
      this.projectStates.set(projectId, {
        projectId,
        activeUsers: [],
        activeEdits: {},
        locks: [],
        versionMap: {},
        history: []
      });
    }
  }

  /**
   * RULE 5: Presence Service
   */
  public updatePresence(userId: string, sessionId: string, status: UserStatus, activeObjectId?: string) {
    const presence: UserPresence = {
      userId,
      sessionId,
      status,
      lastSeenAt: Date.now(),
      activeObjectId
    };
    this.presence.set(userId, presence);
    
    // Update session activity
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = Date.now();
      session.connectionState = 'CONNECTED';
    }
  }

  /**
   * RULE 6: Presence Expiration
   */
  private cleanupPresence() {
    const now = Date.now();
    for (const [userId, p] of this.presence.entries()) {
      if (now - p.lastSeenAt > this.PRESENCE_EXPIRATION_MS) {
        p.status = 'DISCONNECTED';
        const session = this.sessions.get(p.sessionId);
        if (session) session.connectionState = 'DISCONNECTED';
      }
    }
  }

  /**
   * RULE 24: Fine-Grained Locking
   */
  public acquireLock(
    projectId: string, 
    userId: string, 
    sessionId: string, 
    objectId: string, 
    type: 'SOFT' | 'HARD',
    reason?: string
  ): ObjectLock | null {
    const state = this.projectStates.get(projectId);
    if (!state) return null;

    // Check for existing hard locks
    const existingLock = state.locks.find(l => l.objectId === objectId && l.type === 'HARD');
    if (existingLock && existingLock.userId !== userId) {
      return null; // Blocked
    }

    const lock: ObjectLock = {
      lockId: `LOCK-${Math.random().toString(36).substr(2, 9)}`,
      objectId,
      userId,
      sessionId,
      type,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.LOCK_EXPIRATION_MS,
      reason
    };

    state.locks = state.locks.filter(l => l.objectId !== objectId || l.userId !== userId);
    state.locks.push(lock);
    return lock;
  }

  public releaseLock(projectId: string, lockId: string) {
    const state = this.projectStates.get(projectId);
    if (state) {
      state.locks = state.locks.filter(l => l.lockId !== lockId);
    }
  }

  /**
   * RULE 38: Collaboration Sync Engine Bridge
   */
  public submitChange(projectId: string, event: CollaborationChangeEvent) {
    const state = this.projectStates.get(projectId);
    if (!state) throw new Error('Project state not initialized');

    const result = this.syncEngine.processEvent(state, event);
    this.projectStates.set(projectId, result.newState);
    
    return result;
  }

  public getProjectState(projectId: string): ProjectCollabState | undefined {
    const state = this.projectStates.get(projectId);
    if (state) {
      state.activeUsers = Array.from(this.presence.values()).filter(p => {
        const sess = this.sessions.get(p.sessionId);
        return sess && sess.projectId === projectId;
      });
    }
    return state;
  }

  public getAllSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values());
  }
}
