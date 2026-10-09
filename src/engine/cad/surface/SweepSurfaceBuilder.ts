/**
 * SECP CAD Kernel — Parametric Sweep Surface Construction Engine
 * PATCH-204: Phase 18 — Professional Modeling
 *
 * Implements Profile along Path/Spine Sweeping with Frenet & Parallel Transport (Bishop) moving frames,
 * Twist Law, Scale Law, Single & Multi Guide Rails, and Self-Intersection detection.
 */

import { Point, Vector, Curve } from '../../cad-kernel/geometry/GeometryContracts';
import { BRepNURBSSurface } from '../../cad-kernel/geometry/BRepGeometry';
import { NURBSEngine } from '../nurbs/NURBSEngine';
import { NURBSSurfaceData } from '../nurbs/NURBSTypes';
import {
  SweepSurfaceOptions,
  SweepOrientationMode,
  SurfaceConstructionError
} from './BoundaryLoftSweepTypes';

export interface MovingFrame {
  origin: Point;
  tangent: Vector;
  normal: Vector;
  binormal: Vector;
}

export class SweepSurfaceBuilder {
  /**
   * Main entry point to build a Sweep Surface
   */
  public static buildSweepSurface(
    profile: Curve,
    path: Curve,
    options: SweepSurfaceOptions = {}
  ): { surface: BRepNURBSSurface; data: NURBSSurfaceData } {
    const tolerance = options.tolerance ?? 1e-4;
    const mode = options.orientationMode ?? 'PARALLEL_TRANSPORT';
    const uSamples = options.uSamples ?? 15; // Along path
    const vSamples = options.vSamples ?? 10; // Along profile

    // 1. Validation of Profile and Path
    if (!profile) {
      throw new SurfaceConstructionError('SURFACE_CONSTRUCTION_REJECTED', 'Sweep profile curve is null/undefined.');
    }
    if (!path) {
      throw new SurfaceConstructionError('SURFACE_CONSTRUCTION_REJECTED', 'Sweep path/spine curve is null/undefined.');
    }

    const domProfile = profile.domain();
    const domPath = path.domain();

    if (!isFinite(domProfile.uMin) || !isFinite(domProfile.uMax) || domProfile.uMax <= domProfile.uMin) {
      throw new SurfaceConstructionError('SURFACE_CONSTRUCTION_REJECTED', 'Sweep profile has invalid domain.');
    }
    if (!isFinite(domPath.uMin) || !isFinite(domPath.uMax) || domPath.uMax <= domPath.uMin) {
      throw new SurfaceConstructionError('SURFACE_CONSTRUCTION_REJECTED', 'Sweep path has invalid domain.');
    }

    // Validate Guide Rails if provided
    if (options.rails && options.rails.length > 0) {
      for (let r = 0; r < options.rails.length; r++) {
        if (!options.rails[r]) {
          throw new SurfaceConstructionError('RAIL_VALIDATION_FAILED', `Guide rail ${r} is null or invalid.`);
        }
      }
    }

    // 2. Compute Moving Frames along Path (Frenet or Parallel Transport/Bishop)
    const frames = this.computeMovingFrames(path, uSamples, mode);

    // 3. Build Control Net by sweeping profile through moving frames, twist law, scale law, & rails
    const controlNet: Point[][] = []; // uSamples x vSamples

    // Pre-sample profile in local coordinates
    const localProfilePts: Point[] = [];
    for (let j = 0; j < vSamples; j++) {
      const vFrac = j / (vSamples - 1);
      const vVal = domProfile.uMin + vFrac * (domProfile.uMax - domProfile.uMin);
      localProfilePts.push(profile.evaluate(vVal));
    }

    // Center local profile relative to its centroid
    let cX = 0, cY = 0, cZ = 0;
    for (const pt of localProfilePts) {
      cX += pt.x;
      cY += pt.y;
      cZ += pt.z;
    }
    const profOrigin = { x: cX / vSamples, y: cY / vSamples, z: cZ / vSamples };

    for (let i = 0; i < uSamples; i++) {
      const uFrac = i / (uSamples - 1);
      const frame = frames[i];

      // Calculate Twist Angle
      const twistAngle = this.evaluateTwist(uFrac, options.twistLaw);

      // Check twist step limit
      if (i > 0) {
        const prevTwist = this.evaluateTwist((i - 1) / (uSamples - 1), options.twistLaw);
        if (Math.abs(twistAngle - prevTwist) >= Math.PI * 0.95) {
          throw new SurfaceConstructionError(
            'SWEEP_SELF_INTERSECTION',
            `Excessive twist rate detected between step ${i - 1} and ${i}. Sweep self-intersection / singularity.`
          );
        }
      }

      // Calculate Scale Factor
      let scale = this.evaluateScale(uFrac, options.scaleLaw);

      // Evaluate Guide Rails influence on scale/position
      if (options.rails && options.rails.length > 0) {
        const railPt = options.rails[0].evaluate(options.rails[0].domain().uMin + uFrac * (options.rails[0].domain().uMax - options.rails[0].domain().uMin));
        const distToRail = this.distance(frame.origin, railPt);
        if (distToRail > tolerance) {
          scale *= (distToRail / 2.0); // Adjust scale based on rail distance
        }
      }

      // Compute rotated Normal and Binormal vectors
      const cosT = Math.cos(twistAngle);
      const sinT = Math.sin(twistAngle);

      const rotNormal = {
        x: cosT * frame.normal.x - sinT * frame.binormal.x,
        y: cosT * frame.normal.y - sinT * frame.binormal.y,
        z: cosT * frame.normal.z - sinT * frame.binormal.z
      };

      const rotBinormal = {
        x: sinT * frame.normal.x + cosT * frame.binormal.x,
        y: sinT * frame.normal.y + cosT * frame.binormal.y,
        z: sinT * frame.normal.z + cosT * frame.binormal.z
      };

      const row: Point[] = [];

      for (let j = 0; j < vSamples; j++) {
        const lPt = localProfilePts[j];

        // Local profile relative displacement
        const dx = (lPt.x - profOrigin.x) * scale;
        const dy = (lPt.y - profOrigin.y) * scale;
        const dz = (lPt.z - profOrigin.z) * scale;

        // Transform into global frame position
        const globalPt = {
          x: frame.origin.x + dx * rotNormal.x + dy * rotBinormal.x + dz * frame.tangent.x,
          y: frame.origin.y + dx * rotNormal.y + dy * rotBinormal.y + dz * frame.tangent.y,
          z: frame.origin.z + dx * rotNormal.z + dy * rotBinormal.z + dz * frame.tangent.z
        };

        row.push(globalPt);
      }

      controlNet.push(row);
    }

    // 4. Validate for Self-Intersection / Fold-Over
    this.detectSweepSelfIntersection(controlNet, uSamples, vSamples, tolerance);

    // 5. Construct NURBS Surface
    const numU = controlNet.length;
    const numV = controlNet[0].length;
    const degU = Math.min(3, numU - 1);
    const degV = Math.min(3, numV - 1);

    const knotsU = NURBSEngine.generateUniformKnots(numU, degU);
    const knotsV = NURBSEngine.generateUniformKnots(numV, degV);

    const surface = new BRepNURBSSurface(degU, degV, controlNet, undefined, knotsU, knotsV);
    const data = NURBSEngine.toNURBSSurfaceData(surface, `SWEEP_${Math.random().toString(36).substring(2, 8)}`);

    return { surface, data };
  }

