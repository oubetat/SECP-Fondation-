/**
 * SECP CAD Kernel — Geometric & Topological Entity Classifier
 * Phase 2 (PATCH-019)
 */
import { Point, Vector, Plane } from '../geometry/GeometryContracts';
import { Solid, Shell, Face, Loop, Edge, Vertex, TopoShapeEnum, Orientation } from '../topology/TopologyContracts';
import { ClassificationState } from './BooleanTypes';
import { BooleanTolerance } from './BooleanTolerance';
import { GeometricTolerance, GeometricToleranceModel } from '../predicates/GeometricTolerance';
import { VectorPredicates } from '../predicates/VectorPredicates';
import { DistancePredicates } from '../predicates/DistancePredicates';
import { ContainmentPredicates } from '../predicates/ContainmentPredicates';
import { GeometricRelations } from '../predicates/GeometricRelations';

export class BooleanClassifier {
  /**
   * Deterministic set of jittered rays for robust point-in-solid ray casting.
   */
  private static readonly DETERMINISTIC_RAYS: Vector[] = [
    { x: 1.0, y: 0.0123, z: 0.0456 },
    { x: -1.0, y: -0.0123, z: -0.0456 },
    { x: 0.0123, y: 1.0, z: 0.0456 },
    { x: -0.0123, y: -1.0, z: -0.0456 },
    { x: 0.0123, y: 0.0456, z: 1.0 },
    { x: -0.0123, y: -0.0456, z: -1.0 },
    { x: 0.577, y: 0.578, z: 0.579 },
    { x: -0.577, y: 0.578, z: 0.579 },
    { x: 0.577, y: -0.578, z: 0.579 },
    { x: 0.577, y: 0.578, z: -0.579 },
    { x: -0.577, y: -0.578, z: 0.579 },
    { x: -0.577, y: 0.578, z: -0.579 },
    { x: 0.3, y: 0.95, z: 0.01 },
    { x: -0.3, y: -0.95, z: 0.01 },
    { x: 0.95, y: 0.01, z: 0.3 }
  ];

  /**
   * Classifies a 3D point against a B-Rep Solid (INSIDE, OUTSIDE, ON_BOUNDARY, AMBIGUOUS).
   */
  public static classifyPointAgainstSolid(
    pt: Point,
    solid: Solid,
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): ClassificationState {
    if (!pt || !solid || !solid.outerShell) {
      return 'AMBIGUOUS';
    }

    // 1. Check boundary coincidence
    if (this.isPointOnShellBoundary(pt, solid.outerShell, model)) {
      return 'ON_BOUNDARY';
    }

    if (solid.innerShells) {
      for (const inner of solid.innerShells) {
        if (this.isPointOnShellBoundary(pt, inner, model)) {
          return 'ON_BOUNDARY';
        }
      }
    }

    // 2. Outer shell ray casting
    const outerHits = this.castRayAgainstShell(pt, solid.outerShell, model);
    if (outerHits === null) {
      return 'AMBIGUOUS';
    }

    const insideOuter = outerHits % 2 !== 0;

    if (!insideOuter) {
      return 'OUTSIDE';
    }

    // 3. Inner shells ray casting
    if (solid.innerShells) {
      for (const inner of solid.innerShells) {
        const innerHits = this.castRayAgainstShell(pt, inner, model);
        if (innerHits !== null && innerHits % 2 !== 0) {
          // Point is inside a cavity inner shell => OUTSIDE solid body
          return 'OUTSIDE';
        }
      }
    }

    return 'INSIDE';
  }

  /**
   * Classifies an Edge against a B-Rep Solid.
   */
  public static classifyEdgeAgainstSolid(
    edge: Edge,
    solid: Solid,
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): ClassificationState {
    if (!edge || !edge.startVertex || !edge.endVertex) return 'AMBIGUOUS';

    const pStart = edge.startVertex.geometry;
    const pEnd = edge.endVertex.geometry;
    const pMid: Point = {
      x: 0.5 * (pStart.x + pEnd.x),
      y: 0.5 * (pStart.y + pEnd.y),
      z: 0.5 * (pStart.z + pEnd.z)
    };

    const clsMid = this.classifyPointAgainstSolid(pMid, solid, model);
    if (clsMid !== 'AMBIGUOUS') return clsMid;

    const clsStart = this.classifyPointAgainstSolid(pStart, solid, model);
    const clsEnd = this.classifyPointAgainstSolid(pEnd, solid, model);

    if (clsStart === clsEnd) return clsStart;
    return 'AMBIGUOUS';
  }

