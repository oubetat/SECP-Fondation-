/**
 * PATCH-SECP-083: Continuous 5-Axis Simultaneous Toolpath Generator & Axis Planner
 * 
 * Generates continuous 5-axis toolpaths with explicit tool positions (X,Y,Z),
 * normalized tool axis vectors (I,J,K), lead angle, tilt angle, feed rate, spindle speed,
 * and trajectory smoothness optimization.
 */

import {
  FiveAxisCutterPoint,
  FiveAxisToolpath,
  NurbsSurfacePatch,
  ToolAssembly,
  Vector3D
} from './SECP083Types';
import { SECP083ClassASurfaceCore } from './SECP083ClassASurfaceCore';

export class SECP083FiveAxisToolpathEngine {

  /**
   * Generate Continuous 5-Axis Simultaneous Toolpath over NURBS Surface
   */
  public static generateFiveAxisToolpath(
    surface: NurbsSurfacePatch,
    tool: ToolAssembly,
    leadAngleDeg: number = 7.5,
    tiltAngleDeg: number = 3.0,
    uPasses: number = 8,
    vStepsPerPass: number = 25,
    cuttingFeedMmMin: number = 1200,
    rapidFeedMmMin: number = 5000,
    spindleRpm: number = 10000
  ): FiveAxisToolpath {
    const points: FiveAxisCutterPoint[] = [];
    let pointIndex = 0;
    let totalLengthMm = 0;
    let maxOrientationChangeDegPerMm = 0;

    const leadRad = (leadAngleDeg * Math.PI) / 180;
    const tiltRad = (tiltAngleDeg * Math.PI) / 180;

    let prevPos: Vector3D | null = null;
    let prevVec: Vector3D | null = null;

    for (let uIdx = 0; uIdx < uPasses; uIdx++) {
      const u = uIdx / (uPasses - 1 || 1);
      const isReverse = uIdx % 2 === 1; // Zig-zag smoothing

      for (let vIdx = 0; vIdx <= vStepsPerPass; vIdx++) {
        const vRaw = vIdx / vStepsPerPass;
        const v = isReverse ? 1.0 - vRaw : vRaw;

        const deriv = SECP083ClassASurfaceCore.evaluateSurfaceDerivatives(surface, u, v);
        const norm = deriv.normal;

        // Apply Lead & Tilt Rotational Transformation to Surface Normal
        const toolVector = this.computeOrientedToolVector(norm, leadRad, tiltRad);

        // Tool tip position for ball-nose tool offset along normal by radius
        const R = tool.cornerRadiusMm || tool.diameterMm / 2;
        const tipPos: Vector3D = {
          x: deriv.point.x + norm.x * R,
          y: deriv.point.y + norm.y * R,
          z: deriv.point.z + norm.z * R
        };

        let moveType: 'RAPID' | 'APPROACH' | 'CUTTING' | 'RETRACT' = 'CUTTING';
        if (vIdx === 0) moveType = 'APPROACH';

        if (prevPos) {
          const stepDist = Math.hypot(tipPos.x - prevPos.x, tipPos.y - prevPos.y, tipPos.z - prevPos.z);
          totalLengthMm += stepDist;

          if (prevVec && stepDist > 1e-6) {
            const dot = Math.min(Math.max(toolVector.x * prevVec.x + toolVector.y * prevVec.y + toolVector.z * prevVec.z, -1.0), 1.0);
            const angularChangeDeg = (Math.acos(dot) * 180) / Math.PI;
            const rateDegPerMm = angularChangeDeg / stepDist;
            if (rateDegPerMm > maxOrientationChangeDegPerMm) {
              maxOrientationChangeDegPerMm = rateDegPerMm;
            }
          }
        }

        // Calculate scallop height for ball mill
        const ae = 0.5; // Stepover
        const scallopHeightMm = R - Math.sqrt(Math.max(0, R * R - (ae * ae) / 4));

        points.push({
          pointIndex: pointIndex++,
          position: {
            x: Number(tipPos.x.toFixed(4)),
            y: Number(tipPos.y.toFixed(4)),
            z: Number(tipPos.z.toFixed(4))
          },
          toolVector,
          feedRateMmMin: moveType === 'APPROACH' ? rapidFeedMmMin : cuttingFeedMmMin,
          spindleRpm,
          moveType,
          leadAngleDeg,
          tiltAngleDeg,
          stepoverMm: ae,
          scallopHeightMm: Number(scallopHeightMm.toFixed(5))
        });

        prevPos = tipPos;
        prevVec = toolVector;
      }
    }

    const estimatedMachiningTimeSec = (totalLengthMm / cuttingFeedMmMin) * 60 + 5.0;

    return {
      toolpathId: `tp-5axis-${surface.id}`,
      tool,
      points,
      totalLengthMm: Number(totalLengthMm.toFixed(3)),
      estimatedMachiningTimeSec: Number(estimatedMachiningTimeSec.toFixed(1)),
      maxOrientationChangeDegPerMm: Number(maxOrientationChangeDegPerMm.toFixed(4))
    };
  }

  private static computeOrientedToolVector(norm: Vector3D, leadRad: number, tiltRad: number): Vector3D {
    const cosL = Math.cos(leadRad);
    const sinL = Math.sin(leadRad);
    const cosT = Math.cos(tiltRad);
    const sinT = Math.sin(tiltRad);

    const x = norm.x * cosL - norm.z * sinL;
    const y = norm.y * cosT + norm.z * sinT;
    const z = norm.x * sinL + norm.y * sinT + norm.z * cosL * cosT;

    const mag = Math.hypot(x, y, z) || 1.0;
    return {
      x: Number((x / mag).toFixed(6)),
      y: Number((y / mag).toFixed(6)),
      z: Number((z / mag).toFixed(6))
    };
  }
}
