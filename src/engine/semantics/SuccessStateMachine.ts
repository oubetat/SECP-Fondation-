/**
 * SECP Industrial OS v3 — PROMPT-052: Success State Machine
 * Deterministic transition engine enforcing the strict engineering success state lifecycle:
 * REQUESTED -> EXECUTING -> EXECUTED -> CANONICAL_MUTATED -> VALIDATING -> VALID -> VERIFIED -> SUCCESS
 */

import { SuccessStateEnum } from './SuccessSemanticsTypes';

export interface StateTransitionEvent {
  fromState: SuccessStateEnum;
  toState: SuccessStateEnum;
  reason: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export class SuccessStateMachine {
  private currentState: SuccessStateEnum;
  private readonly history: StateTransitionEvent[] = [];

  constructor(initialState: SuccessStateEnum = SuccessStateEnum.REQUESTED) {
    this.currentState = initialState;
    this.history.push({
      fromState: initialState,
      toState: initialState,
      reason: 'State machine initialized',
      timestamp: new Date().toISOString()
    });
  }

  public getState(): SuccessStateEnum {
    return this.currentState;
  }

  public getHistory(): readonly StateTransitionEvent[] {
    return [...this.history];
  }

  /**
   * Attempts to transition to the next state according to the formal engineering transition table.
   * Shortcut transitions directly to SUCCESS from unverified states are rejected.
   */
  public transition(targetState: SuccessStateEnum, reason: string, metadata?: Record<string, unknown>): boolean {
    const from = this.currentState;
    const allowed = this.isTransitionAllowed(from, targetState);

    if (!allowed) {
      throw new Error(
        `Illegal state machine transition: Cannot transition from [${from}] to [${targetState}]. Reason: ${reason}`
      );
    }

    this.currentState = targetState;
    this.history.push({
      fromState: from,
      toState: targetState,
      reason,
      timestamp: new Date().toISOString(),
      metadata
    });

    return true;
  }

  private isTransitionAllowed(from: SuccessStateEnum, to: SuccessStateEnum): boolean {
    // Terminal states cannot transition further
    if (this.isTerminalState(from)) {
      return false;
    }

    switch (from) {
      case SuccessStateEnum.REQUESTED:
        return (
          to === SuccessStateEnum.EXECUTING ||
          to === SuccessStateEnum.CANCELLED ||
          to === SuccessStateEnum.UNSUPPORTED
        );

      case SuccessStateEnum.EXECUTING:
        return (
          to === SuccessStateEnum.EXECUTED ||
          to === SuccessStateEnum.FAILED ||
          to === SuccessStateEnum.CANCELLED ||
          to === SuccessStateEnum.UNSUPPORTED
        );

      case SuccessStateEnum.EXECUTED:
        return (
          to === SuccessStateEnum.CANONICAL_MUTATED ||
          to === SuccessStateEnum.MUTATION_ABSENT ||
          to === SuccessStateEnum.STALE ||
          to === SuccessStateEnum.FAILED ||
          to === SuccessStateEnum.CONFLICT
        );

      case SuccessStateEnum.CANONICAL_MUTATED:
        return (
          to === SuccessStateEnum.VALIDATING ||
          to === SuccessStateEnum.STALE ||
          to === SuccessStateEnum.DIVERGED ||
          to === SuccessStateEnum.FAILED
        );

      case SuccessStateEnum.VALIDATING:
        return (
          to === SuccessStateEnum.VALID ||
          to === SuccessStateEnum.VALIDATION_FAILED ||
          to === SuccessStateEnum.INVALID ||
          to === SuccessStateEnum.FAILED
        );

      case SuccessStateEnum.VALID:
        // After validation, if independent verification or persistence is required, move to VERIFIED or SUCCESS
        return (
          to === SuccessStateEnum.VERIFIED ||
          to === SuccessStateEnum.SUCCESS ||
          to === SuccessStateEnum.PERSISTENCE_FAILED ||
          to === SuccessStateEnum.REGENERATION_FAILED ||
          to === SuccessStateEnum.FAILED
        );

      case SuccessStateEnum.VERIFIED:
        return (
          to === SuccessStateEnum.SUCCESS ||
          to === SuccessStateEnum.PERSISTENCE_FAILED ||
          to === SuccessStateEnum.REGENERATION_FAILED ||
          to === SuccessStateEnum.FAILED
        );

      default:
        return false;
    }
  }

  private isTerminalState(state: SuccessStateEnum): boolean {
    return (
      state === SuccessStateEnum.SUCCESS ||
      state === SuccessStateEnum.FAILED ||
      state === SuccessStateEnum.INVALID ||
      state === SuccessStateEnum.UNSUPPORTED ||
      state === SuccessStateEnum.CANCELLED ||
      state === SuccessStateEnum.CONFLICT ||
      state === SuccessStateEnum.STALE ||
      state === SuccessStateEnum.DIVERGED ||
      state === SuccessStateEnum.MUTATION_ABSENT ||
      state === SuccessStateEnum.VALIDATION_FAILED ||
      state === SuccessStateEnum.REGENERATION_FAILED ||
      state === SuccessStateEnum.PERSISTENCE_FAILED
    );
  }
}