  /**
   * Classifies a Face against a B-Rep Solid.
   */
  public static classifyFaceAgainstSolid(
    face: Face,
    solid: Solid,
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): ClassificationState {
    if (!face || !face.outerLoop) return 'AMBIGUOUS';

    const vertices = this.getLoopVertices(face.outerLoop);
    if (vertices.length < 3) return 'AMBIGUOUS';

    // Compute centroid of face vertices
    let cx = 0, cy = 0, cz = 0;
    for (const v of vertices) {
      cx += v.x;
      cy += v.y;
      cz += v.z;
    }
    const centroid: Point = {
      x: cx / vertices.length,
      y: cy / vertices.length,
      z: cz / vertices.length
    };

    const clsCentroid = this.classifyPointAgainstSolid(centroid, solid, model);
    if (clsCentroid === 'ON_BOUNDARY') {
      const match = this.findBoundaryFaceOnShell(centroid, solid.outerShell, model);
      if (match) {
        const planeA = this.getFacePlane(face);
        const planeB = match.plane || this.getFacePlane(match.face, match.orientation);
        if (planeA && planeB) {
          const dot = planeA.normal.x * planeB.normal.x +
                      planeA.normal.y * planeB.normal.y +
                      planeA.normal.z * planeB.normal.z;
          if (dot > 0.5) return 'COINCIDENT_SAME';
          if (dot < -0.5) return 'COINCIDENT_OPPOSITE';
        }
      }
      return 'ON_BOUNDARY';
    }
    if (clsCentroid !== 'AMBIGUOUS') return clsCentroid;

    // Fallback: classify vertices
    let insideCount = 0;
    let outsideCount = 0;
    let boundaryCount = 0;

    for (const v of vertices) {
      const cls = this.classifyPointAgainstSolid(v, solid, model);
      if (cls === 'INSIDE') insideCount++;
      else if (cls === 'OUTSIDE') outsideCount++;
      else if (cls === 'ON_BOUNDARY') boundaryCount++;
    }

    if (insideCount > 0 && outsideCount === 0) return 'INSIDE';
    if (outsideCount > 0 && insideCount === 0) return 'OUTSIDE';
    if (boundaryCount === vertices.length) return 'ON_BOUNDARY';

    return 'AMBIGUOUS';
  }

  /**
   * Helper: finds the boundary face on shell that contains pt, if any.
   */
  public static findBoundaryFaceOnShell(
    pt: Point,
    shell: Shell,
    model: GeometricToleranceModel
  ): { face: Face; orientation: Orientation; plane: Plane | null } | null {
    if (!shell || !shell.orientedFaces) return null;

    for (const oface of shell.orientedFaces) {
      if (!oface.face) continue;
      const surf = oface.face.geometry as any;
      
      let isOnSurface = false;
      let facePlane: Plane | null = null;

      if (surf && surf.type === 'PLANE') {
        facePlane = surf as Plane;
        const relRes = GeometricRelations.classifyPointToPlane(pt, facePlane, model);
        isOnSurface = relRes.classification === 'ON_PLANE';
      } else if (surf && surf.type === 'SPHERE') {
        const dist = Math.sqrt(
          Math.pow(pt.x - surf.center.x, 2) +
          Math.pow(pt.y - surf.center.y, 2) +
          Math.pow(pt.z - surf.center.z, 2)
        );
        isOnSurface = Math.abs(dist - surf.radius) <= model.absoluteLength;
      } else if (surf && surf.type === 'CYLINDER') {
        const axis = surf.axis;
        const vec: Vector = { x: pt.x - axis.location.x, y: pt.y - axis.location.y, z: pt.z - axis.location.z };
        const dot = VectorPredicates.dotProduct(vec, axis.direction).value || 0;
        const proj: Point = {
          x: axis.location.x + dot * axis.direction.x,
          y: axis.location.y + dot * axis.direction.y,
          z: axis.location.z + dot * axis.direction.z
        };
        const dist = Math.sqrt(
          Math.pow(pt.x - proj.x, 2) +
          Math.pow(pt.y - proj.y, 2) +
          Math.pow(pt.z - proj.z, 2)
        );
        isOnSurface = Math.abs(dist - surf.radius) <= model.absoluteLength;
      } else {
        facePlane = this.getFacePlane(oface.face, oface.orientation);
        if (facePlane) {
          const relRes = GeometricRelations.classifyPointToPlane(pt, facePlane, model);
          isOnSurface = relRes.classification === 'ON_PLANE';
        }
      }

      if (isOnSurface) {
        if (!facePlane) facePlane = this.getFacePlane(oface.face, oface.orientation);
        if (facePlane) {
          if (this.isPointInFacePolygon(pt, oface.face, facePlane, model)) {
            return { face: oface.face, orientation: oface.orientation || Orientation.FORWARD, plane: facePlane };
          }
        } else {
          return { face: oface.face, orientation: oface.orientation || Orientation.FORWARD, plane: null };
        }
      }
    }

    return null;
  }

