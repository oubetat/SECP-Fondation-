/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-263 — Kinematic Back-Verifier
 * 
 * Inverts NC Machine Axis Coordinates (X, Y, Z, A, B, C) back into 5-Axis Machine Poses,
 * computes tool orientation unit vectors, and compares them against theoretical
 * kinematic solutions from PATCH-258 within strict mathematical tolerances.
 */

import { Vector3D } from '../../cadKernel';
import { FiveAxisMachinePose } from '../fiveaxis/FiveAxisTypes';
import { MachineDefinition } from '../post-processor/PostTypes';
import { MachineMotionSequence, KinematicDeviationReport, KinematicDeviationPoint, VerificationIssue, VerificationTolerances, DEFAULT_VERIFICATION_TOLERANCES } from './GCodeVerificationTypes';

export class BackKinematicVerifier {
  /**
   * Reconstruct machine poses from motion sequence and compare against reference kinematic solution
   */
  public static verifyKinematics(
    motion: MachineMotionSequence,
    machine: MachineDefinition,
    referencePoses?: FiveAxisMachinePose[],
    tolerances: VerificationTolerances = DEFAULT_VERIFICATION_TOLERANCES
  ): { report: KinematicDeviationReport; issues: VerificationIssue[] } {
    const issues: VerificationIssue[] = [];
    let issueCounter = 1;

    const isMultiaxis = machine.machineType === 'MILL_4AXIS' || machine.machineType === 'MILL_5AXIS';
    const deviations: KinematicDeviationPoint[] = [];

    let maxPosErr = 0;
    let sumPosErr = 0;
    let maxAngErr = 0;
    let sumAngErr = 0;
    let maxRotErr = 0;

    const motionStepsWithMovement = motion.steps.filter(s => s.isCutting || s.rotaryDistanceDeg > 0);

    for (let i = 0; i < motionStepsWithMovement.length; i++) {
      const step = motionStepsWithMovement[i];
      const pos = step.endPoint;

      // Calculate tool orientation vector from rotary angles (A / B / C)
      const radA = (pos.a * Math.PI) / 180;
      const radB = (pos.b * Math.PI) / 180;
      const radC = (pos.c * Math.PI) / 180;

      let toolVector: Vector3D = { x: 0, y: 0, z: 1 };
      if (machine.machineType === 'MILL_5AXIS' || machine.machineType === 'MILL_4AXIS') {
        if (Math.abs(pos.a) > 1e-4 || Math.abs(pos.c) > 1e-4) {
          // Table-Table AC or Head-Table Kinematic Forward Transformation
          toolVector = {
            x: Math.sin(radA) * Math.sin(radC),
            y: -Math.sin(radA) * Math.cos(radC),
            z: Math.cos(radA)
          };
          // Normalize
          const len = Math.sqrt(toolVector.x * toolVector.x + toolVector.y * toolVector.y + toolVector.z * toolVector.z);
          if (len > 1e-6) {
            toolVector.x /= len;
            toolVector.y /= len;
            toolVector.z /= len;
          }
        }
      }

      const reconstructedPose: FiveAxisMachinePose = {
        machineCoordinates: { x: pos.x, y: pos.y, z: pos.z, a: pos.a, b: pos.b, c: pos.c },
        toolVector,
        contactPoint: { x: pos.x, y: pos.y, z: pos.z },
        feedRateMmMin: step.feedRate,
        isSingular: Math.abs(pos.a) < 0.05,
        singularityDistance: Math.abs(pos.a)
      };

      step.endPose = reconstructedPose;
      step.toolVector = toolVector;

      // If reference kinematic poses are provided, compare 1-to-1 or closest index
      let posErr = 0;
      let angErr = 0;
      let rotAErr = 0;
      let rotCErr = 0;

      if (referencePoses && referencePoses.length > 0) {
        const refIndex = Math.min(i, referencePoses.length - 1);
        const refPose = referencePoses[refIndex];

        // 1. Position error (mm)
        const dx = reconstructedPose.contactPoint.x - refPose.contactPoint.x;
        const dy = reconstructedPose.contactPoint.y - refPose.contactPoint.y;
        const dz = reconstructedPose.contactPoint.z - refPose.contactPoint.z;
        posErr = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // 2. Angular orientation error (degrees)
        const dot = Math.max(-1, Math.min(1,
          reconstructedPose.toolVector.x * refPose.toolVector.x +
          reconstructedPose.toolVector.y * refPose.toolVector.y +
          reconstructedPose.toolVector.z * refPose.toolVector.z
        ));
        angErr = (Math.acos(dot) * 180) / Math.PI;

        // 3. Rotary angles error
        rotAErr = Math.abs(reconstructedPose.machineCoordinates.a - refPose.machineCoordinates.a);
        rotCErr = Math.abs(reconstructedPose.machineCoordinates.c - refPose.machineCoordinates.c);

        maxPosErr = Math.max(maxPosErr, posErr);
        sumPosErr += posErr;
        maxAngErr = Math.max(maxAngErr, angErr);
        sumAngErr += angErr;
        maxRotErr = Math.max(maxRotErr, Math.max(rotAErr, rotCErr));

        deviations.push({
          stepIndex: step.stepIndex,
          lineIndex: step.lineIndex,
          reconstructedPose,
          referencePose: refPose,
          positionErrorMm: posErr,
          angularErrorDeg: angErr,
          rotaryAErrorDeg: rotAErr,
          rotaryCErrorDeg: rotCErr
        });

        // Flag Issue if tolerance exceeded
        if (angErr > tolerances.angularToleranceDeg) {
          issues.push({
            id: `ISSUE-KIN-${issueCounter++}`,
            code: 'KINEMATIC_DEVIATION_EXCEEDED',
            severity: 'CRITICAL',
            lineIndex: step.lineIndex,
            sequenceNumber: step.sequenceNumber,
            rawGCode: step.rawText,
            actualValue: `${angErr.toFixed(3)}°`,
            expectedValue: `<= ${tolerances.angularToleranceDeg.toFixed(3)}°`,
            message: `Tool vector angular deviation (${angErr.toFixed(3)}°) exceeds maximum tolerance of ${tolerances.angularToleranceDeg}° at step #${step.stepIndex}.`,
            recommendation: `Verify post-processor kinematics matrix and TCPC/TRAORI orientation calculations.`
          });
        }
      }
    }

    const comparedCount = deviations.length;
    const report: KinematicDeviationReport = {
      isMultiaxis,
      comparedPosesCount: comparedCount,
      maxPositionErrorMm: maxPosErr,
      meanPositionErrorMm: comparedCount > 0 ? sumPosErr / comparedCount : 0,
      maxAngularErrorDeg: maxAngErr,
      meanAngularErrorDeg: comparedCount > 0 ? sumAngErr / comparedCount : 0,
      maxRotaryErrorDeg: maxRotErr,
      isWithinTolerance: maxAngErr <= tolerances.angularToleranceDeg && maxPosErr <= tolerances.linearToleranceMm,
      deviations
    };

    return { report, issues };
  }
}
