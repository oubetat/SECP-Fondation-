/**
 * SECP CAD Kernel — Surface & Curve Intersector for Booleans
 * Phase 2 (PATCH-019)
 */
import { Surface, Curve, Point, Plane, Vector } from '../geometry/GeometryContracts';
import { Face, Solid, TopoShapeEnum, Orientation } from '../topology/TopologyContracts';
import { SurfaceIntersectionCurve, BooleanDiagnostic } from './BooleanTypes';
import { BooleanClassifier } from './BooleanClassifier';
import { GeometricTolerance, GeometricToleranceModel } from '../predicates/GeometricTolerance';
import { GeometricRelations } from '../predicates/GeometricRelations';
import { VectorPredicates } from '../predicates/VectorPredicates';

export class BooleanIntersector {
  /**
   * Computes intersections between two B-Rep Solids.
   */
  public static intersectSolids(
    solidA: Solid,
    solidB: Solid,
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): {
    intersectionCurves: SurfaceIntersectionCurve[];
    diagnostics: BooleanDiagnostic[];
    unsupportedCount: number;
  } {
    const curves: SurfaceIntersectionCurve[] = [];
    const diagnostics: BooleanDiagnostic[] = [];
    let unsupportedCount = 0;

    if (!solidA || !solidA.outerShell || !solidB || !solidB.outerShell) {
      return { intersectionCurves: [], diagnostics, unsupportedCount: 0 };
    }

    const facesA = solidA.outerShell.orientedFaces.map(of => of.face).filter(Boolean);
    const facesB = solidB.outerShell.orientedFaces.map(of => of.face).filter(Boolean);

    for (const faceA of facesA) {
      const planeA = faceA.geometry ? (faceA.geometry.type === 'PLANE' ? faceA.geometry : null) : BooleanClassifier.getFacePlane(faceA);
      for (const faceB of facesB) {
        const planeB = faceB.geometry ? (faceB.geometry.type === 'PLANE' ? faceB.geometry : null) : BooleanClassifier.getFacePlane(faceB);

        let ic: SurfaceIntersectionCurve | null = null;

        if (planeA && planeB) {
          ic = this.intersectPlanes(faceA, planeA as any, faceB, planeB as any, model);
        } else {
          const surfA = faceA.geometry;
          const surfB = faceB.geometry;
          if (surfA && surfB) {
            if (surfA.type === 'PLANE' && surfB.type === 'CYLINDER') {
              ic = this.intersectPlaneCylinder(faceA, surfA as any, faceB, surfB as any, model);
            } else if (surfA.type === 'CYLINDER' && surfB.type === 'PLANE') {
              ic = this.intersectPlaneCylinder(faceB, surfB as any, faceA, surfA as any, model);
            } else if (surfA.type === 'PLANE' && surfB.type === 'SPHERE') {
              ic = this.intersectPlaneSphere(faceA, surfA as any, faceB, surfB as any, model);
            } else if (surfA.type === 'SPHERE' && surfB.type === 'PLANE') {
              ic = this.intersectPlaneSphere(faceB, surfB as any, faceA, surfA as any, model);
            }
          }
        }

        if (ic) {
          curves.push(ic);
        } else if (!planeA || !planeB) {
          unsupportedCount++;
          diagnostics.push({
            code: 'UNSUPPORTED_SURFACE_PAIR',
            message: `Surface intersection for ${faceA.geometry?.type || 'UNKNOWN'} vs ${faceB.geometry?.type || 'UNKNOWN'} not fully supported.`,
            severity: 'WARNING'
          });
        }
      }
    }

    return {
      intersectionCurves: curves,
      diagnostics,
      unsupportedCount
    };
  }

