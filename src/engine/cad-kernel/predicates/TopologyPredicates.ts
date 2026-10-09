/**
 * SECP CAD Kernel — Topology & B-Rep Predicate Integration
 * Phase 2 (PATCH-018)
 */
import { Point, Vector, Plane } from '../geometry/GeometryContracts';
import { Loop, Face, Vertex, Edge, Orientation } from '../topology/TopologyContracts';
import { GeometricTolerance, GeometricToleranceModel } from './GeometricTolerance';
import {
  GeometricPredicateResult,
  GeneralClassification,
  Orientation2DClassification
} from './PredicateContracts';
import { VectorPredicates } from './VectorPredicates';
import { OrientationPredicates } from './OrientationPredicates';
import { DistancePredicates } from './DistancePredicates';

export class TopologyPredicates {
  /**
   * Evaluates vertex geometric coincidence within a specified or vertex tolerance.
   */
  public static areVerticesCoincident(
    v1: Vertex,
    v2: Vertex,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<GeneralClassification, number> {
    if (!v1 || !v2 || !v1.geometry || !v2.geometry) {
      return {
        classification: 'INVALID',
        value: NaN,
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Null vertex or missing geometry reference']
      };
    }

    const distRes = DistancePredicates.pointPointDistance(v1.geometry, v2.geometry);
    if (distRes.classification === 'INVALID') {
      return {
        classification: 'INVALID',
        value: NaN,
        semantics: 'TOLERANCE_BASED',
        diagnostics: distRes.diagnostics
      };
    }

    const maxTol = Math.max(v1.tolerance || 0, v2.tolerance || 0, tolModel.absoluteLength);
    const isCoincident = distRes.value!.distance <= maxTol;

    return {
      classification: isCoincident ? 'TRUE' : 'FALSE',
      value: distRes.value!.distance,
      semantics: 'TOLERANCE_BASED',
      diagnostics: [`distance = ${distRes.value!.distance}, tolerance = ${maxTol}`]
    };
  }

  /**
   * Evaluates whether all vertices of a loop are coplanar.
   */
  public static isLoopPlanar(
    loop: Loop,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<GeneralClassification, { plane?: Plane; maxDeviation: number }> {
    if (!loop || !loop.orientedEdges || loop.orientedEdges.length < 3) {
      return {
        classification: 'INVALID',
        value: { maxDeviation: NaN },
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Loop must contain at least 3 oriented edges']
      };
    }

    const points: Point[] = [];
    for (const oe of loop.orientedEdges) {
      const v = oe.orientation === Orientation.FORWARD ? oe.edge.startVertex : oe.edge.endVertex;
      if (!v || !v.geometry) {
        return {
          classification: 'INVALID',
          value: { maxDeviation: NaN },
          semantics: 'TOLERANCE_BASED',
          diagnostics: ['Loop contains edge with missing vertex geometry']
        };
      }
      points.push(v.geometry);
    }

    // Find first 3 non-collinear points to establish loop plane
    let p0 = points[0], p1 = points[1], p2: Point | null = null;
    let normal: Vector | null = null;

    for (let i = 2; i < points.length; i++) {
      const coll = OrientationPredicates.areCollinear(p0, p1, points[i], tolModel);
      if (coll.classification === 'NOT_COLLINEAR') {
        p2 = points[i];
        const v1 = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
        const v2 = { x: p2.x - p0.x, y: p2.y - p0.y, z: p2.z - p0.z };
        const cross = VectorPredicates.crossProduct(v1, v2).value!;
        const norm = VectorPredicates.normalize(cross, tolModel);
        if (norm.classification === 'TRUE') {
          normal = norm.value!;
          break;
        }
      }
    }

    if (!normal) {
      return {
        classification: 'INVALID',
        value: { maxDeviation: 0 },
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['All vertices in loop are collinear (degenerate loop)']
      };
    }

    const plane: Plane = {
      origin: p0,
      normal,
      xDir: { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z }
    };

    let maxDeviation = 0;
    for (const pt of points) {
      const distRes = DistancePredicates.pointPlaneDistance(pt, plane, tolModel);
      if (distRes.classification === 'INVALID') {
        return {
          classification: 'INVALID',
          value: { maxDeviation: NaN },
          semantics: 'TOLERANCE_BASED',
          diagnostics: distRes.diagnostics
        };
      }
      if (distRes.value! > maxDeviation) {
        maxDeviation = distRes.value!;
      }
    }

    const isPlanar = maxDeviation <= tolModel.absoluteLength;
    return {
      classification: isPlanar ? 'TRUE' : 'FALSE',
      value: { plane, maxDeviation },
      semantics: 'TOLERANCE_BASED',
      diagnostics: [`maxDeviation = ${maxDeviation}, tolerance = ${tolModel.absoluteLength}`]
    };
  }

  /**
   * Computes signed 2D area / winding orientation of a planar polygon / loop.
   */
  public static computePlanarLoopSignedArea2D(
    polygon: Array<{ x: number; y: number }>
  ): GeometricPredicateResult<Orientation2DClassification, number> {
    if (!polygon || polygon.length < 3) {
      return {
        classification: 'INVALID',
        value: NaN,
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Polygon requires at least 3 vertices']
      };
    }

    let area2 = 0;
    const n = polygon.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area2 += polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y;
    }

    const area = area2 * 0.5;
    if (Math.abs(area) <= GeometricTolerance.DEFAULT.area) {
      return {
        classification: 'COLLINEAR',
        value: area,
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Planar loop has zero enclosed area']
      };
    }

    return {
      classification: area > 0 ? 'COUNTERCLOCKWISE' : 'CLOCKWISE',
      value: area,
      semantics: 'ROBUST_NUMERICAL',
      diagnostics: [`signedArea = ${area}`]
    };
  }
}
