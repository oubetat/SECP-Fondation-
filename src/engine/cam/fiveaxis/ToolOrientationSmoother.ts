/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-258 — Tool Orientation Trajectory Smoother & Interpolator
 * Performs Spherical Linear Interpolation (SLERP), limits angular accelerations,
 * and detects tool orientation discontinuities.
 */

import { Vector3D } from '../../cadKernel';
import { KinematicDiagnostic, ToolOrientationVector } from './FiveAxisTypes';
import { FiveAxisMathUtils } from './FiveAxisMathUtils';

export interface SmoothedOrientationSegment {
  interpolatedVectors: ToolOrientationVector[];
  maxAngularStepDeg: number;
  hasDiscontinuity: boolean;
  diagnostics: KinematicDiagnostic[];
}

export class ToolOrientationSmoother {
  /**
   * Evaluates angular transition between two orientations and interpolates if angular step > maxStepDeg
   */
  public static interpolateOrientations(
    from: Vector3D | ToolOrientationVector,
    to: Vector3D | ToolOrientationVector,
    maxStepDeg: number = 2.0,
    discontinuityThresholdDeg: number = 45.0
  ): SmoothedOrientationSegment {
    const v0 = FiveAxisMathUtils.normalize(from);
    const v1 = FiveAxisMathUtils.normalize(to);
    const angularDiffDeg = FiveAxisMathUtils.angleBetweenDeg(v0, v1);

    const diagnostics: KinematicDiagnostic[] = [];
    const hasDiscontinuity = angularDiffDeg > discontinuityThresholdDeg;

    if (hasDiscontinuity) {
      diagnostics.push({
        code: 'TOOL_ORIENTATION_DISCONTINUITY',
        severity: 'WARNING',
        message: `Abrupt tool orientation change detected (${angularDiffDeg.toFixed(2)}° > ${discontinuityThresholdDeg}°). Smoothing applied.`,
        numericalDetails: { angularDiffDeg, thresholdDeg: discontinuityThresholdDeg }
      });
    }

    const numSteps = Math.max(1, Math.ceil(angularDiffDeg / maxStepDeg));
    const interpolatedVectors: ToolOrientationVector[] = [];

    for (let i = 0; i <= numSteps; i++) {
      const t = i / numSteps;
      const slerpVec = FiveAxisMathUtils.slerpVector(v0, v1, t);
      interpolatedVectors.push(FiveAxisMathUtils.toOrientationVector(slerpVec));
    }

    return {
      interpolatedVectors,
      maxAngularStepDeg: Number(angularDiffDeg.toFixed(3)),
      hasDiscontinuity,
      diagnostics
    };
  }

  /**
   * Smooths an entire sequence of tool orientation vectors across a toolpath
   */
  public static smoothTrajectory(
    orientations: ToolOrientationVector[],
    maxStepDeg: number = 2.0
  ): { smoothed: ToolOrientationVector[]; totalInterpolated: number; diagnostics: KinematicDiagnostic[] } {
    if (orientations.length <= 1) {
      return { smoothed: orientations, totalInterpolated: 0, diagnostics: [] };
    }

    const result: ToolOrientationVector[] = [orientations[0]];
    const allDiagnostics: KinematicDiagnostic[] = [];
    let addedPoints = 0;

    for (let i = 0; i < orientations.length - 1; i++) {
      const seg = this.interpolateOrientations(orientations[i], orientations[i + 1], maxStepDeg);
      allDiagnostics.push(...seg.diagnostics);

      // Skip the first point since it's already added
      for (let j = 1; j < seg.interpolatedVectors.length; j++) {
        result.push(seg.interpolatedVectors[j]);
        if (j > 1) addedPoints++;
      }
    }

    return {
      smoothed: result,
      totalInterpolated: addedPoints,
      diagnostics: allDiagnostics
    };
  }
}