  /**
   * Intersection of a Plane and a Sphere -> Circle
   */
  private static intersectPlaneSphere(
    facePlane: Face,
    plane: Plane,
    faceSphere: Face,
    sphere: any,
    model: GeometricToleranceModel
  ): SurfaceIntersectionCurve | null {
    // Project sphere center onto plane
    const center = sphere.center || { x: 0, y: 0, z: 0 };
    const radius = sphere.radius || 1;

    const vecPO: Vector = { x: center.x - plane.origin.x, y: center.y - plane.origin.y, z: center.z - plane.origin.z };
    const d = VectorPredicates.dotProduct(vecPO, plane.normal).value || 0;

    if (Math.abs(d) > radius - model.absoluteLength) {
      return null; // No intersection or tangency only
    }

    const rInt = Math.sqrt(radius * radius - d * d);
    const centerInt: Point = {
      x: center.x - d * plane.normal.x,
      y: center.y - d * plane.normal.y,
      z: center.z - d * plane.normal.z
    };

    // This returns a circle. For the Boolean splitting, we need to clip it to face boundaries.
    // However, a Sphere is often a single face.
    // For simplicity in this kernel, we'll return a discretized sequence of points or a real circle curve.
    
    // We'll return a circle curve if it's within the face polygons.
    // Clipping a circle to a polygon is complex. For now, we'll return a polygon representation of the intersection circle.
    
    const points: Point[] = [];
    const numSegments = 32;
    
    // Find local X, Y on plane
    const N = plane.normal;
    let uRaw: Vector = Math.abs(N.x) > 0.7 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const X = VectorPredicates.normalize(VectorPredicates.crossProduct(uRaw, N).value!).value!;
    const Y = VectorPredicates.crossProduct(N, X).value!;

    for (let i = 0; i <= numSegments; i++) {
      const angle = (i / numSegments) * Math.PI * 2;
      const pt: Point = {
        x: centerInt.x + rInt * (Math.cos(angle) * X.x + Math.sin(angle) * Y.x),
        y: centerInt.y + rInt * (Math.cos(angle) * X.y + Math.sin(angle) * Y.y),
        z: centerInt.z + rInt * (Math.cos(angle) * X.z + Math.sin(angle) * Y.z)
      };
      points.push(pt);
    }

    return {
      id: `int_curve_${facePlane.id}_${faceSphere.id}`,
      sourceSurfaceAId: facePlane.id,
      sourceSurfaceBId: faceSphere.id,
      faceA: { id: facePlane.id },
      faceB: { id: faceSphere.id },
      curve3d: { evaluate: (t) => points[Math.floor(t * numSegments)], domain: () => ({ uMin: 0, uMax: 1 }) },
      points3d: points,
      segments: points.slice(0, -1).map((p, i) => ({ start: p, end: points[i + 1] })),
      intersectionType: 'PLANE_SPHERE',
      tolerance: model.absoluteLength,
      provenance: 'PlaneSphereIntersection'
    };
  }

  /**
   * Intersection of a Plane and a Cylinder -> Ellipse or Lines
   */
  private static intersectPlaneCylinder(
    facePlane: Face,
    plane: Plane,
    faceCyl: Face,
    cyl: any,
    model: GeometricToleranceModel
  ): SurfaceIntersectionCurve | null {
    // Basic implementation for axis-aligned cylinders
    // If plane is perpendicular to axis -> Circle
    // If plane is parallel to axis -> 2 Lines
    // Else -> Ellipse
    
    // For now, let's just handle the case where plane is parallel to cylinder axis (Box cutting Cylinder)
    const cylAxis = cyl.axis?.direction || { x: 0, y: 0, z: 1 };
    const dot = Math.abs(VectorPredicates.dotProduct(plane.normal, cylAxis).value || 0);
    
    if (dot < 1e-6) {
       // Parallel: Plane intersects cylinder in 2 lines if distance < radius
       const cylOrigin = cyl.axis?.location || { x: 0, y: 0, z: 0 };
       const vec: Vector = { x: cylOrigin.x - plane.origin.x, y: cylOrigin.y - plane.origin.y, z: cylOrigin.z - plane.origin.z };
       const d = VectorPredicates.dotProduct(vec, plane.normal).value || 0;
       
       if (Math.abs(d) > cyl.radius - model.absoluteLength) return null;
       
       // Calculate the 2 lines
       // ... this is where it gets detailed.
    }

    return null; // Fallback for complex cases
  }

