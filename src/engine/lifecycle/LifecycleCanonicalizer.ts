import * as crypto from 'crypto';
import { 
  LifecycleEntity, 
  LifecycleEvent, 
  LifecycleTransition, 
  CausalLink 
} from './types';

export class LifecycleCanonicalizer {
  public static sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  public static canonicalize(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map(item => LifecycleCanonicalizer.canonicalize(item)).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    const keyValues = keys.map(key => {
      const val = obj[key];
      if (val === undefined) return null;
      return `${JSON.stringify(key)}:${LifecycleCanonicalizer.canonicalize(val)}`;
    }).filter(kv => kv !== null);

    return '{' + keyValues.join(',') + '}';
  }

  public static computeEventHash(event: Partial<LifecycleEvent>): string {
    const payload = {
      entityId: event.entityId,
      entityType: event.entityType,
      eventType: event.eventType,
      timestamp: event.timestamp,
      actor: event.actor,
      source: event.source,
      sequence: event.sequence,
      payloadHash: event.payloadHash,
      previousEventHash: event.previousEventHash
    };
    return LifecycleCanonicalizer.sha256(LifecycleCanonicalizer.canonicalize(payload));
  }

  public static computeTransitionHash(transition: Partial<LifecycleTransition>): string {
    const payload = {
      entityId: transition.entityId,
      fromState: transition.fromState,
      toState: transition.toState,
      trigger: transition.trigger,
      actor: transition.actor,
      timestamp: transition.timestamp,
      reason: transition.reason,
      evidenceId: transition.evidenceId,
      previousHash: transition.previousHash
    };
    return LifecycleCanonicalizer.sha256(LifecycleCanonicalizer.canonicalize(payload));
  }

  public static computeCausalLinkHash(link: Partial<CausalLink>): string {
    const payload = {
      sourceEntity: link.sourceEntity,
      targetEntity: link.targetEntity,
      relationshipType: link.relationshipType,
      reason: link.reason,
      evidenceId: link.evidenceId,
      actor: link.actor,
      timestamp: link.timestamp
    };
    return LifecycleCanonicalizer.sha256(LifecycleCanonicalizer.canonicalize(payload));
  }
}
