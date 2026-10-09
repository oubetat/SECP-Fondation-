/**
 * SECP CAD Kernel — GCS 3D Constraint Evaluator
 * Phase 2 (PATCH-026)
 */

import { Point, Vector } from '../cad-kernel/geometry/GeometryContracts';
import { Constraint3DSystem } from './Constraint3DSystem';
import { Constraint3D } from './Constraint3DModel';
import { Constraint3DReference } from './Constraint3DReference';
import { Constraint3DResidual } from './Constraint3DResidual';

export class Constraint3DEvaluator {
  /**
   * Evaluates the residual vector for all constraints combined.
   */
  public static evaluate(
    system: Constraint3DSystem,
    constraints: readonly Constraint3D[]
  ): number[] {
    const residuals: number[] = [];

    for (const constraint of constraints) {
      if (!constraint.driving) continue;

      try {
        const res = this.evaluateConstraint(system, constraint);
        if (Array.isArray(res)) {
          residuals.push(...res);
        } else {
          residuals.push(res);
        }
      } catch (err) {
        // Fallback for unexpected evaluation errors
        residuals.push(1e3);
      }
    }

    return residuals;
  }

  private static evaluateConstraint(
    system: Constraint3DSystem,
    constraint: Constraint3D
  ): number | number[] {
    switch (constraint.type) {
      case 'COINCIDENT_3D': {
        const p1 = this.getPointFromRef(system, constraint.references[0]);
        const p2 = this.getPointFromRef(system, constraint.references[1]);
        return Constraint3DResidual.coincident(p1, p2);
      }
      case 'POINT_ON_LINE_3D': {
        const p = this.getPointFromRef(system, constraint.references[0]);
        const lineOrigin = this.getPointFromRef(system, constraint.references[1]);
        const lineDir = this.getVectorFromRef(system, constraint.references[1]);
        return Constraint3DResidual.pointOnLine(p, lineOrigin, lineDir);
      }
      case 'POINT_ON_PLANE_3D': {
        const p = this.getPointFromRef(system, constraint.references[0]);
        const planeOrigin = this.getPointFromRef(system, constraint.references[1]);
        const planeNormal = this.getVectorFromRef(system, constraint.references[1]);
        return Constraint3DResidual.pointOnPlane(p, planeOrigin, planeNormal);
      }
      case 'POINT_ON_CIRCLE_3D': {
        const p = this.getPointFromRef(system, constraint.references[0]);
        const center = this.getPointFromRef(system, constraint.references[1]);
        const normal = this.getVectorFromRef(system, constraint.references[1]);
        const radius = this.getRadiusFromRef(system, constraint.references[1]);
        return Constraint3DResidual.pointOnCircle(p, center, normal, radius);
      }
      case 'DISTANCE_3D': {
        const p1 = this.getPointFromRef(system, constraint.references[0]);
        const p2 = this.getPointFromRef(system, constraint.references[1]);
        const target = constraint.parameters.value ?? 0;
        return Constraint3DResidual.distance(p1, p2, target);
      }
      case 'DISTANCE_X_3D': {
        const p1 = this.getPointFromRef(system, constraint.references[0]);
        const p2 = this.getPointFromRef(system, constraint.references[1]);
        const target = constraint.parameters.value ?? 0;
        return Constraint3DResidual.distanceX(p1, p2, target);
      }
      case 'DISTANCE_Y_3D': {
        const p1 = this.getPointFromRef(system, constraint.references[0]);
        const p2 = this.getPointFromRef(system, constraint.references[1]);
        const target = constraint.parameters.value ?? 0;
        return Constraint3DResidual.distanceY(p1, p2, target);
      }
      case 'DISTANCE_Z_3D': {
        const p1 = this.getPointFromRef(system, constraint.references[0]);
        const p2 = this.getPointFromRef(system, constraint.references[1]);
        const target = constraint.parameters.value ?? 0;
        return Constraint3DResidual.distanceZ(p1, p2, target);
      }
      case 'ANGLE_3D': {
        const v1 = this.getVectorFromRef(system, constraint.references[0]);
        const v2 = this.getVectorFromRef(system, constraint.references[1]);
        const targetDeg = constraint.parameters.value ?? 90;
        const targetRad = targetDeg * (Math.PI / 180);
        return Constraint3DResidual.angle(v1, v2, targetRad);
      }
      case 'PARALLEL_3D': {
        const v1 = this.getVectorFromRef(system, constraint.references[0]);
        const v2 = this.getVectorFromRef(system, constraint.references[1]);
        return Constraint3DResidual.parallel(v1, v2);
      }
      case 'PERPENDICULAR_3D': {
        const v1 = this.getVectorFromRef(system, constraint.references[0]);
        const v2 = this.getVectorFromRef(system, constraint.references[1]);
        return Constraint3DResidual.perpendicular(v1, v2);
      }
      case 'COLLINEAR_3D': {
        if (constraint.references.length === 3) {
          const p1 = this.getPointFromRef(system, constraint.references[0]);
          const p2 = this.getPointFromRef(system, constraint.references[1]);
          const p3 = this.getPointFromRef(system, constraint.references[2]);
          return Constraint3DResidual.collinear(p1, p2, p3);
        } else {
          // Fallback to two lines being collinear (implies coaxial without different radius)
          const o1 = this.getPointFromRef(system, constraint.references[0]);
          const d1 = this.getVectorFromRef(system, constraint.references[0]);
          const o2 = this.getPointFromRef(system, constraint.references[1]);
          const d2 = this.getVectorFromRef(system, constraint.references[1]);
          return Constraint3DResidual.coaxial(o1, d1, o2, d2);
        }
      }
      case 'COPLANAR_3D': {
        const p1 = this.getPointFromRef(system, constraint.references[0]);
        const p2 = this.getPointFromRef(system, constraint.references[1]);
        const p3 = this.getPointFromRef(system, constraint.references[2]);
        const p4 = this.getPointFromRef(system, constraint.references[3]);
        return Constraint3DResidual.coplanar(p1, p2, p3, p4);
      }
      case 'CONCENTRIC_3D': {
        const c1 = this.getPointFromRef(system, constraint.references[0]);
        const c2 = this.getPointFromRef(system, constraint.references[1]);
        return Constraint3DResidual.concentric(c1, c2);
      }
      case 'COAXIAL_3D': {
        const o1 = this.getPointFromRef(system, constraint.references[0]);
        const d1 = this.getVectorFromRef(system, constraint.references[0]);
        const o2 = this.getPointFromRef(system, constraint.references[1]);
        const d2 = this.getVectorFromRef(system, constraint.references[1]);
        return Constraint3DResidual.coaxial(o1, d1, o2, d2);
      }
      case 'TANGENT_3D': {
        // Sphere and Plane or Sphere and Sphere
        const id1 = constraint.references[0].entityId.identityId;
        const id2 = constraint.references[1].entityId.identityId;

        const isSphere1 = system.hasParam(id1, 'cx') && !system.hasParam(id1, 'nx') && system.hasParam(id1, 'r');
        const isSphere2 = system.hasParam(id2, 'cx') && !system.hasParam(id2, 'nx') && system.hasParam(id2, 'r');
        const isPlane1 = system.hasParam(id1, 'nx');
        const isPlane2 = system.hasParam(id2, 'nx');

        if (isSphere1 && isPlane2) {
          const center = this.getPointFromRef(system, constraint.references[0]);
          const radius = this.getRadiusFromRef(system, constraint.references[0]);
          const origin = this.getPointFromRef(system, constraint.references[1]);
          const normal = this.getVectorFromRef(system, constraint.references[1]);
          return Constraint3DResidual.tangentSpherePlane(center, radius, origin, normal);
        } else if (isSphere2 && isPlane1) {
          const center = this.getPointFromRef(system, constraint.references[1]);
          const radius = this.getRadiusFromRef(system, constraint.references[1]);
          const origin = this.getPointFromRef(system, constraint.references[0]);
          const normal = this.getVectorFromRef(system, constraint.references[0]);
          return Constraint3DResidual.tangentSpherePlane(center, radius, origin, normal);
        } else if (isSphere1 && isSphere2) {
          const c1 = this.getPointFromRef(system, constraint.references[0]);
          const r1 = this.getRadiusFromRef(system, constraint.references[0]);
          const c2 = this.getPointFromRef(system, constraint.references[1]);
          const r2 = this.getRadiusFromRef(system, constraint.references[1]);
          return Constraint3DResidual.tangentSphereSphere(c1, r1, c2, r2);
        }
        throw new Error('Unsupported geometry combination for TANGENT_3D');
      }
      case 'FIX_3D': {
        const ref = constraint.references[0];
        if (ref.target === 'DIRECTION' || ref.target === 'NORMAL') {
          const v = this.getVectorFromRef(system, ref);
          const tx = constraint.parameters.value ?? v.x;
          const ty = (constraint.parameters as any).valueY ?? v.y;
          const tz = (constraint.parameters as any).valueZ ?? v.z;
          return [v.x - tx, v.y - ty, v.z - tz];
        } else {
          const p = this.getPointFromRef(system, ref);
          const tx = constraint.parameters.value ?? p.x;
          const ty = (constraint.parameters as any).valueY ?? p.y;
          const tz = (constraint.parameters as any).valueZ ?? p.z;
          return Constraint3DResidual.fix(p, { x: tx, y: ty, z: tz });
        }
      }
      case 'RADIUS_3D': {
        const r = this.getRadiusFromRef(system, constraint.references[0]);
        const target = constraint.parameters.value ?? r;
        return Constraint3DResidual.radius(r, target);
      }
      case 'DIAMETER_3D': {
        const r = this.getRadiusFromRef(system, constraint.references[0]);
        const target = constraint.parameters.value ?? (2 * r);
        return Constraint3DResidual.diameter(r, target);
      }
    }
    return 0;
  }

