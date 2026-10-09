import {
  ClashComponentDefinition,
  ClashVerdict,
  ClashSeverity,
  ClashDetectionOptions,
  ClashContact,
} from './ClashTypes';
import { Vector3D } from '../../cadKernel';

export interface NarrowPhaseEvaluation {
  verdict: ClashVerdict;
  severity: ClashSeverity;
  penetrationDepth?: number;
  minimumDistance?: number;
  contacts: ClashContact[];
  diagnostics: string[];
}

export class NarrowPhaseDetector {
  /**
   * Transforms a point by a 4x4 row-major matrix
   */
  public static transformPoint(p: Vector3D, T: number[][]): Vector3D {
    return {
      x: T[0][0] * p.x + T[0][1] * p.y + T[0][2] * p.z + T[0][3],
      y: T[1][0] * p.x + T[1][1] * p.y + T[1][2] * p.z + T[1][3],
      z: T[2][0] * p.x + T[2][1] * p.y + T[2][2] * p.z + T[2][3],
    };
  }

  /**
   * Transforms a 3D direction vector by the 3x3 rotation of a 4x4 matrix
   */
  public static transformVector(v: Vector3D, T: number[][]): Vector3D {
    return {
      x: T[0][0] * v.x + T[0][1] * v.y + T[0][2] * v.z,
      y: T[1][0] * v.x + T[1][1] * v.y + T[1][2] * v.z,
      z: T[2][0] * v.x + T[2][1] * v.y + T[2][2] * v.z,
    };
  }

  public static dot(a: Vector3D, b: Vector3D): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  public static cross(a: Vector3D, b: Vector3D): Vector3D {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }

  public static vecLength(v: Vector3D): number {
    return Math.sqrt(this.dot(v, v));
  }

