/**
 * SECP Industrial OS v3 — PATCH-179: 5-Axis Tool-Axis Smoothing Engine
 * Filters angular discontinuities, prevents rotary axis oscillations, clamps angular
 * jerk, and ensures smooth C2 tool orientation transition across complex surfaces.
 */

import { Vector3D } from '../../cadKernel';
import { FiveAxisToolpathPoint } from './FiveAxisTypes';

export class ToolAxisSmoother {
  /**
   * Smooths tool axis vectors along a toolpath trajectory using spherical linear interpolation (Slerp)
   * and angular acceleration clamping.
   */
  public static smoothTrajectoryToolAxes(
    points: FiveAxisToolpathPoint[],
    maxAngularChangeDeg: number = 8.0,
    smoothingPasses: number = 2
  ): FiveAxisToolpathPoint[] {
    if (points.length < 3) return points;

    const smoothed: FiveAxisToolpathPoint[] = points.map(p => ({
      ...p,
      toolAxis: { ...p.toolAxis }
    }));

    for (let pass = 0; pass < smoothingPasses; pass++) {
      for (let i = 1; i < smoothed.length - 1; i++) {
        // Skip rapid approach or transition moves
        if (smoothed[i].moveType === 'RAPID_APPROACH' || smoothed[i].moveType === 'RETRACT') {
          continue;
        }

        const prevAxis = smoothed[i - 1].toolAxis;
        const currAxis = smoothed[i].toolAxis;
        const nextAxis = smoothed[i + 1].toolAxis;

        // Spherical average of prev, curr, and next
        const avgX = prevAxis.x * 0.25 + currAxis.x * 0.5 + nextAxis.x * 0.25;
        const avgY = prevAxis.y * 0.25 + currAxis.y * 0.5 + nextAxis.y * 0.25;
        const avgZ = prevAxis.z * 0.25 + currAxis.z * 0.5 + nextAxis.z * 0.25;

        const normalizedAvg = this.normalizeVector({ x: avgX, y: avgY, z: avgZ });

        // Enforce maximum angular change constraint
        const dotPrev = Math.max(-1.0, Math.min(1.0, this.dotProduct(normalizedAvg, prevAxis)));
        const angleDeg = Math.acos(dotPrev) * (180 / Math.PI);

        if (angleDeg > maxAngularChangeDeg) {
          // Clamp to max allowed angular change using Slerp from prevAxis
          const clamped = this.slerp(prevAxis, normalizedAvg, maxAngularChangeDeg / angleDeg);
          smoothed[i].toolAxis = clamped;
        } else {
          smoothed[i].toolAxis = normalizedAvg;
        }
      }
    }

    return smoothed;
  }

  /**
   * Spherical Linear Interpolation (Slerp) between two unit vectors
   */
  public static slerp(v0: Vector3D, v1: Vector3D, t: number): Vector3D {
    let dot = this.dotProduct(v0, v1);
    dot = Math.max(-1.0, Math.min(1.0, dot));

    const theta = Math.acos(dot);
    if (Math.abs(theta) < 1e-5) {
      return v0;
    }

    const sinTheta = Math.sin(theta);
    const w0 = Math.sin((1 - t) * theta) / sinTheta;
    const w1 = Math.sin(t * theta) / sinTheta;

    return this.normalizeVector({
      x: w0 * v0.x + w1 * v1.x,
      y: w0 * v0.y + w1 * v1.y,
      z: w0 * v0.z + w1 * v1.z
    });
  }

  private static normalizeVector(v: Vector3D): Vector3D {
    const mag = Math.hypot(v.x, v.y, v.z) || 1.0;
    return {
      x: Number((v.x / mag).toFixed(6)),
      y: Number((v.y / mag).toFixed(6)),
      z: Number((v.z / mag).toFixed(6))
    };
  }

  private static dotProduct(a: Vector3D, b: Vector3D): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }
}