  /**
   * Computes the exact 3D line segment intersection between two planar faces.
   */
  public static intersectPlanes(
    faceA: Face,
    planeA: Plane,
    faceB: Face,
    planeB: Plane,
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): SurfaceIntersectionCurve | null {
    const relRes = GeometricRelations.planePlaneRelation(planeA, planeB, model);
    if (relRes.classification !== 'INTERSECTING') {
      return null;
    }

    // Line direction = normalA x normalB
    const LRes = VectorPredicates.crossProduct(planeA.normal, planeB.normal);
    if (LRes.classification === 'INVALID' || !LRes.value) return null;

    const L = LRes.value;
    const lenSqL = L.x * L.x + L.y * L.y + L.z * L.z;
    if (lenSqL <= model.absoluteLength * model.absoluteLength) return null;

    const normL = Math.sqrt(lenSqL);
    const dirL: Vector = { x: L.x / normL, y: L.y / normL, z: L.z / normL };

    // Point on intersection line: P0
    const d1 = VectorPredicates.dotProduct(planeA.origin, planeA.normal).value || 0;
    const d2 = VectorPredicates.dotProduct(planeB.origin, planeB.normal).value || 0;

    // (d1 * N2 - d2 * N1) x L / ||L||^2
    const term1: Vector = {
      x: d1 * planeB.normal.x - d2 * planeA.normal.x,
      y: d1 * planeB.normal.y - d2 * planeA.normal.y,
      z: d1 * planeB.normal.z - d2 * planeA.normal.z
    };

    const p0Cross = VectorPredicates.crossProduct(term1, L).value;
    if (!p0Cross) return null;

    const originL: Point = {
      x: p0Cross.x / lenSqL,
      y: p0Cross.y / lenSqL,
      z: p0Cross.z / lenSqL
    };

    const line = { origin: originL, direction: dirL };

    // Project face A and face B boundary vertices onto the intersection line
    const vertsA = BooleanClassifier.getLoopVertices(faceA.outerLoop);
    const vertsB = BooleanClassifier.getLoopVertices(faceB.outerLoop);
    if (vertsA.length < 3 || vertsB.length < 3) return null;

    const segmentA = this.clipLineToPolygon3D(line, vertsA, planeA, model);
    const segmentB = this.clipLineToPolygon3D(line, vertsB, planeB, model);

    if (!segmentA || !segmentB) return null;

    // Intersect the two 1D parametric intervals along the line
    const overlap = this.find1DParametricOverlap(segmentA, segmentB);
    if (!overlap) return null;

    const pStart = {
      x: line.origin.x + overlap.uMin * line.direction.x,
      y: line.origin.y + overlap.uMin * line.direction.y,
      z: line.origin.z + overlap.uMin * line.direction.z
    };

    const pEnd = {
      x: line.origin.x + overlap.uMax * line.direction.x,
      y: line.origin.y + overlap.uMax * line.direction.y,
      z: line.origin.z + overlap.uMax * line.direction.z
    };

    const lineLength = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y, pEnd.z - pStart.z);
    const scale = Math.max(Math.abs(pStart.x), Math.abs(pStart.y), Math.abs(pStart.z));
    const tol = GeometricTolerance.getScaleAwareLengthTolerance(scale, model);

    if (lineLength <= tol) {
      return null; // Zero-length intersection line
    }

    const linearCurve: Curve = {
      evaluate: (t: number) => ({
        x: pStart.x + t * (pEnd.x - pStart.x),
        y: pStart.y + t * (pEnd.y - pStart.y),
        z: pStart.z + t * (pEnd.z - pStart.z)
      }),
      domain: () => ({ uMin: 0, uMax: 1 })
    };

