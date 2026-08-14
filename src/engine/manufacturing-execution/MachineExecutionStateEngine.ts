/**
 * PATCH-SECP-060 — Machine Execution State Engine
 * Enforces discrete state machine steps for physical machines, validating transitions
 * like OFFLINE -> AVAILABLE -> SETUP -> READY -> RUNNING -> PAUSED -> FAULT -> RECOVERY -> RUNNING.
 */

import { MachineExecutionState } from './ManufacturingExecutionTypes';

export class MachineExecutionStateEngine {
  /**
   * 060-B & 060-H: Validates machine status transitions.
   * Handles faults, pauses, maintenance, and recover-to-resume flows.
   */
  public static validateStateTransition(
    current: MachineExecutionState,
    target: MachineExecutionState
  ): { valid: boolean; error?: string } {
    const allowed: Record<MachineExecutionState, MachineExecutionState[]> = {
      OFFLINE: ['AVAILABLE', 'MAINTENANCE'],
      AVAILABLE: ['SETUP', 'MAINTENANCE', 'OFFLINE'],
      SETUP: ['READY', 'AVAILABLE', 'FAULT', 'OFFLINE'],
      READY: ['RUNNING', 'SETUP', 'FAULT', 'OFFLINE'],
      RUNNING: ['PAUSED', 'FAULT', 'COMPLETED', 'OFFLINE'],
      PAUSED: ['RUNNING', 'READY', 'FAULT', 'OFFLINE'],
      FAULT: ['SETUP', 'AVAILABLE', 'MAINTENANCE', 'OFFLINE', 'RUNNING'], // Run diagnostic/recovery then transition
      MAINTENANCE: ['AVAILABLE', 'OFFLINE'],
      COMPLETED: ['AVAILABLE', 'SETUP', 'OFFLINE']
    };

    const targets = allowed[current] || [];
    if (targets.includes(target)) {
      return { valid: true };
    }

    return {
      valid: false,
      error: `Invalid CNC machine status transition from '${current}' to '${target}'. Allowed: [${targets.join(', ')}]`
    };
  }

  /**
   * Helper to perform safe state transition
   */
  public static transitionState(
    current: MachineExecutionState,
    target: MachineExecutionState
  ): MachineExecutionState {
    const check = this.validateStateTransition(current, target);
    if (!check.valid) {
      throw new Error(check.error);
    }
    return target;
  }
}