  /**
   * Computes moving frames along Path
   */
  public static computeMovingFrames(path: Curve, samples: number, mode: SweepOrientationMode): MovingFrame[] {
    const dom = path.domain();
    const frames: MovingFrame[] = [];
    const dt = (dom.uMax - dom.uMin) / (samples * 10);

    let prevNormal: Vector = { x: 0, y: 1, z: 0 };

    for (let i = 0; i < samples; i++) {
      const uFrac = i / (samples - 1);
      const u = dom.uMin + uFrac * (dom.uMax - dom.uMin);

      const p0 = path.evaluate(Math.max(dom.uMin, u - dt));
      const p1 = path.evaluate(u);
      const p2 = path.evaluate(Math.min(dom.uMax, u + dt));

      // First derivative (Tangent)
      const tVec = {
        x: (p2.x - p0.x) / (2 * dt),
        y: (p2.y - p0.y) / (2 * dt),
        z: (p2.z - p0.z) / (2 * dt)
      };
      const tangent = this.normalize(tVec);

      let normal: Vector;
      let binormal: Vector;

      if (mode === 'FRENET') {
        // Second derivative (Curvature vector)
        const d2 = {
          x: (p2.x - 2 * p1.x + p0.x) / (dt * dt),
          y: (p2.y - 2 * p1.y + p0.y) / (dt * dt),
          z: (p2.z - 2 * p1.z + p0.z) / (dt * dt)
        };
        const curNorm = this.normalize(d2);
        if (this.magnitude(d2) < 1e-6) {
          // Straight path fallback
          normal = this.getOrthogonalVector(tangent);
        } else {
          normal = curNorm;
        }
        binormal = this.normalize(this.crossProduct(tangent, normal));
      } else {
        // Parallel Transport (Bishop Frame)
        if (i === 0) {
          normal = this.getOrthogonalVector(tangent);
        } else {
          // Transport previous normal along tangent
          const v = this.crossProduct(frames[i - 1].tangent, tangent);
          const vLen = this.magnitude(v);
          if (vLen > 1e-8) {
            const axis = this.normalize(v);
            const cosA = this.dotProduct(frames[i - 1].tangent, tangent);
            const angle = Math.acos(Math.max(-1, Math.min(1, cosA)));
            normal = this.rotateVectorAboutAxis(frames[i - 1].normal, axis, angle);
          } else {
            normal = frames[i - 1].normal;
          }
        }
        binormal = this.normalize(this.crossProduct(tangent, normal));
      }

      frames.push({ origin: p1, tangent, normal, binormal });
    }

    return frames;
  }