  /**
   * Helper: checks if point lies on shell boundary faces.
   */
  public static isPointOnShellBoundary(
    pt: Point,
    shell: Shell,
    model: GeometricToleranceModel
  ): boolean {
    return this.findBoundaryFaceOnShell(pt, shell, model) !== null;
  }

  /**
   * Helper: checks if point lies inside the 2D polygon of a planar face.
   */
  public static isPointInFacePolygon(
    pt: Point,
    face: Face,
    plane: Plane,
    model: GeometricToleranceModel
  ): boolean {
    const vertices = this.getLoopVertices(face.outerLoop);
    if (vertices.length < 3) return false;

    // Project to 2D for robust point-in-polygon
    const p2d = this.projectPointTo2D(pt, plane);
    const verts2d = vertices.map(v => this.projectPointTo2D(v, plane));

    // Standard ray-casting PIP in 2D
    let inside = false;
    for (let i = 0, j = verts2d.length - 1; i < verts2d.length; j = i++) {
      if (((verts2d[i].y > p2d.y) !== (verts2d[j].y > p2d.y)) &&
          (p2d.x < (verts2d[j].x - verts2d[i].x) * (p2d.y - verts2d[i].y) / (verts2d[j].y - verts2d[i].y) + verts2d[i].x)) {
        inside = !inside;
      }
    }

    if (!inside) {
      // Check if it's exactly on the boundary
      const tol = model.absoluteLength;
      for (let i = 0; i < vertices.length; i++) {
        const v1 = vertices[i];
        const v2 = vertices[(i + 1) % vertices.length];
        const distRes = DistancePredicates.pointSegmentDistance(pt, { start: v1, end: v2 });
        if (distRes.classification === 'TRUE' && distRes.value && distRes.value.distance <= tol) {
          return true;
        }
      }
      return false;
    }

    // Check inner loops (holes)
    if (face.innerLoops) {
      for (const holeLoop of face.innerLoops) {
        const holeVerts = this.getLoopVertices(holeLoop);
        if (holeVerts.length >= 3) {
          const hverts2d = holeVerts.map(v => this.projectPointTo2D(v, plane));
          let inHole = false;
          for (let i = 0, j = hverts2d.length - 1; i < hverts2d.length; j = i++) {
            if (((hverts2d[i].y > p2d.y) !== (hverts2d[j].y > p2d.y)) &&
                (p2d.x < (hverts2d[j].x - hverts2d[i].x) * (p2d.y - hverts2d[i].y) / (hverts2d[j].y - hverts2d[i].y) + hverts2d[i].x)) {
              inHole = !inHole;
            }
          }
          if (inHole) return false;
        }
      }
    }

    return true;
  }

