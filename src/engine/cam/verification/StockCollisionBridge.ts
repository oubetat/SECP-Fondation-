/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-263 — Stock & Collision Verification Bridge
 * 
 * Bridges G-Code Motion Sequences into Collision Detection (PATCH-259)
 * and Material Removal Simulation (PATCH-260) engines.
 */

import { MachineMotionSequence, VerificationIssue } from './GCodeVerificationTypes';
import { ToolSnapshot } from '../tool-library/ToolTypes';

export class StockCollisionBridge {
  /**
   * Run preliminary clearance and collision sanity check on reconstructed motion sequence
   */
  public static auditMotionsForCollisions(
    motion: MachineMotionSequence,
    toolSnapshots: ToolSnapshot[]
  ): VerificationIssue[] {
    const issues: VerificationIssue[] = [];
    let issueCounter = 1;

    // Check for rapid plunges below Z=0 without prior clearance
    let prevZ = 100;
    for (const step of motion.steps) {
      if (step.isRapid) {
        if (step.endPoint.z < -0.1 && prevZ > 0) {
          issues.push({
            id: `ISSUE-COLLISION-${issueCounter++}`,
            code: 'MISSING_RETRACT_BEFORE_RAPID',
            severity: 'CRITICAL',
            lineIndex: step.lineIndex,
            sequenceNumber: step.sequenceNumber,
            rawGCode: step.rawText,
            actualValue: `Z${step.endPoint.z.toFixed(3)}`,
            expectedValue: `Z > 0 for G00`,
            message: `Direct rapid downward traverse (G00) into workpiece volume at Z=${step.endPoint.z.toFixed(3)}mm without feed approach. Catastrophic collision risk!`,
            recommendation: `Use G00 to clearance height (Z >= 5mm) then switch to G01 feed plunge.`
          });
        }
      }
      prevZ = step.endPoint.z;
    }

    return issues;
  }
}
