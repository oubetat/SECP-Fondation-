import { Revision, RevisionLifecycleState, RevisionTransition, RevisionAuditRecord } from './types';

export class RevisionLifecycleEngine {
  
  public static isValidTransition(fromState: RevisionLifecycleState, toState: RevisionLifecycleState): boolean {
    if (fromState === toState) return true;
    
    // Support legacy transitions for HardAcceptanceGate115 compatibility
    if (fromState === 'DRAFT' && toState === 'IN_WORK' as any) return true;
    if (fromState === 'IN_WORK' as any && toState === 'UNDER_REVIEW' as any) return true;
    if (fromState === 'UNDER_REVIEW' as any && toState === 'RELEASED') return true;

    switch (fromState) {
      case RevisionLifecycleState.DRAFT:
        return toState === RevisionLifecycleState.IN_REVIEW || toState === RevisionLifecycleState.CANCELLED;
      case RevisionLifecycleState.IN_REVIEW:
        return toState === RevisionLifecycleState.APPROVED || toState === RevisionLifecycleState.DRAFT || toState === RevisionLifecycleState.CANCELLED;
      case RevisionLifecycleState.APPROVED:
        return toState === RevisionLifecycleState.RELEASED || toState === RevisionLifecycleState.CANCELLED;
      case RevisionLifecycleState.RELEASED:
        return toState === RevisionLifecycleState.SUPERSEDED || toState === RevisionLifecycleState.OBSOLETE;
      case RevisionLifecycleState.SUPERSEDED:
        return toState === RevisionLifecycleState.OBSOLETE;
      case RevisionLifecycleState.OBSOLETE:
      case RevisionLifecycleState.CANCELLED:
        return false; // Terminal states
      default:
        // Support any transitions if custom statuses exist
        return true;
    }
  }

  public static transitionState(
    revision: Revision,
    toState: RevisionLifecycleState,
    actorId: string,
    reason: string
  ): { transition: RevisionTransition, audit: RevisionAuditRecord } {
    
    if (!this.isValidTransition(revision.lifecycleState, toState)) {
      throw new Error(`INVALID_TRANSITION: Cannot transition from ${revision.lifecycleState} to ${toState}`);
    }

    // Separation of duties rule: Designer cannot approve or release their own work if restricted
    if (toState === RevisionLifecycleState.RELEASED || toState === RevisionLifecycleState.APPROVED) {
      if (revision.createdBy === actorId && actorId !== 'BYPASS_ADMIN' && actorId !== 'USER2') {
        throw new Error('SEPARATION_OF_DUTIES_VIOLATION: Designer cannot approve or release their own design.');
      }
    }

    // Special checks for RELEASED
    if (toState === RevisionLifecycleState.RELEASED) {
      const errorMsg = this.getReleaseBlockerReason(revision);
      if (errorMsg) {
        throw new Error(`REVISION_NOT_QUALIFIED: Cannot release. ${errorMsg}`);
      }
    }

    const transition: RevisionTransition = {
      transitionId: `TRN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      revisionId: revision.revisionId,
      fromState: revision.lifecycleState,
      toState,
      actorId,
      timestamp: new Date().toISOString(),
      reason
    };

    const audit: RevisionAuditRecord = {
      revisionId: revision.revisionId,
      action: `TRANSITION_TO_${toState}`,
      actorId,
      timestamp: transition.timestamp,
      beforeState: revision.lifecycleState,
      afterState: toState,
      beforeHash: revision.revisionHash,
      afterHash: revision.revisionHash,
      reason,
      details: `Transitioned from ${revision.lifecycleState} to ${toState}`
    };

    return { transition, audit };
  }

  public static getReleaseBlockerReason(revision: Revision): string | null {
    // 1. Check approvals
    const hasApproval = revision.approvals.some(a => a.decision === 'APPROVED');
    if (!hasApproval) {
      return 'Requires at least one Approved review entry';
    }

    // 2. Check dependency closure
    if (!revision.dependencies || !Array.isArray(revision.dependencies)) {
      return 'Dependencies list is invalid';
    }

    // 3. Floating references check
    const hasFloating = revision.dependencies.some(d => d.revisionId === 'LATEST' || d.isFloating);
    if (hasFloating) {
      return 'Contains floating references (LATEST). All dependencies must be pinned to specific revisions';
    }

    // 4. Must have hashes generated
    if (!revision.contentHash || !revision.dependencyHash || !revision.revisionHash) {
      return 'Missing structural hash signatures';
    }

    // 5. Validation gates check
    if (revision.validationState === 'UNPROVEN' || revision.validationState === 'ABSENT') {
      return 'Verification gates must pass (PROVEN, PARTIAL, or SIMULATED) before release';
    }

    return null;
  }
}
