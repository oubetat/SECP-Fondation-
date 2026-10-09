/**
 * SECP CAD Kernel — Production 3D GCS Spatial Constraint Evaluator
 * Phase 15 (PATCH-173)
 *
 * Evaluates residuals across all 3D constraint equations with per-constraint breakdown.
 */

import { SpatialConstraintSystem } from './SpatialConstraintSystem';
import { Production3DConstraint } from './Production3DGCSTypes';
import { SpatialConstraintResidual } from './SpatialConstraintResidual';
import { Point, Vector } from '../cad-kernel/geometry/GeometryContracts';

export interface EvaluatorResult {
  readonly residualVector: number[];
  readonly perConstraintResiduals: Map<string, number[]>;
  readonly maxResidual: number;
  readonly residualNorm: number;
}

export class SpatialConstraintEvaluator {
  public static evaluate(
    system: SpatialConstraintSystem,
    constraints: readonly Production3DConstraint[]
  ): EvaluatorResult {
    const residuals: number[] = [];
    const perConstraintResiduals = new Map<string, number[]>();

    for (const c of constraints) {
      if (!c.driving) continue;

      const cResiduals = this.evaluateConstraint(system, c);
      perConstraintResiduals.set(c.constraintId, cResiduals);
      residuals.push(...cResiduals);
    }

    let sumSq = 0;
    let maxResidual = 0;
    for (const r of residuals) {
      const abs = Math.abs(r);
      sumSq += r * r;
      if (abs > maxResidual) {
        maxResidual = abs;
      }
    }

    return {
      residualVector: residuals,
      perConstraintResiduals,
      maxResidual,
      residualNorm: Math.sqrt(sumSq)
    };
  }

