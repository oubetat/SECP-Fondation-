import * as crypto from 'crypto';
import { 
  EngineeringEvent, 
  EngineeringEventType, 
  EngineeringEventActor, 
  EngineeringEventSource, 
  EventValidationResult 
} from './types';
import { EngineeringClock, WallClock } from '../../core/clock';

const fs = null;
const path = null;

export class EngineeringEventStore {
  private events: EngineeringEvent[] = [];
  private sequenceCounter: number = 0;
  private readonly clock: EngineeringClock;
  private readonly schemaVersion = "1.0";

  private static STORAGE_KEY = 'SECP_ENGINEERING_EVENT_STORE';

  private static instance: EngineeringEventStore;
  private listeners: Array<(event: EngineeringEvent) => void> = [];

  public static getInstance(): EngineeringEventStore {
    if (!EngineeringEventStore.instance) {
      EngineeringEventStore.instance = new EngineeringEventStore();
    }
    return EngineeringEventStore.instance;
  }

  constructor(clock: EngineeringClock = new WallClock()) {
    this.clock = clock;
    this.tryLoadFromPersistence();
  }

  // ============================================================================
  // 1. APPEND OPERATIONS
  // ============================================================================

  public append(params: {
    eventType: EngineeringEventType;
    actor: EngineeringEventActor;
    source: EngineeringEventSource;
    objectRefs: readonly string[];
    entityIdentityId?: string;
    entityType?: string;
    entityRevision?: string;
    payload: Record<string, unknown>;
    correlationId: string;
    causationId?: string;
  }): EngineeringEvent {
    // 1. Strict Runtime Validation
    const allowedTypes: EngineeringEventType[] = [
      'OBJECT_CREATED', 'OBJECT_UPDATED', 'OBJECT_REVISED', 'OBJECT_DELETED', 'OBJECT_ARCHIVED',
      'STATE_CHANGED', 'DEPENDENCY_CREATED', 'DEPENDENCY_CHANGED', 'DEPENDENCY_REMOVED',
      'OBJECT_INVALIDATED', 'SIMULATION_STARTED', 'SIMULATION_COMPLETED', 'SIMULATION_FAILED',
      'SIMULATION_CANCELLED', 'MESH_CREATED', 'MESH_UPDATED', 'MESH_INVALIDATED',
      'SOLVER_STARTED', 'SOLVER_COMPLETED', 'SOLVER_FAILED', 'SOLVER_NOT_CONVERGED',
      'RESULT_CREATED', 'RESULT_VERIFIED', 'RESULT_INVALIDATED', 'EVIDENCE_CREATED',
      'EVIDENCE_VERIFIED', 'EVIDENCE_INVALIDATED', 'TOOLPATH_CREATED', 'TOOLPATH_VERIFIED',
      'USER_ACTION', 'SYSTEM_ERROR', 'POLICY_VIOLATION', 'EVENT_REJECTED',
      'WORKFLOW_CREATED', 'WORKFLOW_VALIDATED', 'WORKFLOW_STARTED', 'TASK_READY',
      'TASK_STARTED', 'TASK_COMPLETED', 'TASK_FAILED', 'TASK_RETRIED', 'TASK_BLOCKED',
      'WORKFLOW_PAUSED', 'WORKFLOW_RESUMED', 'WORKFLOW_CANCELLED', 'WORKFLOW_COMPLETED',
      'WORKFLOW_FAILED'
    ];

    if (!allowedTypes.includes(params.eventType)) {
      throw new Error(`[EngineeringEventStore] Illegal Event Type: ${params.eventType}`);
    }

    if (!params.actor) {
      throw new Error(`[EngineeringEventStore] Security violation: Actor missing`);
    }

    const timestamp = this.clock.now().toISOString();
    const rawUuid = crypto.randomBytes 
      ? crypto.randomBytes(16).toString('hex') 
      : Math.random().toString(36).substring(2);
    const id = `EVENT-${rawUuid}`;
    const sequence = ++this.sequenceCounter;

    // Hash calculation for provenance
    const payloadHash = this.calculatePayloadHash(params.payload);
    const previousEventHash = this.events.length > 0 
      ? this.events[this.events.length - 1].provenance.payloadHash 
      : undefined;

    let signature = `${id}-${timestamp}-${sequence}-${params.correlationId}-${payloadHash}`;
    try {
      if (crypto && typeof crypto.createHash === 'function') {
        signature = crypto
          .createHash('sha256')
          .update(signature)
          .digest('hex');
      }
    } catch {
      // Fallback signature
    }

    const event: EngineeringEvent = Object.freeze({
      id,
      eventType: params.eventType,
      timestamp,
      sequence,
      actor: Object.freeze({ ...params.actor }),
      source: Object.freeze({ ...params.source }),
      objectRefs: Object.freeze([...params.objectRefs]),
      entityIdentityId: params.entityIdentityId,
      entityType: params.entityType,
      entityRevision: params.entityRevision,
      payload: Object.freeze({ ...params.payload }),
      correlationId: params.correlationId,
      causationId: params.causationId,
      schemaVersion: this.schemaVersion,
      provenance: Object.freeze({
        signature,
        payloadHash,
        previousEventHash
      })
    });

    const validation = this.validate(event);
    if (!validation.isValid) {
      throw new Error(`[EngineeringEventStore] Event validation failed: ${validation.errors.join(', ')}`);
    }

    this.events.push(event);
    this.trySaveToPersistence();
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[EngineeringEventStore] Listener error:', err);
      }
    }
    return event;
  }

  /**
   * Subscribes a listener to all appended engineering events.
   */
  public subscribe(listener: (event: EngineeringEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  // ============================================================================
  // 2. QUERY & FILTER
  // ============================================================================

  public getById(id: string): EngineeringEvent | undefined {
    return this.events.find(e => e.id === id);
  }

  public getAll(): EngineeringEvent[] {
    return [...this.events];
  }

  public query(filters: {
    eventType?: EngineeringEventType;
    actorId?: string;
    sourceService?: string;
    objectId?: string;
    entityIdentityId?: string;
    correlationId?: string;
    causationId?: string;
    startTime?: string;
    endTime?: string;
    schemaVersion?: string;
  }): EngineeringEvent[] {
    return this.events.filter(e => {
      if (filters.eventType && e.eventType !== filters.eventType) return false;
      if (filters.actorId && e.actor.id !== filters.actorId) return false;
      if (filters.sourceService && e.source.service !== filters.sourceService) return false;
      if (filters.objectId && !e.objectRefs.includes(filters.objectId)) return false;
      if (filters.entityIdentityId && e.entityIdentityId !== filters.entityIdentityId) return false;
      if (filters.correlationId && e.correlationId !== filters.correlationId) return false;
      if (filters.causationId && e.causationId !== filters.causationId) return false;
      if (filters.schemaVersion && e.schemaVersion !== filters.schemaVersion) return false;
      if (filters.startTime && new Date(e.timestamp) < new Date(filters.startTime)) return false;
      if (filters.endTime && new Date(e.timestamp) > new Date(filters.endTime)) return false;
      return true;
    });
  }

  // ============================================================================
  // 3. REPLAY & RECONSTRUCTION
  // ============================================================================

  public replay(correlationId: string): EngineeringEvent[] {
    return this.events
      .filter(e => e.correlationId === correlationId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  public getCausationChain(eventId: string): EngineeringEvent[] {
    const chain: EngineeringEvent[] = [];
    let currentId: string | undefined = eventId;

    while (currentId) {
      const event = this.getById(currentId);
      if (!event) break;
      chain.unshift(event);
      currentId = event.causationId;
    }

    return chain;
  }

  // ============================================================================
  // 4. VALIDATION
  // ============================================================================

  public validate(event: EngineeringEvent): EventValidationResult {
    const errors: string[] = [];

    if (!event.id || !event.id.startsWith('EVENT-')) {
      errors.push('Invalid event ID format');
    }
    if (!event.eventType) {
      errors.push('Missing eventType');
    }
    if (!event.timestamp || isNaN(Date.parse(event.timestamp))) {
      errors.push('Invalid timestamp');
    }
    if (!event.actor || !event.actor.id || !event.actor.type) {
      errors.push('Invalid actor model');
    }
    if (!event.source || !event.source.service || !event.source.component || !event.source.version) {
      errors.push('Invalid source model');
    }
    if (event.schemaVersion !== this.schemaVersion) {
      errors.push(`Unsupported schema version: ${event.schemaVersion}. Expected: ${this.schemaVersion}`);
    }
    if (!event.correlationId) {
      errors.push('Missing correlationId');
    }
    if (!event.provenance || !event.provenance.signature || !event.provenance.payloadHash) {
      errors.push('Missing provenance signatures');
    }

    // Verify cryptographic integrity
    const expectedHash = this.calculatePayloadHash(event.payload);
    if (expectedHash !== event.provenance.payloadHash) {
      errors.push('Payload hash mismatch (Integrity Violation)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // ============================================================================
  // 5. PERSISTENCE
  // ============================================================================

  private isPersistScheduled = false;

  private trySaveToPersistence(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(EngineeringEventStore.STORAGE_KEY, JSON.stringify(this.events));
      } catch (e) {
        console.warn('[EngineeringEventStore] Failed to save to localStorage:', e);
      }
    } else if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
      if (!this.isPersistScheduled) {
        this.isPersistScheduled = true;
        const scheduler = typeof setImmediate !== 'undefined' ? setImmediate : setTimeout;
        scheduler(() => {
          this.isPersistScheduled = false;
          try {
            const fsNode = require('fs');
            const pathNode = require('path');
            fsNode.writeFileSync(
              pathNode.join(process.cwd(), '.engineering_event_store.json'), 
              JSON.stringify(this.events, null, 2)
            );
          } catch (e) {
            // ignore
          }
        }, 0);
      }
    }
  }

  private tryLoadFromPersistence(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(EngineeringEventStore.STORAGE_KEY);
        if (raw) {
          this.events = JSON.parse(raw);
          this.sequenceCounter = this.events.reduce((max, e) => Math.max(max, e.sequence), 0);
        }
      } catch (e) {
        console.warn('[EngineeringEventStore] Failed to load from localStorage:', e);
      }
    } else if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
      try {
        const fsNode = require('fs');
        const pathNode = require('path');
        const filePath = pathNode.join(process.cwd(), '.engineering_event_store.json');
        if (fsNode.existsSync(filePath)) {
          const raw = fsNode.readFileSync(filePath, 'utf8');
          this.events = JSON.parse(raw);
          this.sequenceCounter = this.events.reduce((max, e) => Math.max(max, e.sequence), 0);
        }
      } catch (e) {
        // ignore
      }
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private calculatePayloadHash(payload: Record<string, unknown>): string {
    const json = JSON.stringify(payload);
    try {
      if (crypto && typeof crypto.createHash === 'function') {
        return crypto
          .createHash('sha256')
          .update(json)
          .digest('hex');
      }
    } catch {}
    let hash = 0;
    for (let i = 0; i < json.length; i++) {
      hash = ((hash << 5) - hash) + json.charCodeAt(i);
      hash |= 0;
    }
    return `hash-${Math.abs(hash).toString(16)}`;
  }

  public clear(): void {
    this.events = [];
    this.sequenceCounter = 0;
  }
}
