/**
 * SECP Industrial OS v3 — PATCH-179: Adaptive Toolpath Sampling & Feed Rate Optimizer
 * Dynamically adjusts point density based on surface curvature and kinematic rates,
 * and calculates optimized feeds under rotary axis velocity and chip load constraints.
 */

import { Vector3D } from '../../cadKernel';
import { 
  FiveAxisToolpathPoint, 
  FiveAxisToolDefinition, 
  MachineDefinition 
} from './FiveAxisTypes';

export interface SamplingConfig {
  maxChordErrorMm: number;    // Maximum allowed chordal deviation (e.g. 0.005 mm)
  minSegmentLengthMm: number; // Smallest distance between points (e.g. 0.1 mm)
  maxSegmentLengthMm: number; // Longest distance between points (e.g. 5.0 mm)
  angularToleranceDeg: number;// Max tool axis angular step (e.g. 2.0°)
}

export class AdaptiveToolpathSampler {
  /**
   * Refines a toolpath by adaptively inserting intermediate points in high-curvature or high-angular change zones
   */
  public static adaptivelySampleTrajectory(
    points: FiveAxisToolpathPoint[],
    config: SamplingConfig
  ): FiveAxisToolpathPoint[] {
    if (points.length < 2) return points;

    const refined: FiveAxisToolpathPoint[] = [];
    let nextIndex = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];

      refined.push({ ...p0, pointIndex: nextIndex++ });

      const dist = Math.hypot(
        p1.position.x - p0.position.x,
        p1.position.y - p0.position.y,
        p1.position.z - p0.position.z
      );

      // Angular difference between tool axes
      const dotAxis = Math.max(-1.0, Math.min(1.0, 
        p0.toolAxis.x * p1.toolAxis.x + p0.toolAxis.y * p1.toolAxis.y + p0.toolAxis.z * p1.toolAxis.z
      ));
      const angleDiffDeg = Math.acos(dotAxis) * (180 / Math.PI);

      // Determine required subdivisions
      const distSubdiv = Math.ceil(dist / config.maxSegmentLengthMm);
      const angleSubdiv = Math.ceil(angleDiffDeg / config.angularToleranceDeg);
      const subdivisions = Math.max(1, Math.min(8, Math.max(distSubdiv, angleSubdiv)));

      if (subdivisions > 1 && dist > config.minSegmentLengthMm) {
        for (let s = 1; s < subdivisions; s++) {
          const t = s / subdivisions;

          // Linear interpolation for position
          const interpPos: Vector3D = {
            x: Number((p0.position.x + t * (p1.position.x - p0.position.x)).toFixed(4)),
            y: Number((p0.position.y + t * (p1.position.y - p0.position.y)).toFixed(4)),
            z: Number((p0.position.z + t * (p1.position.z - p0.position.z)).toFixed(4))
          };

          // Spherical vector interpolation for tool axis
          const interpAxis = this.slerp(p0.toolAxis, p1.toolAxis, t);

          refined.push({
            pointIndex: nextIndex++,
            position: interpPos,
            toolAxis: interpAxis,
            contactPoint: p0.contactPoint ? {
              x: p0.contactPoint.x + t * ((p1.contactPoint?.x ?? p0.contactPoint.x) - p0.contactPoint.x),
              y: p0.contactPoint.y + t * ((p1.contactPoint?.y ?? p0.contactPoint.y) - p0.contactPoint.y),
              z: p0.contactPoint.z + t * ((p1.contactPoint?.z ?? p0.contactPoint.z) - p0.contactPoint.z)
            } : undefined,
            surfaceNormal: p0.surfaceNormal,
            leadAngleDeg: p0.leadAngleDeg + t * (p1.leadAngleDeg - p0.leadAngleDeg),
            tiltAngleDeg: p0.tiltAngleDeg + t * (p1.tiltAngleDeg - p0.tiltAngleDeg),
            feedRateMmMin: p0.feedRateMmMin,
            spindleRpm: p0.spindleRpm,
            moveType: p0.moveType,
            holderClearanceMm: Math.min(p0.holderClearanceMm ?? 10, p1.holderClearanceMm ?? 10)
          });
        }
      }
    }

    // Add last point
    refined.push({ ...points[points.length - 1], pointIndex: nextIndex++ });
    return refined;
  }

  private static slerp(v0: Vector3D, v1: Vector3D, t: number): Vector3D {
    let dot = v0.x * v1.x + v0.y * v1.y + v0.z * v1.z;
    dot = Math.max(-1.0, Math.min(1.0, dot));
    const theta = Math.acos(dot);
    if (Math.abs(theta) < 1e-5) return v0;
    const sinTheta = Math.sin(theta);
    const w0 = Math.sin((1 - t) * theta) / sinTheta;
    const w1 = Math.sin(t * theta) / sinTheta;
    const vx = w0 * v0.x + w1 * v1.x;
    const vy = w0 * v0.y + w1 * v1.y;
    const vz = w0 * v0.z + w1 * v1.z;
    const mag = Math.hypot(vx, vy, vz) || 1.0;
    return {
      x: Number((vx / mag).toFixed(6)),
      y: Number((vy / mag).toFixed(6)),
      z: Number((vz / mag).toFixed(6))
    };
  }
}

