/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-263 — Machine Limit Checker
 * 
 * Audits reconstructed machine motions against physical machine travel limits,
 * rotary stroke envelopes, maximum rapid/cutting feed rates, and envelope boundaries.
 */

import { MachineDefinition, AxisName } from '../post-processor/PostTypes';
import { MachineMotionSequence, VerificationIssue, VerificationTolerances, DEFAULT_VERIFICATION_TOLERANCES } from './GCodeVerificationTypes';

export class MachineLimitChecker {
  /**
   * Verify all reconstructed machine motion steps against the machine definition
   */
  public static verifyMachineLimits(
    motion: MachineMotionSequence,
    machine: MachineDefinition,
    tolerances: VerificationTolerances = DEFAULT_VERIFICATION_TOLERANCES
  ): VerificationIssue[] {
    const issues: VerificationIssue[] = [];
    let issueCounter = 1;

    const axes = machine.axes;
    if (!axes) {
      issues.push({
        id: `ISSUE-MACHINE-${issueCounter++}`,
        code: 'CONTEXT_INSUFFICIENT',
        severity: 'CRITICAL',
        lineIndex: 0,
        message: `Machine definition '${machine.name}' has no axis definitions.`
      });
      return issues;
    }

    // Check motion steps
    for (const step of motion.steps) {
      const pos = step.endPoint;

      // 1. Linear Axis Limits (X, Y, Z)
      const linearAxes: Array<{ name: AxisName; val: number }> = [
        { name: 'X', val: pos.x },
        { name: 'Y', val: pos.y },
        { name: 'Z', val: pos.z }
      ];

      for (const { name, val } of linearAxes) {
        const axisDef = axes[name];
        if (axisDef) {
          if (val < axisDef.minLimit - tolerances.linearToleranceMm) {
            issues.push({
              id: `ISSUE-LIMIT-${issueCounter++}`,
              code: 'AXIS_LIMIT_VIOLATION',
              severity: 'CRITICAL',
              lineIndex: step.lineIndex,
              sequenceNumber: step.sequenceNumber,
              rawGCode: step.rawText,
              axis: name,
              actualValue: `${val.toFixed(3)} mm`,
              expectedValue: `>= ${axisDef.minLimit.toFixed(3)} mm`,
              message: `Negative limit overtravel on axis ${name}: requested ${val.toFixed(3)}mm exceeds machine minimum limit of ${axisDef.minLimit.toFixed(3)}mm.`,
              recommendation: `Translate WCS or modify CAM clearance planes to keep tool within ${axisDef.minLimit}mm..${axisDef.maxLimit}mm.`
            });
          } else if (val > axisDef.maxLimit + tolerances.linearToleranceMm) {
            issues.push({
              id: `ISSUE-LIMIT-${issueCounter++}`,
              code: 'AXIS_LIMIT_VIOLATION',
              severity: 'CRITICAL',
              lineIndex: step.lineIndex,
              sequenceNumber: step.sequenceNumber,
              rawGCode: step.rawText,
              axis: name,
              actualValue: `${val.toFixed(3)} mm`,
              expectedValue: `<= ${axisDef.maxLimit.toFixed(3)} mm`,
              message: `Positive limit overtravel on axis ${name}: requested ${val.toFixed(3)}mm exceeds machine maximum limit of ${axisDef.maxLimit.toFixed(3)}mm.`,
              recommendation: `Translate WCS or modify CAM clearance planes to keep tool within ${axisDef.minLimit}mm..${axisDef.maxLimit}mm.`
            });
          }
        }
      }

      // 2. Rotary Axis Limits (A, B, C)
      const rotaryAxes: Array<{ name: AxisName; val: number }> = [
        { name: 'A', val: pos.a },
        { name: 'B', val: pos.b },
        { name: 'C', val: pos.c }
      ];

      for (const { name, val } of rotaryAxes) {
        const axisDef = axes[name];
        if (axisDef && !axisDef.rotaryContinuous && (axisDef.minLimit !== 0 || axisDef.maxLimit !== 0)) {
          if (val < axisDef.minLimit - tolerances.rotaryToleranceDeg || val > axisDef.maxLimit + tolerances.rotaryToleranceDeg) {
            issues.push({
              id: `ISSUE-ROTARY-${issueCounter++}`,
              code: 'ROTARY_LIMIT_VIOLATION',
              severity: 'CRITICAL',
              lineIndex: step.lineIndex,
              sequenceNumber: step.sequenceNumber,
              rawGCode: step.rawText,
              axis: name,
              actualValue: `${val.toFixed(3)}°`,
              expectedValue: `${axisDef.minLimit.toFixed(1)}° .. ${axisDef.maxLimit.toFixed(1)}°`,
              message: `Rotary stroke overtravel on axis ${name}: requested ${val.toFixed(3)}° is outside physical envelope [${axisDef.minLimit}°, ${axisDef.maxLimit}°].`,
              recommendation: `Unwind rotary axis or optimize 5-axis tool inclination angles.`
            });
          }
        }
      }

      // 3. Feed Rate Limits
      if (step.isCutting && step.feedRate > 0) {
        const maxMachineFeed = Math.max(
          axes['X']?.maxFeedRate || 10000,
          axes['Y']?.maxFeedRate || 10000,
          axes['Z']?.maxFeedRate || 10000
        );

        if (step.feedRate > maxMachineFeed + tolerances.feedToleranceMmMin) {
          issues.push({
            id: `ISSUE-FEED-${issueCounter++}`,
            code: 'FEED_LIMIT_VIOLATION',
            severity: 'CRITICAL',
            lineIndex: step.lineIndex,
            sequenceNumber: step.sequenceNumber,
            rawGCode: step.rawText,
            actualValue: `${step.feedRate.toFixed(1)} mm/min`,
            expectedValue: `<= ${maxMachineFeed} mm/min`,
            message: `Requested cutting feed rate (${step.feedRate.toFixed(1)} mm/min) exceeds maximum allowable machine axis feed (${maxMachineFeed} mm/min).`,
            recommendation: `Reduce cutting feed in CAM operation parameters.`
          });
        }
      }
    }

    return issues;
  }
}
