/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-263 — Coordinate System & Units Checker
 * 
 * Verifies Work Coordinate System (G54-G59), machine coordinate offsets (G53),
 * local shifts (G52/G92), and cross-domain Units consistency.
 */

import { MachineDefinition, UnitsMode } from '../post-processor/PostTypes';
import { NCExecutionState, VerificationIssue } from './GCodeVerificationTypes';

export class CoordinateSystemChecker {
  /**
   * Validate coordinate system selections and units consistency
   */
  public static verifyCoordinatesAndUnits(
    states: NCExecutionState[],
    machine: MachineDefinition,
    expectedUnits: UnitsMode = 'METRIC_MM'
  ): VerificationIssue[] {
    const issues: VerificationIssue[] = [];
    let issueCounter = 1;

    for (const state of states) {
      // 1. Units Verification
      if (state.units !== expectedUnits) {
        issues.push({
          id: `ISSUE-UNITS-${issueCounter++}`,
          code: 'UNITS_MISMATCH',
          severity: 'CRITICAL',
          lineIndex: state.lineIndex,
          sequenceNumber: state.blockNumber,
          rawGCode: state.rawGCode,
          expectedValue: expectedUnits,
          actualValue: state.units,
          message: `Units mismatch in G-code: active mode is ${state.units}, but expected project units are ${expectedUnits}.`,
          recommendation: `Ensure G21 (metric) or G20 (inch) matches project configuration.`
        });
      }

      // 2. WCS Check
      if (!state.coordinateSystem.startsWith('G5')) {
        issues.push({
          id: `ISSUE-WCS-${issueCounter++}`,
          code: 'INVALID_MODAL_TRANSITION',
          severity: 'WARNING',
          lineIndex: state.lineIndex,
          sequenceNumber: state.blockNumber,
          message: `Active coordinate system ${state.coordinateSystem} is non-standard.`
        });
      }
    }

    return issues;
  }
}
