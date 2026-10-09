import { 
  LifecycleEntity, 
  LifecycleEvent, 
  LifecycleTransition, 
  CausalLink, 
  LifecycleVerdict,
  LifecycleSnapshot,
  LifecycleEntityType,
  LifecycleState
} from './types';
import { LifecycleCanonicalizer } from './LifecycleCanonicalizer';
import { LifecycleStateMachine } from './LifecycleStateMachine';

export class LifecycleTraceabilityEngine {
  private events: LifecycleEvent[] = [];
  private transitions: LifecycleTransition[] = [];
  private causalLinks: CausalLink[] = [];
  private entities: Map<string, LifecycleEntity> = new Map();

  public recordEvent(eventInput: Partial<LifecycleEvent>): LifecycleEvent {
    const entity = this.entities.get(eventInput.entityId!);
    const lastEvent = this.events.filter(e => e.entityId === eventInput.entityId).sort((a, b) => b.sequence - a.sequence)[0];
    
    const event: LifecycleEvent = {
      eventId: `EVT-${LifecycleCanonicalizer.sha256(eventInput.entityId! + Date.now()).substring(0, 8)}`,
      entityId: eventInput.entityId!,
      entityType: eventInput.entityType!,
      eventType: eventInput.eventType!,
      timestamp: new Date().toISOString(),
      actor: eventInput.actor || 'SYSTEM',
      source: eventInput.source || 'ENGINE',
      payloadHash: LifecycleCanonicalizer.sha256(JSON.stringify(eventInput.payload || {})),
      sequence: lastEvent ? lastEvent.sequence + 1 : 1,
      previousEventHash: lastEvent ? lastEvent.eventHash : '0'.repeat(64),
      payload: eventInput.payload || {},
      eventHash: ''
    };

    event.eventHash = LifecycleCanonicalizer.computeEventHash(event);
    this.events.push(event);

    // Update entity hash
    if (entity) {
      entity.lifecycleHash = event.eventHash;
    }

    return event;
  }

  public recordTransition(
    entityId: string,
    toState: LifecycleState,
    trigger: string,
    actor: string,
    reason: string,
    evidenceId: string
  ): LifecycleTransition {
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error('ENTITY_NOT_FOUND');

    const lastTransition = this.transitions.filter(t => t.entityId === entityId).sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    const previousHash = lastTransition ? lastTransition.transitionHash : entity.lifecycleHash;

    const transition = LifecycleStateMachine.createTransition(
      entityId,
      entity.currentState,
      toState,
      trigger,
      actor,
      reason,
      evidenceId,
      previousHash
    );

    this.transitions.push(transition);
    entity.currentState = toState;
    entity.lifecycleHash = transition.transitionHash;

    return transition;
  }

  public addCausalLink(linkInput: Partial<CausalLink>): CausalLink {
    const link: CausalLink = {
      linkId: `LNK-${LifecycleCanonicalizer.sha256(linkInput.sourceEntity!.id + linkInput.targetEntity!.id + Date.now()).substring(0, 8)}`,
      sourceEntity: linkInput.sourceEntity!,
      targetEntity: linkInput.targetEntity!,
      relationshipType: linkInput.relationshipType!,
      reason: linkInput.reason!,
      evidenceId: linkInput.evidenceId!,
      actor: linkInput.actor || 'SYSTEM',
      timestamp: new Date().toISOString(),
      linkHash: ''
    };

    link.linkHash = LifecycleCanonicalizer.computeCausalLinkHash(link);
    this.causalLinks.push(link);
    return link;
  }

  public registerEntity(entity: Omit<LifecycleEntity, 'lifecycleHash'>): LifecycleEntity {
    const newEntity: LifecycleEntity = {
      ...entity,
      lifecycleHash: LifecycleCanonicalizer.sha256(entity.entityId + entity.entityVersion)
    };
    this.entities.set(newEntity.entityId, newEntity);
    return newEntity;
  }

  public traceForward(entityId: string): CausalLink[] {
    return this.causalLinks.filter(l => l.sourceEntity.id === entityId);
  }

  public traceBackward(entityId: string): CausalLink[] {
    return this.causalLinks.filter(l => l.targetEntity.id === entityId);
  }

  public getHistory(entityId: string): LifecycleEvent[] {
    return this.events.filter(e => e.entityId === entityId).sort((a, b) => a.sequence - b.sequence);
  }

  public verifyIntegrity(entityId: string): { verdict: LifecycleVerdict; details: string[] } {
    const history = this.getHistory(entityId);
    const details: string[] = [];

    if (history.length === 0) return { verdict: 'INCOMPLETE', details: ['No history found'] };

    let previousHash = '0'.repeat(64);
    for (let i = 0; i < history.length; i++) {
      const event = history[i];
      
      // Sequence check
      if (event.sequence !== i + 1) {
        return { verdict: 'CORRUPTED', details: [`Sequence mismatch at ${i}: expected ${i+1}, got ${event.sequence}`] };
      }

      // Hash chain check
      if (event.previousEventHash !== previousHash) {
        return { verdict: 'CORRUPTED', details: [`Hash chain broken at sequence ${event.sequence}`] };
      }

      // Self hash check
      const recomputedHash = LifecycleCanonicalizer.computeEventHash(event);
      if (event.eventHash !== recomputedHash) {
        return { verdict: 'CORRUPTED', details: [`Event data tampered at sequence ${event.sequence}`] };
      }

      previousHash = event.eventHash;
    }

    return { verdict: 'VALID', details: ['Full chain integrity verified'] };
  }
}
