/**
 * SECP CAD Kernel — Feature State Machine
 * Phase 2 (PATCH-022)
 *
 * ARCHITECTURAL CONTRACT:
 * - Explicit, deterministic feature lifecycle states.
 * - Illegal state transitions are strictly forbidden (e.g. INVALID -> VALID without verification,
 *   FAILED -> VALID without execution, STALE -> VALID without regeneration).
 */

export type FeatureState =
  | 'DEFINED'
  | 'READY'
  | 'REGENERATING'
  | 'VALID'
  | 'INVALID'
  | 'STALE'
  | 'SUPPRESSED'
  | 'FAILED'
  | 'UNPROVEN';

export type RegenerationStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'SKIPPED'
  | 'UNPROVEN'
  | 'EXECUTING'
  | 'UP_TO_DATE'
  | string;

export type TransitionReason =
  | 'CREATION'
  | 'PARAMETER_MUTATION'
  | 'DEPENDENCY_INVALIDATED'
  | 'VALIDATION_PASSED'
  | 'VALIDATION_FAILED'
  | 'EXECUTION_STARTED'
  | 'EXECUTION_SUCCEEDED'
  | 'EXECUTION_FAILED'
  | 'SUPPRESSION_ENABLED'
  | 'SUPPRESSION_DISABLED'
  | 'ROLLBACK';

export interface StateTransitionResult {
  allowed: boolean;
  from: FeatureState;
  to: FeatureState;
  reason: TransitionReason;
  errorMessage?: string;
}

export class FeatureStateMachine {
  /**
   * Validates if a state transition is legal under the SECP CAD Truth Contract.
   */
  public static canTransition(
    from: FeatureState,
    to: FeatureState,
    reason: TransitionReason
  ): StateTransitionResult {
    // Identity transitions (same state) are allowed
    if (from === to) {
      return { allowed: true, from, to, reason };
    }

    // Direct transition to SUPPRESSED is allowed from any non-REGENERATING state with SUPPRESSION_ENABLED
    if (to === 'SUPPRESSED') {
      if (from === 'REGENERATING') {
        return {
          allowed: false,
          from,
          to,
          reason,
          errorMessage: 'Cannot suppress a feature that is actively regenerating'
        };
      }
      return { allowed: true, from, to, reason };
    }

    // Direct transition from SUPPRESSED when unsuppressed
    if (from === 'SUPPRESSED') {
      if (to === 'STALE' || to === 'READY' || to === 'DEFINED') {
        return { allowed: true, from, to, reason };
      }
      return {
        allowed: false,
        from,
        to,
        reason,
        errorMessage: 'Unsuppressing a feature must place it in STALE or READY state before execution'
      };
    }

    // FORBIDDEN: Direct transition from INVALID to VALID without regeneration
    if (from === 'INVALID' && to === 'VALID') {
      return {
        allowed: false,
        from,
        to,
        reason,
        errorMessage: 'Illegal transition: INVALID features cannot transition directly to VALID without successful execution'
      };
    }

    // FORBIDDEN: Direct transition from FAILED to VALID without execution
    if (from === 'FAILED' && to === 'VALID') {
      return {
        allowed: false,
        from,
        to,
        reason,
        errorMessage: 'Illegal transition: FAILED features cannot transition directly to VALID without successful execution'
      };
    }

    // FORBIDDEN: Direct transition from STALE to VALID without regeneration
    if (from === 'STALE' && to === 'VALID' && reason !== 'EXECUTION_SUCCEEDED') {
      return {
        allowed: false,
        from,
        to,
        reason,
        errorMessage: 'Illegal transition: STALE features require regeneration before becoming VALID'
      };
    }

    // Standard state machine transition rules
    switch (from) {
      case 'DEFINED':
        if (to === 'READY' || to === 'REGENERATING' || to === 'INVALID' || to === 'STALE') {
          return { allowed: true, from, to, reason };
        }
        break;

      case 'READY':
        if (to === 'REGENERATING' || to === 'STALE' || to === 'INVALID') {
          return { allowed: true, from, to, reason };
        }
        break;

      case 'REGENERATING':
        if (to === 'VALID' || to === 'FAILED' || to === 'INVALID' || to === 'UNPROVEN') {
          return { allowed: true, from, to, reason };
        }
        break;

      case 'VALID':
        if (to === 'STALE' || to === 'INVALID' || to === 'REGENERATING') {
          return { allowed: true, from, to, reason };
        }
        break;

      case 'STALE':
        if (to === 'READY' || to === 'REGENERATING' || to === 'INVALID' || to === 'FAILED') {
          return { allowed: true, from, to, reason };
        }
        break;

      case 'INVALID':
      case 'FAILED':
        if (to === 'DEFINED' || to === 'READY' || to === 'STALE' || to === 'REGENERATING') {
          return { allowed: true, from, to, reason };
        }
        break;

      case 'UNPROVEN':
        if (to === 'VALID' || to === 'STALE' || to === 'FAILED' || to === 'REGENERATING') {
          return { allowed: true, from, to, reason };
        }
        break;
    }

    return {
      allowed: false,
      from,
      to,
      reason,
      errorMessage: `Unsupported state transition from ${from} to ${to} under reason ${reason}`
    };
  }
}
