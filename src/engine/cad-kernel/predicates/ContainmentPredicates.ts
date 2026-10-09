/**
 * SECP CAD Kernel — Containment Predicates (Triangles, AABB)
 * Phase 2 (PATCH-018)
 */
import { Point, BoundingBox } from '../geometry/GeometryContracts';
import { GeometricTolerance, GeometricToleranceModel } from './GeometricTolerance';
import {
  GeometricPredicateResult,
  ContainmentClassification,
  Triangle2D,
  Triangle3D
} from './PredicateContracts';
import { OrientationPredicates } from './OrientationPredicates';
import { GeometricRelations } from './GeometricRelations';

export class ContainmentPredicates {
  /**
   * Point in 2D Triangle Containment
   */
  public static pointInTriangle2D(
    pt: { x: number; y: number },
    tri: Triangle2D,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<ContainmentClassification, { barycentric: [number, number, number] }> {
    if (!pt || !tri || !tri.a || !tri.b || !tri.c) {
      return {
        classification: 'INVALID',
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Null or undefined point/triangle']
      };
    }
    if (!GeometricTolerance.isFiniteNumber(pt.x, pt.y, tri.a.x, tri.a.y, tri.b.x, tri.b.y, tri.c.x, tri.c.y)) {
      return {
        classification: 'INVALID',
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Non-finite coordinate inputs']
      };
    }

    // Orientations for 3 edges: AB, BC, CA
    const o1 = OrientationPredicates.orientation2D(tri.a, tri.b, pt, tolModel);
    const o2 = OrientationPredicates.orientation2D(tri.b, tri.c, pt, tolModel);
    const o3 = OrientationPredicates.orientation2D(tri.c, tri.a, pt, tolModel);

    if (o1.classification === 'INVALID' || o2.classification === 'INVALID' || o3.classification === 'INVALID') {
      return {
        classification: 'INVALID',
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Invalid edge orientation in 2D triangle']
      };
    }

    // Check if triangle itself is degenerate
    const oTri = OrientationPredicates.orientation2D(tri.a, tri.b, tri.c, tolModel);
    if (oTri.classification === 'COLLINEAR') {
      return {
        classification: 'INVALID',
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Degenerate 2D triangle (collinear vertices)']
      };
    }

    const signs = [o1.classification, o2.classification, o3.classification];
    const hasCCW = signs.includes('COUNTERCLOCKWISE');
    const hasCW = signs.includes('CLOCKWISE');
    const hasCollinear = signs.includes('COLLINEAR');

    if (hasCCW && hasCW) {
      return {
        classification: 'OUTSIDE',
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Point lies outside triangle']
      };
    }

    if (hasCollinear) {
      return {
        classification: 'BOUNDARY',
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Point lies on triangle boundary edge/vertex']
      };
    }

    return {
      classification: 'INSIDE',
      semantics: 'ROBUST_NUMERICAL',
      diagnostics: ['Point lies strictly inside 2D triangle']
    };
  }

  /**
   * Point in 3D Triangle Containment
   */
  public static pointInTriangle3D(
    pt: Point,
    tri: Triangle3D,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<ContainmentClassification, { u: number; v: number; w: number }> {
    if (!pt || !tri || !tri.a || !tri.b || !tri.c) {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Null or undefined point/triangle 3D']
      };
    }

    // 1. Verify triangle non-degeneracy
    const coll = OrientationPredicates.areCollinear(tri.a, tri.b, tri.c, tolModel);
    if (coll.classification === 'TRUE_COLLINEAR' || coll.classification === 'INVALID') {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Degenerate 3D triangle (collinear vertices)']
      };
    }

    // 2. Compute normal of triangle plane
    const ab = { x: tri.b.x - tri.a.x, y: tri.b.y - tri.a.y, z: tri.b.z - tri.a.z };
    const ac = { x: tri.c.x - tri.a.x, y: tri.c.y - tri.a.y, z: tri.c.z - tri.a.z };
    const normal = {
      x: ab.y * ac.z - ab.z * ac.y,
      y: ab.z * ac.x - ab.x * ac.z,
      z: ab.x * ac.y - ab.y * ac.x
    };

    const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
    if (len > 1e-12) {
      normal.x /= len;
      normal.y /= len;
      normal.z /= len;
    }

    const plane = { origin: tri.a, normal, xDir: ab };
    const onPlaneRes = GeometricRelations.classifyPointToPlane(pt, plane, tolModel);
    if (onPlaneRes.classification !== 'ON_PLANE') {
      return {
        classification: 'OUTSIDE',
        semantics: 'TOLERANCE_BASED',
        diagnostics: [`Point is not coplanar with 3D triangle plane (dist=${onPlaneRes.value})`]
      };
    }

    // 3. Project to the dominant 2D coordinate plane to avoid numerical skew
    const nx = Math.abs(normal.x);
    const ny = Math.abs(normal.y);
    const nz = Math.abs(normal.z);

    let tri2D: Triangle2D;
    let pt2D: { x: number; y: number };

    if (nz >= nx && nz >= ny) {
      // Drop Z
      tri2D = { a: { x: tri.a.x, y: tri.a.y }, b: { x: tri.b.x, y: tri.b.y }, c: { x: tri.c.x, y: tri.c.y } };
      pt2D = { x: pt.x, y: pt.y };
    } else if (ny >= nx && ny >= nz) {
      // Drop Y
      tri2D = { a: { x: tri.a.x, y: tri.a.z }, b: { x: tri.b.x, y: tri.b.z }, c: { x: tri.c.x, y: tri.c.z } };
      pt2D = { x: pt.x, y: pt.z };
    } else {
      // Drop X
      tri2D = { a: { x: tri.a.y, y: tri.a.z }, b: { x: tri.b.y, y: tri.b.z }, c: { x: tri.c.y, y: tri.c.z } };
      pt2D = { x: pt.y, y: pt.z };
    }

    const res2D = this.pointInTriangle2D(pt2D, tri2D, tolModel);
    return {
      classification: res2D.classification,
      semantics: 'TOLERANCE_BASED',
      diagnostics: res2D.diagnostics
    };
  }

