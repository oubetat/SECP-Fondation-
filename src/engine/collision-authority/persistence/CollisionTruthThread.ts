import { EngineeringEvent, RevisionBindingMetadata } from './types';
import { CanonicalCollisionInput, CanonicalCollisionResult } from '../types';

export class CollisionTruthThread {
  private static events: EngineeringEvent[] = [];

  public static reset(): void {
    this.events = [];
  }

  public static getEvents(): ReadonlyArray<EngineeringEvent> {
    return this.events;
  }

  public static canonicalStringify(obj: unknown): string {
    if (obj === null || typeof obj !== 'object') {
      if (typeof obj === 'number') {
        if (obj === Infinity) return '"+Infinity"';
        if (obj === -Infinity) return '"-Infinity"';
        if (Number.isNaN(obj)) return '"NaN"';
      }
      return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
      return '[' + obj.map(item => this.canonicalStringify(item)).join(',') + ']';
    }

    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const keyPairs = keys.map(key => {
      const val = (obj as Record<string, unknown>)[key];
      if (val === undefined) return null;
      return JSON.stringify(key) + ':' + this.canonicalStringify(val);
    }).filter(p => p !== null);

    return '{' + keyPairs.join(',') + '}';
  }

  public static simpleHash(str: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    const hex = (hash >>> 0).toString(16).padStart(8, '0');
    return (hex + hex + hex + hex + hex + hex + hex + hex).substring(0, 64);
  }

  public static computeInputHash(input: CanonicalCollisionInput): string {
    return this.simpleHash(this.canonicalStringify(input));
  }

  public static computeResultHash(result: CanonicalCollisionResult): string {
    return this.simpleHash(this.canonicalStringify(result));
  }

  public static computeCanonicalEngineeringResultHash(result: CanonicalCollisionResult): string {
    if (!result) return this.simpleHash('null');
    const engineeringTruth = {
      status: result.status,
      severity: result.severity,
      exactness: result.exactness,
      provenSafe: result.provenSafe,
      metrics: result.metrics,
      temporalInfo: result.temporalInfo,
      failureState: result.failureState,
      provenance: {
        cadDocumentRevisionId: result.provenance?.cadDocumentRevisionId,
        geometryHash: result.provenance?.geometryHash,
        algorithmVersion: result.provenance?.algorithmVersion
      },
      contactManifold: result.contactManifold,
      diagnostics: result.diagnostics
    };
    return this.simpleHash(this.canonicalStringify(engineeringTruth));
  }

  public static computeEvidenceHash(evidence: Record<string, unknown>): string {
    return this.simpleHash(this.canonicalStringify(evidence));
  }

  public static computeGeometrySnapshotIdentity(
    documentId: string,
    revisionId: string,
    geometryId: string,
    geometryHash: string,
    topologyIdentity: string
  ): string {
    const raw = `${documentId}:${revisionId}:${geometryId}:${geometryHash}:${topologyIdentity}`;
    return `SNAP_${this.simpleHash(raw).substring(0, 16)}`;
  }

  public static recordEvent(params: {
    eventType: 'COLLISION_EVALUATED' | 'COLLISION_PERSISTED' | 'COLLISION_RECONSTRUCTED' | 'COLLISION_REEXECUTED';
    executionId: string;
    resultId: string;
    evidenceId: string;
    input: CanonicalCollisionInput;
    result: CanonicalCollisionResult;
    revisionBinding: RevisionBindingMetadata;
    evidenceHash: string;
    providerId: string;
    algorithmVersion: string;
  }): EngineeringEvent {
    const previousEvent = this.events.length > 0 ? this.events[this.events.length - 1] : null;
    const previousEventId = previousEvent ? previousEvent.eventId : null;

    const inputHash = this.computeInputHash(params.input);
    const resultHash = this.computeResultHash(params.result);
    const eventId = `EVT_${params.executionId}_${this.events.length + 1}`;
    const timestampIso = new Date().toISOString();

    const rawEvent = {
      eventId,
      eventType: params.eventType,
      executionId: params.executionId,
      resultId: params.resultId,
      evidenceId: params.evidenceId,
      inputHash,
      resultHash,
      evidenceHash: params.evidenceHash,
      revisionBinding: params.revisionBinding,
      timestampIso,
      providerId: params.providerId,
      algorithmVersion: params.algorithmVersion,
      previousEventId
    };

    const eventHash = this.simpleHash(this.canonicalStringify(rawEvent));
    const event: EngineeringEvent = Object.freeze({
      ...rawEvent,
      eventHash
    });

    this.events.push(event);
    return event;
  }

  public static verifyChain(events: ReadonlyArray<EngineeringEvent>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!events || events.length === 0) {
      return { isValid: true, errors: [] };
    }

    for (let i = 0; i < events.length; i++) {
      const evt = events[i];
      if (i === 0) {
        if (evt.previousEventId !== null) {
          errors.push(`First event ${evt.eventId} has non-null previousEventId: ${evt.previousEventId}`);
        }
      } else {
        const prev = events[i - 1];
        if (evt.previousEventId !== prev.eventId) {
          errors.push(`Linkage broken between ${prev.eventId} and ${evt.eventId}: expected previousEventId '${prev.eventId}', got '${evt.previousEventId}'`);
        }
      }

      const { eventHash, ...unhashed } = evt;
      const expectedHash = this.simpleHash(this.canonicalStringify(unhashed));
      if (eventHash !== expectedHash) {
        errors.push(`Event ${evt.eventId} hash mismatch: stored '${eventHash}', computed '${expectedHash}'`);
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}