  public static evaluateConstraint(
    system: SpatialConstraintSystem,
    c: Production3DConstraint
  ): number[] {
    const targets = c.entities;
    if (targets.length === 0) return [0];

    const t0 = targets[0]?.entityId;
    const t1 = targets[1]?.entityId;
    const t2 = targets[2]?.entityId;
    const t3 = targets[3]?.entityId;

    switch (c.type) {
      case 'COINCIDENT': {
        if (!t0 || !t1) return [0];
        const p1 = system.getPoint(t0);
        const p2 = system.getPoint(t1);
        return SpatialConstraintResidual.coincident(p1, p2);
      }

      case 'POINT_ON_LINE': {
        if (!t0 || !t1) return [0];
        const p = system.getPoint(t0);
        const lineOrigin = system.getPoint(t1);
        const lineDir = system.getDirection(t1);
        return SpatialConstraintResidual.pointOnLine(p, lineOrigin, lineDir);
      }

      case 'POINT_ON_PLANE': {
        if (!t0 || !t1) return [0];
        const p = system.getPoint(t0);
        const planeOrigin = system.getPoint(t1);
        const planeNormal = system.getDirection(t1);
        return [SpatialConstraintResidual.pointOnPlane(p, planeOrigin, planeNormal)];
      }

      case 'LINE_ON_PLANE': {
        if (!t0 || !t1) return [0];
        const lineOrigin = system.getPoint(t0);
        const lineDir = system.getDirection(t0);
        const planeOrigin = system.getPoint(t1);
        const planeNormal = system.getDirection(t1);
        return SpatialConstraintResidual.lineOnPlane(lineOrigin, lineDir, planeOrigin, planeNormal);
      }

      case 'DISTANCE': {
        if (!t0 || !t1) return [0];
        const targetDist = c.parameters.targetDistance ?? c.parameters.value ?? 0;
        const p1 = system.getPoint(t0);
        const p2 = system.getPoint(t1);
        return [SpatialConstraintResidual.distance(p1, p2, targetDist)];
      }

      case 'ANGLE': {
        if (!t0 || !t1) return [0];
        const targetRad = c.parameters.targetAngleRad ?? ((c.parameters.value ?? 90) * Math.PI / 180);
        const v1 = system.getDirection(t0);
        const v2 = system.getDirection(t1);
        return [SpatialConstraintResidual.angle(v1, v2, targetRad)];
      }

      case 'PARALLEL': {
        if (!t0 || !t1) return [0];
        const v1 = system.getDirection(t0);
        const v2 = system.getDirection(t1);
        return SpatialConstraintResidual.parallel(v1, v2);
      }

      case 'PERPENDICULAR': {
        if (!t0 || !t1) return [0];
        const v1 = system.getDirection(t0);
        const v2 = system.getDirection(t1);
        return [SpatialConstraintResidual.perpendicular(v1, v2)];
      }

      case 'COLLINEAR': {
        if (!t0 || !t1 || !t2) return [0];
        const p1 = system.getPoint(t0);
        const p2 = system.getPoint(t1);
        const p3 = system.getPoint(t2);
        return SpatialConstraintResidual.collinear(p1, p2, p3);
      }

      case 'COPLANAR': {
        if (!t0 || !t1 || !t2 || !t3) return [0];
        const p1 = system.getPoint(t0);
        const p2 = system.getPoint(t1);
        const p3 = system.getPoint(t2);
        const p4 = system.getPoint(t3);
        return [SpatialConstraintResidual.coplanar(p1, p2, p3, p4)];
      }

      case 'CONCENTRIC': {
        if (!t0 || !t1) return [0];
        const c1 = system.getPoint(t0);
        const c2 = system.getPoint(t1);
        return SpatialConstraintResidual.concentric(c1, c2);
      }

      case 'COAXIAL':
      case 'AXIS_AXIS': {
        if (!t0 || !t1) return [0];
        const o1 = system.getPoint(t0);
        const d1 = system.getDirection(t0);
        const o2 = system.getPoint(t1);
        const d2 = system.getDirection(t1);
        return SpatialConstraintResidual.coaxial(o1, d1, o2, d2);
      }

      case 'TANGENT': {
        if (!t0 || !t1) return [0];
        const center = system.getPoint(t0);
        const radius = system.getRadius(t0);
        const planeOrigin = system.getPoint(t1);
        const planeNormal = system.getDirection(t1);
        return [SpatialConstraintResidual.tangentSpherePlane(center, radius, planeOrigin, planeNormal)];
      }

      case 'MIDPOINT': {
        if (!t0 || !t1 || !t2) return [0];
        const p1 = system.getPoint(t0);
        const p2 = system.getPoint(t1);
        const pMid = system.getPoint(t2);
        return SpatialConstraintResidual.midpoint(p1, p2, pMid);
      }

      case 'SYMMETRY': {
        if (!t0 || !t1 || !t2) return [0];
        const p1 = system.getPoint(t0);
        const p2 = system.getPoint(t1);
        const planeOrigin = system.getPoint(t2);
        const planeNormal = system.getDirection(t2);
        return SpatialConstraintResidual.symmetry(p1, p2, planeOrigin, planeNormal);
      }

      case 'FIX':
      case 'LOCK': {
        if (!t0) return [0];
        const p = system.getPoint(t0);
        const target: Point = {
          x: c.parameters.value ?? p.x,
          y: p.y,
          z: p.z
        };
        return SpatialConstraintResidual.fix(p, target);
      }

      case 'PLANE_PLANE': {
        if (!t0 || !t1) return [0];
        const n1 = system.getDirection(t0);
        const n2 = system.getDirection(t1);
        const offset = c.parameters.offset ?? 0;
        const p1 = system.getPoint(t0);
        const p2 = system.getPoint(t1);
        const parallelRes = SpatialConstraintResidual.parallel(n1, n2);
        const distRes = SpatialConstraintResidual.pointOnPlane(p2, p1, n1) - offset;
        return [...parallelRes, distRes];
      }

      case 'AXIS_PLANE': {
        if (!t0 || !t1) return [0];
        const axisDir = system.getDirection(t0);
        const planeNormal = system.getDirection(t1);
        // Axis parallel to plane -> axisDir . planeNormal = 0
        return [SpatialConstraintResidual.perpendicular(axisDir, planeNormal)];
      }

      case 'DATUM_REFERENCE': {
        if (!t0 || !t1) return [0];
        const p = system.getPoint(t0);
        const datumOrigin = system.getPoint(t1);
        const datumNormal = system.getDirection(t1);
        const offset = c.parameters.offset ?? c.parameters.value ?? 0;
        const dist = SpatialConstraintResidual.pointOnPlane(p, datumOrigin, datumNormal);
        return [dist - offset];
      }

      case 'ASSEMBLY_MATE': {
        if (!t0 || !t1) return [0];
        const p1 = system.getPoint(t0);
        const n1 = system.getDirection(t0);
        const p2 = system.getPoint(t1);
        const n2 = system.getDirection(t1);
        const offset = c.parameters.offset ?? 0;
        return SpatialConstraintResidual.assemblyMate(p1, n1, p2, n2, offset);
      }

      case 'ASSEMBLY_ALIGN': {
        if (!t0 || !t1) return [0];
        const p1 = system.getPoint(t0);
        const n1 = system.getDirection(t0);
        const p2 = system.getPoint(t1);
        const n2 = system.getDirection(t1);
        const offset = c.parameters.offset ?? 0;
        return SpatialConstraintResidual.assemblyAlign(p1, n1, p2, n2, offset);
      }

      case 'ASSEMBLY_RIGID': {
        if (!t0 || !t1) return [0];
        const p1 = system.getPoint(t0);
        const p2 = system.getPoint(t1);
        const posRes = SpatialConstraintResidual.coincident(p1, p2);
        const d1 = system.getDirection(t0);
        const d2 = system.getDirection(t1);
        const rotRes = SpatialConstraintResidual.parallel(d1, d2);
        return [...posRes, ...rotRes];
      }

      default:
        return [0];
    }
  }
}