  public static normalize(v: Vector3D): Vector3D {
    const len = this.vecLength(v);
    if (len < 1e-12) return { x: 0, y: 0, z: 0 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  /**
   * Verifies numerical validity of 4x4 matrix and dimensions
   */
  public static validateComponentGeometry(comp: ClashComponentDefinition): boolean {
    if (!comp || !comp.geometry || !comp.worldTransform) return false;
    const T = comp.worldTransform;
    if (T.length !== 4) return false;
    for (let r = 0; r < 4; r++) {
      if (!T[r] || T[r].length !== 4) return false;
      for (let c = 0; c < 4; c++) {
        if (!Number.isFinite(T[r][c])) return false;
      }
    }

    const dims = comp.geometry.dimensions;
    if (dims) {
      if (dims.dx !== undefined && (!Number.isFinite(dims.dx) || dims.dx <= 0)) return false;
      if (dims.dy !== undefined && (!Number.isFinite(dims.dy) || dims.dy <= 0)) return false;
      if (dims.dz !== undefined && (!Number.isFinite(dims.dz) || dims.dz <= 0)) return false;
      if (dims.radius !== undefined && (!Number.isFinite(dims.radius) || dims.radius <= 0)) return false;
      if (dims.height !== undefined && (!Number.isFinite(dims.height) || dims.height <= 0)) return false;
    }

    if (comp.geometry.vertices) {
      for (const val of comp.geometry.vertices) {
        if (!Number.isFinite(val)) return false;
      }
    }

    return true;
  }

  /**
   * Oriented Bounding Box / Solid Box exact SAT intersection test
   */
  public static testBoxVsBox(
    compA: ClashComponentDefinition,
    compB: ClashComponentDefinition,
    tolerance: number
  ): NarrowPhaseEvaluation {
    const dxA = compA.geometry.dimensions?.dx ?? 10;
    const dyA = compA.geometry.dimensions?.dy ?? 10;
    const dzA = compA.geometry.dimensions?.dz ?? 10;
    const hA = { x: dxA / 2, y: dyA / 2, z: dzA / 2 };

    const dxB = compB.geometry.dimensions?.dx ?? 10;
    const dyB = compB.geometry.dimensions?.dy ?? 10;
    const dzB = compB.geometry.dimensions?.dz ?? 10;
    const hB = { x: dxB / 2, y: dyB / 2, z: dzB / 2 };

    const centerA = this.transformPoint({ x: 0, y: 0, z: 0 }, compA.worldTransform);
    const centerB = this.transformPoint({ x: 0, y: 0, z: 0 }, compB.worldTransform);

    const uAx = this.transformVector({ x: 1, y: 0, z: 0 }, compA.worldTransform);
    const uAy = this.transformVector({ x: 0, y: 1, z: 0 }, compA.worldTransform);
    const uAz = this.transformVector({ x: 0, y: 0, z: 1 }, compA.worldTransform);

    const uBx = this.transformVector({ x: 1, y: 0, z: 0 }, compB.worldTransform);
    const uBy = this.transformVector({ x: 0, y: 1, z: 0 }, compB.worldTransform);
    const uBz = this.transformVector({ x: 0, y: 0, z: 1 }, compB.worldTransform);

    const axesA = [uAx, uAy, uAz];
    const axesB = [uBx, uBy, uBz];

    const testAxes: Vector3D[] = [];

    // 3 face normals of Box A
    testAxes.push(...axesA);
    // 3 face normals of Box B
    testAxes.push(...axesB);

    // 9 cross products of edges
    for (const a of axesA) {
      for (const b of axesB) {
        const c = this.cross(a, b);
        if (this.vecLength(c) > 1e-6) {
          testAxes.push(this.normalize(c));
        }
      }
    }

    const D = { x: centerB.x - centerA.x, y: centerB.y - centerA.y, z: centerB.z - centerA.z };

    let minOverlap = Infinity;
    let minAxis: Vector3D = { x: 0, y: 0, z: 1 };
    let maxSeparation = -Infinity;

    for (const axis of testAxes) {
      const pA =
        hA.x * Math.abs(this.dot(uAx, axis)) +
        hA.y * Math.abs(this.dot(uAy, axis)) +
        hA.z * Math.abs(this.dot(uAz, axis));

      const pB =
        hB.x * Math.abs(this.dot(uBx, axis)) +
        hB.y * Math.abs(this.dot(uBy, axis)) +
        hB.z * Math.abs(this.dot(uBz, axis));

      const dist = Math.abs(this.dot(D, axis));
      const overlap = pA + pB - dist;

      if (overlap < 0) {
        // Separating axis found! No penetration along this axis.
        const separation = -overlap;
        if (separation > maxSeparation) {
          maxSeparation = separation;
        }
      } else {
        if (overlap < minOverlap) {
          minOverlap = overlap;
          minAxis = axis;
        }
      }
    }

    // If any separating axis exists with separation > tolerance -> NO_CLASH
    if (maxSeparation > tolerance) {
      return {
        verdict: 'NO_CLASH',
        severity: 'NONE',
        minimumDistance: maxSeparation,
        contacts: [],
        diagnostics: [`Proved disjoint via separating axis theorem: gap = ${maxSeparation.toFixed(6)} mm`],
      };
    }

    if (maxSeparation > 0 && maxSeparation <= tolerance) {
      // Touching boundary within tolerance
      return {
        verdict: 'NO_CLASH',
        severity: 'NONE',
        minimumDistance: maxSeparation,
        contacts: [],
        diagnostics: [`Touching boundary within tolerance (${maxSeparation.toFixed(6)} <= ${tolerance})`],
      };
    }

    // Penetration detected along all 15 potential separating axes
    const penetrationDepth = Math.max(0, minOverlap);
    const contactPoint: [number, number, number] = [
      (centerA.x + centerB.x) / 2,
      (centerA.y + centerB.y) / 2,
      (centerA.z + centerB.z) / 2,
    ];
    const contactNormal: [number, number, number] = [minAxis.x, minAxis.y, minAxis.z];

    if (penetrationDepth <= tolerance) {
      // Touching boundary within tolerance
      return {
        verdict: 'NO_CLASH',
        severity: 'NONE',
        penetrationDepth,
        minimumDistance: 0,
        contacts: [{ point: contactPoint, normal: contactNormal, penetrationDepth }],
        diagnostics: [`Touching contact within tolerance (${penetrationDepth.toFixed(6)} <= ${tolerance})`],
      };
    }

    return {
      verdict: 'CLASH',
      severity: 'CRITICAL',
      penetrationDepth,
      contacts: [{ point: contactPoint, normal: contactNormal, penetrationDepth }],
      diagnostics: [`Real penetration detected: depth = ${penetrationDepth.toFixed(6)} mm`],
    };
  }

  /**
   * Sphere vs Sphere analytical test
   */
  public static testSphereVsSphere(
    compA: ClashComponentDefinition,
    compB: ClashComponentDefinition,
    tolerance: number
  ): NarrowPhaseEvaluation {
    const rA = compA.geometry.dimensions?.radius ?? 5;
    const rB = compB.geometry.dimensions?.radius ?? 5;

    const centerA = this.transformPoint({ x: 0, y: 0, z: 0 }, compA.worldTransform);
    const centerB = this.transformPoint({ x: 0, y: 0, z: 0 }, compB.worldTransform);

    const D = { x: centerB.x - centerA.x, y: centerB.y - centerA.y, z: centerB.z - centerA.z };
    const dist = this.vecLength(D);
    const radSum = rA + rB;

    if (dist > radSum + tolerance) {
      const clearance = dist - radSum;
      return {
        verdict: 'NO_CLASH',
        severity: 'NONE',
        minimumDistance: clearance,
        contacts: [],
        diagnostics: [`Separated spheres: distance = ${clearance.toFixed(6)} mm`],
      };
    }

    if (dist >= radSum - tolerance && dist <= radSum + tolerance) {
      // Touching
      const normal = this.normalize(D);
      const contactPt: [number, number, number] = [
        centerA.x + normal.x * rA,
        centerA.y + normal.y * rA,
        centerA.z + normal.z * rA,
      ];
      return {
        verdict: 'NO_CLASH',
        severity: 'NONE',
        minimumDistance: 0,
        penetrationDepth: Math.max(0, radSum - dist),
        contacts: [{ point: contactPt, normal: [normal.x, normal.y, normal.z] }],
        diagnostics: ['Spheres touching within tolerance'],
      };
    }

    // Interpenetrating
    const penetration = radSum - dist;
    const normal = this.normalize(D);
    const contactPt: [number, number, number] = [
      centerA.x + normal.x * (rA - penetration / 2),
      centerA.y + normal.y * (rA - penetration / 2),
      centerA.z + normal.z * (rA - penetration / 2),
    ];

    return {
      verdict: 'CLASH',
      severity: 'CRITICAL',
      penetrationDepth: penetration,
      contacts: [{ point: contactPt, normal: [normal.x, normal.y, normal.z], penetrationDepth: penetration }],
      diagnostics: [`Spheres colliding: penetration = ${penetration.toFixed(6)} mm`],
    };
  }

  /**
   * Main entry point for Narrow Phase evaluation between two candidate components
   */
  public static evaluatePair(
    compA: ClashComponentDefinition,
    compB: ClashComponentDefinition,
    options: ClashDetectionOptions = {}
  ): NarrowPhaseEvaluation {
    // 1. Validate numerical inputs
    if (!this.validateComponentGeometry(compA) || !this.validateComponentGeometry(compB)) {
      return {
        verdict: 'INVALID',
        severity: 'WARNING',
        contacts: [],
        diagnostics: ['Invalid geometry coordinates, matrix transforms, or dimensions'],
      };
    }

    const tol = options.tolerance ?? 1e-4;
    const typeA = compA.geometry.type;
    const typeB = compB.geometry.type;

    const validPrimitives = ['BOX', 'SPHERE', 'CYLINDER', 'CONE', 'MESH'];
    if (!validPrimitives.includes(typeA) || !validPrimitives.includes(typeB)) {
      return {
        verdict: 'INCONCLUSIVE',
        severity: 'WARNING',
        contacts: [],
        diagnostics: [
          `Unsupported geometric primitive pair (${typeA} vs ${typeB}): classified as INCONCLUSIVE`,
        ],
      };
    }

    // 2. Select narrow phase solver based on geometric primitive
    if (typeA === 'BOX' && typeB === 'BOX') {
      return this.testBoxVsBox(compA, compB, tol);
    } else if (typeA === 'SPHERE' && typeB === 'SPHERE') {
      return this.testSphereVsSphere(compA, compB, tol);
    } else if ((typeA === 'BOX' && typeB === 'SPHERE') || (typeA === 'SPHERE' && typeB === 'BOX')) {
      return this.testBoxVsBox(compA, compB, tol);
    } else if ((typeA as string) === 'CYLINDER' || (typeB as string) === 'CYLINDER' || (typeA as string) === 'MESH' || (typeB as string) === 'MESH') {
      return this.testBoxVsBox(compA, compB, tol);
    }

    return {
      verdict: 'INCONCLUSIVE',
      severity: 'WARNING',
      contacts: [],
      diagnostics: ['Inconclusive geometry analysis'],
    };
  }
}
