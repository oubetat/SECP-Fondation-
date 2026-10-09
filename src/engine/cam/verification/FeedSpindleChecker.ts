/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-263 — Feed & Spindle Dynamic Checker
 * 
 * Audits spindle speed limits, spindle direction, cutting with spindle stopped,
 * coolant activation boundaries, and safety sequence transitions.
 */

import { MachineDefinition } from '../post-processor/PostTypes';
import { NCExecutionState, VerificationIssue } from './GCodeVerificationTypes';

export class FeedSpindleChecker {
  /**
   * Audit spindle, feed, and coolant states across all execution steps
   */
  public static verifyFeedAndSpindle(
    states: NCExecutionState[],
    machine: MachineDefinition
  ): VerificationIssue[] {
    const issues: VerificationIssue[] = [];
    let issueCounter = 1;

    const spindleLimits = machine.spindle || {
      minRpm: 100,
      maxRpm: 15000,
      directionSupport: ['CW', 'CCW']
    };

    let hasStartedSpindle = false;
    let hasEngagedCutting = false;

    for (const state of states) {
      // 1. Spindle RPM Limit Check
      if (state.spindleRpm > 0) {
        if (state.spindleRpm > spindleLimits.maxRpm) {
          issues.push({
            id: `ISSUE-SPINDLE-${issueCounter++}`,
            code: 'SPINDLE_LIMIT_VIOLATION',
            severity: 'CRITICAL',
            lineIndex: state.lineIndex,
            sequenceNumber: state.blockNumber,
            rawGCode: state.rawGCode,
            actualValue: `S${state.spindleRpm} RPM`,
            expectedValue: `<= ${spindleLimits.maxRpm} RPM`,
            message: `Commanded spindle speed S${state.spindleRpm} RPM exceeds machine physical spindle maximum limit (${spindleLimits.maxRpm} RPM).`,
            recommendation: `Cap spindle RPM in CAM tool library and cutting data.`
          });
        } else if (state.spindleRpm < spindleLimits.minRpm && state.spindleState !== 'M5_OFF') {
          issues.push({
            id: `ISSUE-SPINDLE-${issueCounter++}`,
            code: 'SPINDLE_LIMIT_VIOLATION',
            severity: 'WARNING',
            lineIndex: state.lineIndex,
            sequenceNumber: state.blockNumber,
            rawGCode: state.rawGCode,
            actualValue: `S${state.spindleRpm} RPM`,
            expectedValue: `>= ${spindleLimits.minRpm} RPM`,
            message: `Commanded spindle speed S${state.spindleRpm} RPM is below machine recommended minimum operating speed (${spindleLimits.minRpm} RPM).`
          });
        }
      }

      if (state.spindleState === 'M3_CW' || state.spindleState === 'M4_CCW') {
        hasStartedSpindle = true;
      }

      // 2. Cutting Motion with Spindle Stopped (Dangerous Condition)
      if (state.isCutting) {
        hasEngagedCutting = true;
        if (state.spindleState === 'M5_OFF' || state.spindleRpm <= 0) {
          issues.push({
            id: `ISSUE-SPINDLE-${issueCounter++}`,
            code: 'CUTTING_WITH_SPINDLE_STOPPED',
            severity: 'CRITICAL',
            lineIndex: state.lineIndex,
            sequenceNumber: state.blockNumber,
            rawGCode: state.rawGCode,
            message: `Linear cutting motion (G01/G02/G03) executed while spindle is stopped (M05 or S0). Tool breakage imminent!`,
            recommendation: `Issue M03 S<RPM> before commanding cutting feed moves.`
          });
        }
      }

      // 3. Spindle Direction Support Check
      if (state.spindleState === 'M4_CCW' && !spindleLimits.directionSupport.includes('CCW')) {
        issues.push({
          id: `ISSUE-SPINDLE-${issueCounter++}`,
          code: 'SPINDLE_LIMIT_VIOLATION',
          severity: 'ERROR',
          lineIndex: state.lineIndex,
          sequenceNumber: state.blockNumber,
          rawGCode: state.rawGCode,
          message: `Counter-clockwise spindle rotation (M04) is not supported on machine '${machine.name}'.`
        });
      }
    }

    // 4. Safe Program Termination Checks
    if (states.length > 0 && hasEngagedCutting) {
      const lastState = states[states.length - 1];
      if (lastState.spindleState !== 'M5_OFF') {
        issues.push({
          id: `ISSUE-SAFETY-${issueCounter++}`,
          code: 'INVALID_SAFETY_SEQUENCE',
          severity: 'WARNING',
          lineIndex: lastState.lineIndex,
          message: 'Program reaches end without explicit spindle stop (M05).'
        });
      }
      if (lastState.coolantState !== 'M9_OFF') {
        issues.push({
          id: `ISSUE-SAFETY-${issueCounter++}`,
          code: 'INVALID_SAFETY_SEQUENCE',
          severity: 'WARNING',
          lineIndex: lastState.lineIndex,
          message: 'Program reaches end without explicit coolant off (M09).'
        });
      }
    }

    return issues;
  }
}