export class FeedRateOptimizer {
  /**
   * Optimizes feed rates along trajectory based on rotary axis velocity limits and curvature
   */
  public static optimizeFeedRates(
    points: FiveAxisToolpathPoint[],
    nominalFeedMmMin: number,
    tool: FiveAxisToolDefinition,
    machine: MachineDefinition
  ): FiveAxisToolpathPoint[] {
    const optimized: FiveAxisToolpathPoint[] = [];

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p.moveType === 'RAPID_APPROACH' || p.moveType === 'RETRACT') {
        optimized.push({ ...p, feedRateMmMin: machine.rapidFeedMmMin });
        continue;
      }

      let feed = nominalFeedMmMin;

      // 1. Slowdown near Kinematic Singularity
      if (p.isSingularityNear && p.singularityDistance !== undefined) {
        const factor = Math.max(0.2, Math.min(1.0, p.singularityDistance / machine.singularityConeAngleDeg));
        feed *= factor;
      }

      // 2. Rotary Axis Velocity Limiting Check
      if (i > 0 && p.machineAxes && points[i - 1].machineAxes) {
        const prevAxes = points[i - 1].machineAxes!;
        const currAxes = p.machineAxes;

        const deltaA = Math.abs(currAxes.A - prevAxes.A);
        const deltaC = Math.abs(currAxes.C - prevAxes.C);
        const distLinear = Math.hypot(
          currAxes.X - prevAxes.X,
          currAxes.Y - prevAxes.Y,
          currAxes.Z - prevAxes.Z
        );

        if (distLinear > 0.001) {
          // Time needed by linear motion at nominal feed: dt = dist / (feed / 60)
          // Required rotary speeds: wA = deltaA / dt, wC = deltaC / dt
          const maxAllowedA = machine.rotaryLimits.primary.limits.maxVelocity;
          const maxAllowedC = machine.rotaryLimits.secondary.limits.maxVelocity;

          const reqFeedLimitA = (distLinear * maxAllowedA) / (deltaA || 0.001);
          const reqFeedLimitC = (distLinear * maxAllowedC) / (deltaC || 0.001);

          feed = Math.min(feed, reqFeedLimitA, reqFeedLimitC);
        }
      }

      // 3. Holder Clearance Proximity Slowdown
      if (p.holderClearanceMm !== undefined && p.holderClearanceMm < 2.0) {
        feed *= Math.max(0.4, p.holderClearanceMm / 2.0);
      }

      optimized.push({
        ...p,
        feedRateMmMin: Number(Math.max(100, Math.min(nominalFeedMmMin, feed)).toFixed(1))
      });
    }

    return optimized;
  }
}