  private static getPointFromRef(system: Constraint3DSystem, ref: Constraint3DReference): Point {
    const id = ref.entityId.identityId;
    if (ref.target === 'CENTER') {
      return {
        x: system.getParamValue(id, 'cx'),
        y: system.getParamValue(id, 'cy'),
        z: system.getParamValue(id, 'cz'),
      };
    }
    if (ref.target === 'ORIGIN' || ref.target === 'ENTITY') {
      if (system.hasParam(id, 'x')) {
        return {
          x: system.getParamValue(id, 'x'),
          y: system.getParamValue(id, 'y'),
          z: system.getParamValue(id, 'z'),
        };
      }
      if (system.hasParam(id, 'ox')) {
        return {
          x: system.getParamValue(id, 'ox'),
          y: system.getParamValue(id, 'oy'),
          z: system.getParamValue(id, 'oz'),
        };
      }
      if (system.hasParam(id, 'cx')) {
        return {
          x: system.getParamValue(id, 'cx'),
          y: system.getParamValue(id, 'cy'),
          z: system.getParamValue(id, 'cz'),
        };
      }
    }
    throw new Error(`Unsupported reference target ${ref.target} for point on entity ${id}`);
  }

  private static getVectorFromRef(system: Constraint3DSystem, ref: Constraint3DReference): Vector {
    const id = ref.entityId.identityId;
    if (ref.target === 'DIRECTION' || ref.target === 'ENTITY') {
      if (system.hasParam(id, 'dx')) {
        return {
          x: system.getParamValue(id, 'dx'),
          y: system.getParamValue(id, 'dy'),
          z: system.getParamValue(id, 'dz'),
        };
      }
    }
    if (ref.target === 'NORMAL' || ref.target === 'ENTITY') {
      if (system.hasParam(id, 'nx')) {
        return {
          x: system.getParamValue(id, 'nx'),
          y: system.getParamValue(id, 'ny'),
          z: system.getParamValue(id, 'nz'),
        };
      }
    }
    throw new Error(`Unsupported reference target ${ref.target} for direction on entity ${id}`);
  }

  private static getRadiusFromRef(system: Constraint3DSystem, ref: Constraint3DReference): number {
    const id = ref.entityId.identityId;
    return system.getParamValue(id, 'r');
  }
}