  private static castRayAgainstShell(
    pt: Point,
    shell: Shell,
    model: GeometricToleranceModel
  ): number | null {
    const scale = Math.max(Math.abs(pt.x), Math.abs(pt.y), Math.abs(pt.z));
    const tol = GeometricTolerance.getScaleAwareLengthTolerance(scale, model);

    for (const rayDir of this.DETERMINISTIC_RAYS) {
      let hits = 0;
      let ambiguousHit = false;

      for (const oface of shell.orientedFaces) {
        if (!oface.face) continue;
        const plane = this.getFacePlane(oface.face);
        if (!plane) continue;

        const denomRes = VectorPredicates.dotProduct(rayDir, plane.normal);
        if (denomRes.classification === 'INVALID' || denomRes.value === null || Math.abs(denomRes.value) < 1e-12) {
          // Ray parallel to face plane
          continue;
        }

        const denom = denomRes.value;
        const vecPO: Vector = { x: plane.origin.x - pt.x, y: plane.origin.y - pt.y, z: plane.origin.z - pt.z };
        const numerRes = VectorPredicates.dotProduct(vecPO, plane.normal);
        if (numerRes.classification === 'INVALID' || numerRes.value === null) continue;

        const t = numerRes.value / denom;

        // Use a small epsilon to avoid counting the start point itself if it's on the boundary
        // but we already checked ON_BOUNDARY.
        if (t > tol) {
          const hitPt = {
            x: pt.x + t * rayDir.x,
            y: pt.y + t * rayDir.y,
            z: pt.z + t * rayDir.z
          };

          if (this.isPointInFacePolygon(hitPt, oface.face, plane, model)) {
            // Check if hit point is too close to an edge (ambiguous boundary ray hit)
            if (this.isPointNearLoopEdges(hitPt, oface.face.outerLoop, tol * 5)) {
              ambiguousHit = true;
              break;
            }
            hits++;
          }
        }
      }

      if (!ambiguousHit) {
        return hits;
      }
    }

    return null;
  }

  private static isPointNearLoopEdges(pt: Point, loop: Loop, tol: number): boolean {
    if (!loop || !loop.orientedEdges) return false;
    for (const oe of loop.orientedEdges) {
      if (oe.edge && oe.edge.startVertex && oe.edge.endVertex) {
        const seg = { start: oe.edge.startVertex.geometry, end: oe.edge.endVertex.geometry };
        const distRes = DistancePredicates.pointSegmentDistance(pt, seg);
        if (distRes.classification === 'TRUE' && distRes.value !== null && distRes.value.distance <= tol) {
          return true;
        }
      }
    }
    return false;
  }

  public static getFacePlane(face: Face, orientation: Orientation = Orientation.FORWARD): Plane | null {
    if (!face || !face.outerLoop) return null;
    const vertices = this.getLoopVertices(face.outerLoop);
    if (vertices.length < 3) return null;

    let v0 = vertices[0];
    let vec1: Vector | null = null;
    let cross: Vector | null = null;

    // Find first non-zero edge
    for (let i = 1; i < vertices.length; i++) {
      const v = vertices[i];
      const d = { x: v.x - v0.x, y: v.y - v0.y, z: v.z - v0.z };
      if (Math.hypot(d.x, d.y, d.z) > 1e-12) {
        vec1 = d;
        // Find first non-collinear vertex
        for (let j = i + 1; j < vertices.length; j++) {
          const v2 = vertices[j];
          const d2 = { x: v2.x - v0.x, y: v2.y - v0.y, z: v2.z - v0.z };
          const c = VectorPredicates.crossProduct(vec1, d2).value;
          if (c && Math.hypot(c.x, c.y, c.z) > 1e-12) {
            cross = c;
            break;
          }
        }
        if (cross) break;
      }
    }

    if (!vec1 || !cross) return null;

    const normRes = VectorPredicates.normalize(cross);
    if (normRes.classification === 'INVALID' || !normRes.value) return null;

    let normal = normRes.value;
    if (orientation === Orientation.REVERSED) {
      normal = { x: -normal.x, y: -normal.y, z: -normal.z };
    }

    return {
      origin: v0,
      normal,
      xDir: VectorPredicates.normalize(vec1).value || vec1
    };
  }

