import { LifecycleState, LifecycleTransition, LifecycleVerdict } from './types';
import { LifecycleCanonicalizer } from './LifecycleCanonicalizer';

export class LifecycleStateMachine {
  private static validTransitions: Map<LifecycleState, LifecycleState[]> = new Map([
    ['CONCEPT', ['DESIGN', 'ARCHIVED']],
    ['DESIGN', ['ENGINEERING', 'ARCHIVED']],
    ['ENGINEERING', ['VERIFICATION', 'ARCHIVED']],
    ['VERIFICATION', ['VALIDATION', 'ENGINEERING', 'ARCHIVED']],
    ['VALIDATION', ['RELEASED', 'VERIFICATION', 'ARCHIVED']],
    ['RELEASED', ['MANUFACTURING', 'SUPERSEDED', 'RETIRED', 'ARCHIVED']],
    ['MANUFACTURING', ['IN_SERVICE', 'SUSPENDED', 'ARCHIVED']],
    ['IN_SERVICE', ['MAINTENANCE', 'SUSPENDED', 'RETIRED', 'ARCHIVED']],
    ['MAINTENANCE', ['IN_SERVICE', 'SUSPENDED', 'ARCHIVED']],
    ['SUSPENDED', ['MANUFACTURING', 'IN_SERVICE', 'MAINTENANCE', 'RETIRED', 'ARCHIVED']],
    ['SUPERSEDED', ['ARCHIVED']],
    ['RETIRED', ['ARCHIVED']],
    ['ARCHIVED', []]
  ]);

  public static validateTransition(from: LifecycleState, to: LifecycleState): boolean {
    const allowed = this.validTransitions.get(from) || [];
    return allowed.includes(to);
  }

  public static createTransition(
    entityId: string,
    from: LifecycleState,
    to: LifecycleState,
    trigger: string,
    actor: string,
    reason: string,
    evidenceId: string,
    previousHash: string
  ): LifecycleTransition {
    if (!this.validateTransition(from, to)) {
      throw new Error(`INVALID_LIFECYCLE_TRANSITION: Cannot move from ${from} to ${to}`);
    }

    const transition: Partial<LifecycleTransition> = {
      transitionId: `TRANS-${LifecycleCanonicalizer.sha256(entityId + from + to + Date.now()).substring(0, 8)}`,
      entityId,
      fromState: from,
      toState: to,
      trigger,
      actor,
      timestamp: new Date().toISOString(),
      reason,
      evidenceId,
      previousHash
    };

    transition.transitionHash = LifecycleCanonicalizer.computeTransitionHash(transition);
    return transition as LifecycleTransition;
  }
}
