/**
 * PATCH-SECP-060 — Operation Execution Engine
 * Manages states for individual routing operations (e.g., OP10, OP20)
 * ensuring strict execution steps and preventing illegal transitions.
 */

import { OperationExecutionState } from './ManufacturingExecutionTypes';

export class OperationExecutionEngine {
  /**
   * 060-C: Validates and transitions operation states.
   * COMPLETED -> RUNNING is blocked unless labeled as authorized rework.
   */
  public static validateTransition(
    current: OperationExecutionState,
    target: OperationExecutionState,
    isReworkAuthorized: boolean = false
  ): { valid: boolean; error?: string } {
    const allowed: Record<OperationExecutionState, OperationExecutionState[]> = {
      NOT_STARTED: ['STARTED'],
      STARTED: ['RUNNING', 'FAILED'],
      RUNNING: ['PAUSED', 'COMPLETED', 'FAILED'],
      PAUSED: ['RUNNING', 'FAILED'],
      COMPLETED: ['REWORKED'], // Cannot re-run completed operations without explicit rework
      FAILED: ['REWORKED', 'STARTED'],
      REWORKED: ['STARTED', 'RUNNING']
    };

    if (current === 'COMPLETED' && target === 'RUNNING' && !isReworkAuthorized) {
      return {
        valid: false,
        error: `Illegal operation transition: 'COMPLETED' to 'RUNNING' is blocked without explicit operator authorization for rework.`
      };
    }

    const targets = allowed[current] || [];
    if (targets.includes(target) || (isReworkAuthorized && target === 'REWORKED')) {
      return { valid: true };
    }

    return {
      valid: false,
      error: `Invalid operation execution transition from '${current}' to '${target}'. Allowed: [${targets.join(', ')}]`
    };
  }
}