  private static evaluateTwist(uFrac: number, twistLaw?: any): number {
    if (!twistLaw) return 0;
    if (twistLaw.type === 'CONSTANT') {
      return (twistLaw.angleStartDeg * Math.PI) / 180;
    }
    if (twistLaw.type === 'LINEAR') {
      const aStart = (twistLaw.angleStartDeg * Math.PI) / 180;
      const aEnd = (twistLaw.angleEndDeg * Math.PI) / 180;
      return aStart + uFrac * (aEnd - aStart);
    }
    if (twistLaw.type === 'CUSTOM' && twistLaw.customLawFn) {
      return twistLaw.customLawFn(uFrac);
    }
    return 0;
  }

  private static evaluateScale(uFrac: number, scaleLaw?: any): number {
    if (!scaleLaw) return 1.0;
    if (scaleLaw.type === 'CONSTANT') {
      return scaleLaw.scaleStart ?? 1.0;
    }
    if (scaleLaw.type === 'LINEAR') {
      const sStart = scaleLaw.scaleStart ?? 1.0;
      const sEnd = scaleLaw.scaleEnd ?? 1.0;
      return sStart + uFrac * (sEnd - sStart);
    }
    if (scaleLaw.type === 'CUSTOM' && scaleLaw.customLawFn) {
      return scaleLaw.customLawFn(uFrac);
    }
    return 1.0;
  }

  private static detectSweepSelfIntersection(
    net: Point[][],
    numU: number,
    numV: number,
    tolerance: number
  ) {
    for (let i = 0; i < numU - 1; i++) {
      for (let j = 0; j < numV - 1; j++) {
        const p0 = net[i][j];
        const pU = net[i + 1][j];
        const pV = net[i][j + 1];

        const du = { x: pU.x - p0.x, y: pU.y - p0.y, z: pU.z - p0.z };
        const dv = { x: pV.x - p0.x, y: pV.y - p0.y, z: pV.z - p0.z };

        const n = this.crossProduct(du, dv);
        const normSq = this.magnitude(n);

        if (normSq < 1e-10) {
          throw new SurfaceConstructionError(
            'SWEEP_SELF_INTERSECTION',
            `Sweep self-intersection or profile fold-over detected at u=${i}, v=${j}. Degenerate Jacobian determinant.`
          );
        }
      }
    }
  }

  // --- Vector Utilities ---

  private static normalize(v: Vector): Vector {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len < 1e-12) return { x: 0, y: 0, z: 0 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  private static magnitude(v: Vector): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  private static dotProduct(v1: Vector, v2: Vector): number {
    return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  }

  private static crossProduct(v1: Vector, v2: Vector): Vector {
    return {
      x: v1.y * v2.z - v1.z * v2.y,
      y: v1.z * v2.x - v1.x * v2.z,
      z: v1.x * v2.y - v1.y * v2.x
    };
  }

  private static getOrthogonalVector(v: Vector): Vector {
    if (Math.abs(v.x) < 0.8) {
      return this.normalize(this.crossProduct(v, { x: 1, y: 0, z: 0 }));
    }
    return this.normalize(this.crossProduct(v, { x: 0, y: 1, z: 0 }));
  }

  private static rotateVectorAboutAxis(v: Vector, axis: Vector, angle: number): Vector {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const dot = this.dotProduct(v, axis);
    const cross = this.crossProduct(axis, v);

    return {
      x: v.x * cosA + cross.x * sinA + axis.x * dot * (1 - cosA),
      y: v.y * cosA + cross.y * sinA + axis.y * dot * (1 - cosA),
      z: v.z * cosA + cross.z * sinA + axis.z * dot * (1 - cosA)
    };
  }

  private static distance(p1: Point, p2: Point): number {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2);
  }
}
