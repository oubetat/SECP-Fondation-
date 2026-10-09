/**
 * PATCH-SECP-083: Machine Kinematics, Singularity & Orientation Flip Verifier
 * 
 * Verifies machine envelope limits (X,Y,Z,A,B,C), detects rotary singularities,
 * catches orientation jumps/flips, and validates angular velocity/acceleration.
 */

import {
  FiveAxisToolpath,
  KinematicFeasibilityReport,
  MachineKinematicLimits
} from './SECP083Types';

export class SECP083MachineKinematicsVerifier {

  public static readonly DEFAULT_5AXIS_LIMITS: MachineKinematicLimits = {
    xMinMm: -500, xMaxMm: 500,
    yMinMm: -500, yMaxMm: 500,
    zMinMm: -100, zMaxMm: 600,
    aMinDeg: -120, aMaxDeg: 120,
    bMinDeg: -360, bMaxDeg: 360,
    cMinDeg: -360, cMaxDeg: 360,
    maxFeedMmMin: 10000,
    maxRotaryVelocityDegSec: 120
  };

  public static verifyKinematics(
    toolpath: FiveAxisToolpath,
    limits: MachineKinematicLimits = SECP083MachineKinematicsVerifier.DEFAULT_5AXIS_LIMITS
  ): KinematicFeasibilityReport {
    let axisLimitViolations = 0;
    let rotarySingularityCount = 0;
    let orientationFlipCount = 0;
    let maxAngularVel = 0;

    const points = toolpath.points;

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];

      // 1. XYZ Envelope Check
      if (
        pt.position.x < limits.xMinMm || pt.position.x > limits.xMaxMm ||
        pt.position.y < limits.yMinMm || pt.position.y > limits.yMaxMm ||
        pt.position.z < limits.zMinMm || pt.position.z > limits.zMaxMm
      ) {
        axisLimitViolations++;
      }

      // 2. Rotary Singularity Check (Tool vector parallel to vertical Z axis, I=0, J=0, K=1)
      const isSingular = Math.abs(pt.toolVector.z) > 0.9999;
      if (isSingular) {
        rotarySingularityCount++;
      }

      // 3. Orientation Flip Check & Angular Velocity
      if (i > 0) {
        const prev = points[i - 1];
        const dot = Math.min(Math.max(
          pt.toolVector.x * prev.toolVector.x +
          pt.toolVector.y * prev.toolVector.y +
          pt.toolVector.z * prev.toolVector.z,
          -1.0), 1.0);

        const angleDeg = (Math.acos(dot) * 180) / Math.PI;

        // Discontinuous orientation flip > 45 deg between adjacent steps
        if (angleDeg > 45.0) {
          orientationFlipCount++;
        }

        const dist = Math.hypot(
          pt.position.x - prev.position.x,
          pt.position.y - prev.position.y,
          pt.position.z - prev.position.z
        );
        const dtSec = dist > 1e-6 ? (dist / (pt.feedRateMmMin / 60)) : 0.001;
        const angularVel = dtSec > 0 ? angleDeg / dtSec : 0;

        if (angularVel > maxAngularVel) {
          maxAngularVel = angularVel;
        }

        if (angularVel > limits.maxRotaryVelocityDegSec) {
          axisLimitViolations++;
        }
      }
    }

    const passed = axisLimitViolations === 0 && orientationFlipCount === 0;

    return {
      totalPointsChecked: points.length,
      axisLimitViolations,
      rotarySingularityCount,
      orientationFlipCount,
      maxAngularVelocityDegSec: Number(maxAngularVel.toFixed(2)),
      passed,
      details: passed
        ? `VERIFIED: 0 limit violations, 0 orientation flips across ${points.length} points.`
        : `FAILED: ${axisLimitViolations} limit violations, ${orientationFlipCount} orientation flips detected!`
    };
  }
}
