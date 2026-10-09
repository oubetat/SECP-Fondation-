/**
 * SECP CAD Kernel — GCS Constraint Evaluator
 * Phase 2 (PATCH-025)
 */

import { ConstraintSystem } from './ConstraintSystem';
import { SketchConstraint } from './ConstraintModel';
import { ConstraintResiduals } from './ConstraintResidual';
import { Point2D } from '../SketchGeometry';

export class ConstraintEvaluator {
  /**
   * Evaluates the residual vector for all constraints.
   */
  public static evaluate(
    system: ConstraintSystem,
    constraints: readonly SketchConstraint[]
  ): number[] {
    const residuals: number[] = [];

    for (const constraint of constraints) {
      const res = this.evaluateConstraint(system, constraint);
      if (Array.isArray(res)) {
        residuals.push(...res);
      } else {
        residuals.push(res);
      }
    }

    return residuals;
  }

  private static evaluateConstraint(
    system: ConstraintSystem,
    constraint: SketchConstraint
  ): number | number[] {
    switch (constraint.type) {
      case 'COINCIDENT':
      case 'POINT_ON_POINT': {
        const p1 = this.getPointFromRef(system, constraint.references[0]);
        const p2 = this.getPointFromRef(system, constraint.references[1]);
        return [p1.x - p2.x, p1.y - p2.y];
      }
      case 'HORIZONTAL': {
        if (constraint.references.length === 1) {
          const id = constraint.references[0].entityId.projectId;
          const p1 = { x: system.getParamValue(id, 'x1'), y: system.getParamValue(id, 'y1') };
          const p2 = { x: system.getParamValue(id, 'x2'), y: system.getParamValue(id, 'y2') };
          return ConstraintResiduals.horizontal(p1, p2);
        }
        const p1 = this.getPointFromRef(system, constraint.references[0]);
        const p2 = this.getPointFromRef(system, constraint.references[1]);
        return ConstraintResiduals.horizontal(p1, p2);
      }
      case 'VERTICAL': {
        if (constraint.references.length === 1) {
          const id = constraint.references[0].entityId.projectId;
          const p1 = { x: system.getParamValue(id, 'x1'), y: system.getParamValue(id, 'y1') };
          const p2 = { x: system.getParamValue(id, 'x2'), y: system.getParamValue(id, 'y2') };
          return ConstraintResiduals.vertical(p1, p2);
        }
        const p1 = this.getPointFromRef(system, constraint.references[0]);
        const p2 = this.getPointFromRef(system, constraint.references[1]);
        return ConstraintResiduals.vertical(p1, p2);
      }
      case 'DISTANCE': {
        if (constraint.references.length === 1) {
          const id = constraint.references[0].entityId.projectId;
          const p1 = { x: system.getParamValue(id, 'x1'), y: system.getParamValue(id, 'y1') };
          const p2 = { x: system.getParamValue(id, 'x2'), y: system.getParamValue(id, 'y2') };
          const target = constraint.parameters.value || 0;
          return ConstraintResiduals.distance(p1, p2, target);
        }
        const p1 = this.getPointFromRef(system, constraint.references[0]);
        const p2 = this.getPointFromRef(system, constraint.references[1]);
        const target = constraint.parameters.value || 0;
        return ConstraintResiduals.distance(p1, p2, target);
      }
      case 'DISTANCE_X': {
        const p1 = this.getPointFromRef(system, constraint.references[0]);
        const p2 = this.getPointFromRef(system, constraint.references[1]);
        const target = constraint.parameters.value || 0;
        return ConstraintResiduals.distanceX(p1, p2, target);
      }
      case 'DISTANCE_Y': {
        const p1 = this.getPointFromRef(system, constraint.references[0]);
        const p2 = this.getPointFromRef(system, constraint.references[1]);
        const target = constraint.parameters.value || 0;
        return ConstraintResiduals.distanceY(p1, p2, target);
      }
      case 'RADIUS': {
        const id = constraint.references[0].entityId.projectId;
        const r = system.getParamValue(id, 'r');
        const target = constraint.parameters.value || 0;
        return ConstraintResiduals.radius(r, target);
      }
      case 'DIAMETER': {
        const id = constraint.references[0].entityId.projectId;
        const r = system.getParamValue(id, 'r');
        const target = (constraint.parameters.value || 0) / 2;
        return ConstraintResiduals.radius(r, target);
      }
      case 'PARALLEL': {
        // References should be lines. v1 = (x2-x1, y2-y1)
        const v1 = this.getDirectionVector(system, constraint.references[0]);
        const v2 = this.getDirectionVector(system, constraint.references[1]);
        return ConstraintResiduals.parallel(v1, v2);
      }
      case 'PERPENDICULAR': {
        const v1 = this.getDirectionVector(system, constraint.references[0]);
        const v2 = this.getDirectionVector(system, constraint.references[1]);
        return ConstraintResiduals.perpendicular(v1, v2);
      }
      case 'FIX': {
        const p = this.getPointFromRef(system, constraint.references[0]);
        // Ideally we compare against initial values stored in constraint parameters
        const targetX = constraint.parameters.value ?? p.x;
        const targetY = (constraint.parameters as any).valueY ?? p.y;
        return [p.x - targetX, p.y - targetY];
      }
      case 'ANGLE': {
        const v1 = this.getDirectionVector(system, constraint.references[0]);
        const v2 = this.getDirectionVector(system, constraint.references[1]);
        const targetDeg = constraint.parameters.value || 0;
        const targetRad = targetDeg * Math.PI / 180;
        const currentRad = Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x);
        let diff = (currentRad - targetRad) % (2 * Math.PI);
        if (diff > Math.PI) diff -= 2 * Math.PI;
        if (diff < -Math.PI) diff += 2 * Math.PI;
        return diff;
      }
      case 'TANGENT': {
        const ref0 = constraint.references[0];
        const ref1 = constraint.references[1];
        let p1: Point2D | null = null;
        let p2: Point2D | null = null;
        let c1: Point2D | null = null;
        let r1 = 0;
        let c2: Point2D | null = null;
        let r2 = 0;

        const isLine = (ref: any) => {
          try {
            system.getParamValue(ref.entityId.projectId, 'x1');
            return true;
          } catch {
            return false;
          }
        };

        const isCircleOrArc = (ref: any) => {
          try {
            system.getParamValue(ref.entityId.projectId, 'r');
            return true;
          } catch {
            return false;
          }
        };

        if (isLine(ref0) && isCircleOrArc(ref1)) {
          const idL = ref0.entityId.projectId;
          const idC = ref1.entityId.projectId;
          p1 = { x: system.getParamValue(idL, 'x1'), y: system.getParamValue(idL, 'y1') };
          p2 = { x: system.getParamValue(idL, 'x2'), y: system.getParamValue(idL, 'y2') };
          c1 = { x: system.getParamValue(idC, 'cx'), y: system.getParamValue(idC, 'cy') };
          r1 = system.getParamValue(idC, 'r');
        } else if (isCircleOrArc(ref0) && isLine(ref1)) {
          const idL = ref1.entityId.projectId;
          const idC = ref0.entityId.projectId;
          p1 = { x: system.getParamValue(idL, 'x1'), y: system.getParamValue(idL, 'y1') };
          p2 = { x: system.getParamValue(idL, 'x2'), y: system.getParamValue(idL, 'y2') };
          c1 = { x: system.getParamValue(idC, 'cx'), y: system.getParamValue(idC, 'cy') };
          r1 = system.getParamValue(idC, 'r');
        } else if (isCircleOrArc(ref0) && isCircleOrArc(ref1)) {
          const idC1 = ref0.entityId.projectId;
          const idC2 = ref1.entityId.projectId;
          c1 = { x: system.getParamValue(idC1, 'cx'), y: system.getParamValue(idC1, 'cy') };
          r1 = system.getParamValue(idC1, 'r');
          c2 = { x: system.getParamValue(idC2, 'cx'), y: system.getParamValue(idC2, 'cy') };
          r2 = system.getParamValue(idC2, 'r');
        }

        if (p1 && p2 && c1) {
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) return 0;
          const num = Math.abs(dy * c1.x - dx * c1.y + p2.x * p1.y - p2.y * p1.x);
          return num / len - r1;
        } else if (c1 && c2) {
          const dx = c2.x - c1.x;
          const dy = c2.y - c1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          return dist - (r1 + r2);
        }
        return 0;
      }
      case 'EQUAL': {
        const ref0 = constraint.references[0];
        const ref1 = constraint.references[1];
        const isLine = (ref: any) => {
          try {
            system.getParamValue(ref.entityId.projectId, 'x1');
            return true;
          } catch {
            return false;
          }
        };
        const isCircleOrArc = (ref: any) => {
          try {
            system.getParamValue(ref.entityId.projectId, 'r');
            return true;
          } catch {
            return false;
          }
        };

        if (isLine(ref0) && isLine(ref1)) {
          const id1 = ref0.entityId.projectId;
          const id2 = ref1.entityId.projectId;
          const v1 = {
            x: system.getParamValue(id1, 'x2') - system.getParamValue(id1, 'x1'),
            y: system.getParamValue(id1, 'y2') - system.getParamValue(id1, 'y1')
          };
          const v2 = {
            x: system.getParamValue(id2, 'x2') - system.getParamValue(id2, 'x1'),
            y: system.getParamValue(id2, 'y2') - system.getParamValue(id2, 'y1')
          };
          const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
          const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
          return len1 - len2;
        } else if (isCircleOrArc(ref0) && isCircleOrArc(ref1)) {
          const id1 = ref0.entityId.projectId;
          const id2 = ref1.entityId.projectId;
          return system.getParamValue(id1, 'r') - system.getParamValue(id2, 'r');
        }
        return 0;
      }
      case 'CONCENTRIC': {
        const ref0 = constraint.references[0];
        const ref1 = constraint.references[1];
        const id1 = ref0.entityId.projectId;
        const id2 = ref1.entityId.projectId;
        const cx1 = system.getParamValue(id1, 'cx');
        const cy1 = system.getParamValue(id1, 'cy');
        const cx2 = system.getParamValue(id2, 'cx');
        const cy2 = system.getParamValue(id2, 'cy');
        return [cx1 - cx2, cy1 - cy2];
      }
      case 'SYMMETRIC': {
        const ref0 = constraint.references[0];
        const ref1 = constraint.references[1];
        const p1 = this.getPointFromRef(system, ref0);
        const p2 = this.getPointFromRef(system, ref1);
        return [p1.x - p2.x, p1.y + p2.y];
      }
      default:
        return 0;
    }
  }

  private static getDirectionVector(system: ConstraintSystem, ref: any): Point2D {
    const id = ref.entityId.projectId;
    // Assuming LINE entity
    return {
      x: system.getParamValue(id, 'x2') - system.getParamValue(id, 'x1'),
      y: system.getParamValue(id, 'y2') - system.getParamValue(id, 'y1')
    };
  }

  private static getPointFromRef(system: ConstraintSystem, ref: any): Point2D {
    const id = ref.entityId.projectId;
    if (ref.target === 'START_POINT' || ref.target === 'ENTITY') {
      // If it's a POINT, it's x,y. If it's a LINE, START_POINT is x1,y1. If it's an ARC, it's computed from cx,cy,r,startAngle
      if (system.hasParam(id, 'x')) {
        return { 
          x: system.getParamValue(id, 'x'), 
          y: system.getParamValue(id, 'y') 
        };
      }
      if (system.hasParam(id, 'x1')) {
        return { 
          x: system.getParamValue(id, 'x1'), 
          y: system.getParamValue(id, 'y1') 
        };
      }
      if (system.hasParam(id, 'cx') && system.hasParam(id, 'startAngle')) {
        const cx = system.getParamValue(id, 'cx');
        const cy = system.getParamValue(id, 'cy');
        const r = system.getParamValue(id, 'r');
        const startAngle = system.getParamValue(id, 'startAngle');
        return {
          x: cx + r * Math.cos(startAngle),
          y: cy + r * Math.sin(startAngle)
        };
      }
    }
    if (ref.target === 'END_POINT') {
      if (system.hasParam(id, 'x2')) {
        return { 
          x: system.getParamValue(id, 'x2'), 
          y: system.getParamValue(id, 'y2') 
        };
      }
      if (system.hasParam(id, 'cx') && system.hasParam(id, 'endAngle')) {
        const cx = system.getParamValue(id, 'cx');
        const cy = system.getParamValue(id, 'cy');
        const r = system.getParamValue(id, 'r');
        const endAngle = system.getParamValue(id, 'endAngle');
        return {
          x: cx + r * Math.cos(endAngle),
          y: cy + r * Math.sin(endAngle)
        };
      }
    }
    if (ref.target === 'CENTER') {
      return { 
        x: system.getParamValue(id, 'cx'), 
        y: system.getParamValue(id, 'cy') 
      };
    }
    throw new Error(`Unsupported reference target: ${ref.target} on entity ${id}`);
  }

  /**
   * Computes the Jacobian matrix J = dr/dx numerically.
   */
  public static computeJacobian(
    system: ConstraintSystem,
    constraints: readonly SketchConstraint[],
    eps: number = 1e-8
  ): number[][] {
    const x = system.getVector();
    const r0 = this.evaluate(system, constraints);
    const m = r0.length;
    const n = x.length;
    const J: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));

    for (let j = 0; j < n; j++) {
      const x_plus = [...x];
      x_plus[j] += eps;
      system.updateFromVector(x_plus);
      const r_plus = this.evaluate(system, constraints);

      for (let i = 0; i < m; i++) {
        J[i][j] = (r_plus[i] - r0[i]) / eps;
      }
    }

    // Restore original vector
    system.updateFromVector(x);
    return J;
  }
}