    return {
      id: `int_curve_${faceA.id}_${faceB.id}`,
      sourceSurfaceAId: faceA.id,
      sourceSurfaceBId: faceB.id,
      faceA: { id: faceA.id },
      faceB: { id: faceB.id },
      curve3d: linearCurve,
      points3d: [pStart, pEnd],
      segments: [{ start: pStart, end: pEnd }],
      intersectionType: 'PLANE_PLANE',
      tolerance: tol,
      provenance: `PlanePlaneIntersection(${faceA.id}, ${faceB.id})`
    };
  }

  private static clipLineToPolygon3D(
    line: { origin: Point; direction: Vector },
    vertices: Point[],
    plane: Plane,
    model: GeometricToleranceModel
  ): { uMin: number; uMax: number } | null {
    if (vertices.length < 3) return null;

    // Build orthonormal 2D frame (X, Y) on plane
    const N = plane.normal;
    let uX = plane.xDir || (Math.abs(N.x) > 0.7 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 });
    
    const xCross = VectorPredicates.crossProduct(uX, N).value;
    if (!xCross || Math.hypot(xCross.x, xCross.y, xCross.z) < 1e-12) {
      uX = Math.abs(N.x) > 0.7 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
      const cross2 = VectorPredicates.crossProduct(uX, N).value!;
      uX = VectorPredicates.normalize(cross2).value!;
    } else {
      uX = VectorPredicates.normalize(xCross).value!;
    }

    const uY = VectorPredicates.crossProduct(N, uX).value!;
    const X = uX;
    const Y = uY;

    const O = plane.origin;
    const project3Dto2D = (pt: Point) => {
      const dx = pt.x - O.x;
      const dy = pt.y - O.y;
      const dz = pt.z - O.z;
      return {
        u: dx * X.x + dy * X.y + dz * X.z,
        v: dx * Y.x + dy * Y.y + dz * Y.z
      };
    };

    const p02d = project3Dto2D(line.origin);
    const d2d = {
      u: line.direction.x * X.x + line.direction.y * X.y + line.direction.z * X.z,
      v: line.direction.x * Y.x + line.direction.y * Y.y + line.direction.z * Y.z
    };

    const lambdas: number[] = [];
    const eps = model.absoluteLength;

    const n = vertices.length;
    for (let i = 0; i < n; i++) {
      const vA = project3Dto2D(vertices[i]);
      const vB = project3Dto2D(vertices[(i + 1) % n]);

      // Check if vA lies on line
      const diffA = { u: vA.u - p02d.u, v: vA.v - p02d.v };
      const distA = Math.abs(diffA.u * d2d.v - diffA.v * d2d.u);
      if (distA < eps) {
        lambdas.push(diffA.u * d2d.u + diffA.v * d2d.v);
      }

      const delta = { u: vB.u - vA.u, v: vB.v - vA.v };
      const det = d2d.u * delta.v - d2d.v * delta.u;

      if (Math.abs(det) < 1e-12) {
        // Line and segment are parallel/collinear in 2D
        continue;
      }

      const diff = { u: vA.u - p02d.u, v: vA.v - p02d.v };
      const lambda = (diff.u * delta.v - diff.v * delta.u) / det;
      const t = (diff.u * d2d.v - diff.v * d2d.u) / det;

      if (t > 1e-9 && t < 1 - 1e-9) {
        lambdas.push(lambda);
      }
    }

    if (lambdas.length < 2) return null;

    const minU = Math.min(...lambdas);
    const maxU = Math.max(...lambdas);

    if (maxU - minU <= model.absoluteLength) return null;

    return { uMin: minU, uMax: maxU };
  }

  private static find1DParametricOverlap(
    segA: { uMin: number; uMax: number },
    segB: { uMin: number; uMax: number }
  ): { uMin: number; uMax: number } | null {
    const uMin = Math.max(segA.uMin, segB.uMin);
    const uMax = Math.min(segA.uMax, segB.uMax);

    if (uMax <= uMin) {
      return null;
    }

    return { uMin, uMax };
  }
}