  /**
   * Classify Point to Axis-Aligned Bounding Box (AABB)
   */
  public static classifyPointToAABB(
    pt: Point,
    box: BoundingBox,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<ContainmentClassification, number> {
    if (!pt || !box || !box.min || !box.max) {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Null point or bounding box']
      };
    }
    if (!GeometricTolerance.isFiniteNumber(pt.x, pt.y, pt.z, box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z)) {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Non-finite coordinate inputs']
      };
    }

    // Check for inverted box
    if (box.min.x > box.max.x + tolModel.absoluteLength ||
        box.min.y > box.max.y + tolModel.absoluteLength ||
        box.min.z > box.max.z + tolModel.absoluteLength) {
      return {
        classification: 'INVALID',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Inverted AABB dimensions (min > max)']
      };
    }

    const tol = tolModel.absoluteLength;

    // Check outside
    if (pt.x < box.min.x - tol || pt.x > box.max.x + tol ||
        pt.y < box.min.y - tol || pt.y > box.max.y + tol ||
        pt.z < box.min.z - tol || pt.z > box.max.z + tol) {
      return {
        classification: 'OUTSIDE',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Point lies outside AABB']
      };
    }

    // Check boundary
    const onMinX = Math.abs(pt.x - box.min.x) <= tol;
    const onMaxX = Math.abs(pt.x - box.max.x) <= tol;
    const onMinY = Math.abs(pt.y - box.min.y) <= tol;
    const onMaxY = Math.abs(pt.y - box.max.y) <= tol;
    const onMinZ = Math.abs(pt.z - box.min.z) <= tol;
    const onMaxZ = Math.abs(pt.z - box.max.z) <= tol;

    if (onMinX || onMaxX || onMinY || onMaxY || onMinZ || onMaxZ) {
      return {
        classification: 'BOUNDARY',
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Point lies on AABB boundary']
      };
    }

    return {
      classification: 'INSIDE',
      semantics: 'TOLERANCE_BASED',
      diagnostics: ['Point lies strictly inside AABB']
    };
  }
}