  public static getLoopVertices(loop: Loop): Point[] {
    if (!loop || !loop.orientedEdges) return [];
    const pts: Point[] = [];
    for (const oe of loop.orientedEdges) {
      if (!oe.edge) continue;
      const v = oe.orientation === Orientation.REVERSED ? oe.edge.endVertex : oe.edge.startVertex;
      if (v && v.geometry) {
        pts.push(v.geometry);
      }
    }
    return pts;
  }

  public static projectPointTo2D(pt: Point, plane: Plane): { x: number; y: number } {
    const v: Vector = { x: pt.x - plane.origin.x, y: pt.y - plane.origin.y, z: pt.z - plane.origin.z };
    
    let uX = plane.xDir;
    if (!uX || Math.abs(VectorPredicates.dotProduct(uX, plane.normal).value || 0) > 0.99) {
      // Find a safe uX perpendicular to normal
      const N = plane.normal;
      uX = Math.abs(N.x) > 0.7 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
      const cross = VectorPredicates.crossProduct(uX, N).value!;
      uX = VectorPredicates.normalize(cross).value!;
    } else {
      uX = VectorPredicates.normalize(uX).value!;
    }

    const uY = VectorPredicates.crossProduct(plane.normal, uX).value!;

    const x = VectorPredicates.dotProduct(v, uX).value || 0;
    const y = VectorPredicates.dotProduct(v, uY).value || 0;

    return { x, y };
  }

  public static rayIntersectsFace(pt: Point, ray: Vector, face: Face, model: GeometricToleranceModel = GeometricTolerance.DEFAULT): boolean {
    const plane = this.getFacePlane(face);
    if (!plane) return false;

    const denomRes = VectorPredicates.dotProduct(ray, plane.normal);
    if (denomRes.classification === 'INVALID' || denomRes.value === null || Math.abs(denomRes.value) < 1e-12) {
      return false;
    }

    const denom = denomRes.value;
    const vecPO: Vector = { x: plane.origin.x - pt.x, y: plane.origin.y - pt.y, z: plane.origin.z - pt.z };
    const numerRes = VectorPredicates.dotProduct(vecPO, plane.normal);
    if (numerRes.classification === 'INVALID' || numerRes.value === null) return false;

    const t = numerRes.value / denom;
    if (t <= 1e-9) return false;

    const hitPt = {
      x: pt.x + t * ray.x,
      y: pt.y + t * ray.y,
      z: pt.z + t * ray.z
    };

    return this.isPointInFacePolygon(hitPt, face, plane, model);
  }

  public static getBestFitPlane(pts: Point[]): any {
    if (pts.length < 3) {
      return { origin: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 1, z: 0 } };
    }
    const origin = pts[0];
    let normal = { x: 0, y: 0, z: 0 };
    for (let i = 1; i < pts.length - 1; i++) {
      const v1 = { x: pts[i].x - origin.x, y: pts[i].y - origin.y, z: pts[i].z - origin.z };
      const v2 = { x: pts[i + 1].x - origin.x, y: pts[i + 1].y - origin.y, z: pts[i + 1].z - origin.z };
      normal.x += v1.y * v2.z - v1.z * v2.y;
      normal.y += v1.z * v2.x - v1.x * v2.z;
      normal.z += v1.x * v2.y - v1.y * v2.x;
    }
    const len = Math.hypot(normal.x, normal.y, normal.z);
    if (len < 1e-12) {
      return { origin, normal: { x: 0, y: 0, z: 1 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 1, z: 0 } };
    }
    normal.x /= len; normal.y /= len; normal.z /= len;

    let u = { x: 0, y: 0, z: 0 };
    if (Math.abs(normal.x) < 0.9) u = { x: 1, y: 0, z: 0 };
    else u = { x: 0, y: 1, z: 0 };

    const dotUN = u.x * normal.x + u.y * normal.y + u.z * normal.z;
    u.x -= dotUN * normal.x;
    u.y -= dotUN * normal.y;
    u.z -= dotUN * normal.z;
    const lenU = Math.hypot(u.x, u.y, u.z);
    u.x /= lenU; u.y /= lenU; u.z /= lenU;

    const v = {
      x: normal.y * u.z - normal.z * u.y,
      y: normal.z * u.x - normal.x * u.z,
      z: normal.x * u.y - normal.y * u.x
    };

    return { origin, normal, u, v };
  }
}
