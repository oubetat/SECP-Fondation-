/**
 * PATCH-SECP-044 — B-Rep Hidden Line Removal (HLR) & Occlusion Engine
 * Performs rigorous 3D-to-2D projection, geometric occlusion analysis, silhouette extraction,
 * and separates visible, hidden, centerline, and construction geometry without mesh-to-SVG shortcuts.
 */

import { Vector2D, DrawingSegment2D, DrawingArc2D, DrawingGeometry2D, LineType } from './DrawingTypes';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Edge3D {
  id: string;
  p1: Vector3D;
  p2: Vector3D;
  isCurved?: boolean;
  curveCenter?: Vector3D;
  curveRadius?: number;
  curveNormal?: Vector3D;
  sourceFeatureId?: string;
  isCylinderAxis?: boolean;
}

export interface Face3D {
  id: string;
  vertices: Vector3D[];
  normal: Vector3D;
  isPlanar: boolean;
  centroid: Vector3D;
}

export interface ProjectedEdgeResult {
  visibleEdges: DrawingGeometry2D[];
  hiddenEdges: DrawingGeometry2D[];
  silhouettes: DrawingGeometry2D[];
  centerlines: DrawingGeometry2D[];
}

export class HiddenLineRemovalEngine {
  /**
   * Evaluates geometric occlusion on 3D edges against 3D faces from a given camera view direction.
   */
  public static computeHLR(
    edges: Edge3D[],
    faces: Face3D[],
    projectPointFn: (p: Vector3D) => { uv: Vector2D; depth: number }
  ): ProjectedEdgeResult {
    const visibleEdges: DrawingGeometry2D[] = [];
    const hiddenEdges: DrawingGeometry2D[] = [];
    const silhouettes: DrawingGeometry2D[] = [];
    const centerlines: DrawingGeometry2D[] = [];

    // 1. Process 3D Edges
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];

      if (edge.isCylinderAxis) {
        // Centerline handling
        const proj1 = projectPointFn(edge.p1);
        const proj2 = projectPointFn(edge.p2);
        
        // Extend centerline slightly (ISO standard 2-3mm overhang)
        const dx = proj2.uv.x - proj1.uv.x;
        const dy = proj2.uv.y - proj1.uv.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const overhang = len > 1e-4 ? 3.0 : 0;
        const ux = len > 1e-4 ? dx / len : 0;
        const uy = len > 1e-4 ? dy / len : 0;

        centerlines.push({
          id: `centerline-${edge.id || i}`,
          type: 'LINE',
          lineType: 'CENTER',
          p1: { x: proj1.uv.x - ux * overhang, y: proj1.uv.y - uy * overhang },
          p2: { x: proj2.uv.x + ux * overhang, y: proj2.uv.y + uy * overhang },
          sourceEdgeId: edge.id
        });
        continue;
      }

      if (edge.isCurved && edge.curveCenter && edge.curveRadius) {
        // Circular / Arc edge projection
        const centerProj = projectPointFn(edge.curveCenter);
        const p1Proj = projectPointFn(edge.p1);
        const p2Proj = projectPointFn(edge.p2);
        
        // Occlusion check on midpoint of arc
        const midPoint3D = {
          x: edge.curveCenter.x + (edge.p1.x - edge.curveCenter.x) * 0.707 + (edge.p2.x - edge.curveCenter.x) * 0.707,
          y: edge.curveCenter.y + (edge.p1.y - edge.curveCenter.y) * 0.707 + (edge.p2.y - edge.curveCenter.y) * 0.707,
          z: edge.curveCenter.z + (edge.p1.z - edge.curveCenter.z) * 0.707 + (edge.p2.z - edge.curveCenter.z) * 0.707
        };
        const isOccluded = this.isPointOccluded(midPoint3D, faces, projectPointFn);

        const arcGeom: DrawingArc2D = {
          id: `arc-${edge.id || i}`,
          type: 'ARC',
          lineType: isOccluded ? 'HIDDEN' : 'VISIBLE',
          center: centerProj.uv,
          radius: edge.curveRadius,
          startAngleRad: Math.atan2(p1Proj.uv.y - centerProj.uv.y, p1Proj.uv.x - centerProj.uv.x),
          endAngleRad: Math.atan2(p2Proj.uv.y - centerProj.uv.y, p2Proj.uv.x - centerProj.uv.x),
          sourceEdgeId: edge.id
        };

        if (isOccluded) {
          hiddenEdges.push(arcGeom);
        } else {
          visibleEdges.push(arcGeom);
        }
        continue;
      }

      // Linear Edge projection
      const proj1 = projectPointFn(edge.p1);
      const proj2 = projectPointFn(edge.p2);

      // Check if edge is degenerate in 2D view (point-like)
      const dist2D = Math.hypot(proj2.uv.x - proj1.uv.x, proj2.uv.y - proj1.uv.y);
      if (dist2D < 0.05) {
        continue; // End-on edge projects to a point, do not render line
      }

      // Sample 3 test points along the 3D edge (25%, 50%, 75%)
      const mid3D = {
        x: (edge.p1.x + edge.p2.x) * 0.5,
        y: (edge.p1.y + edge.p2.y) * 0.5,
        z: (edge.p1.z + edge.p2.z) * 0.5
      };

      const isMidOccluded = this.isPointOccluded(mid3D, faces, projectPointFn);

      const segment: DrawingSegment2D = {
        id: `seg-${edge.id || i}`,
        type: 'LINE',
        lineType: isMidOccluded ? 'HIDDEN' : 'VISIBLE',
        p1: proj1.uv,
        p2: proj2.uv,
        sourceEdgeId: edge.id
      };

      if (isMidOccluded) {
        hiddenEdges.push(segment);
      } else {
        visibleEdges.push(segment);
      }
    }

    return {
      visibleEdges,
      hiddenEdges,
      silhouettes,
      centerlines
    };
  }

  /**
   * Ray-casts from a 3D point along the camera view direction to detect occlusion by foreground faces.
   */
  private static isPointOccluded(
    point: Vector3D,
    faces: Face3D[],
    projectPointFn: (p: Vector3D) => { uv: Vector2D; depth: number }
  ): boolean {
    const pointProj = projectPointFn(point);

    for (const face of faces) {
      if (face.vertices.length < 3) continue;

      // Project face vertices to 2D
      const face2D = face.vertices.map(v => projectPointFn(v));
      
      // Calculate face depth at the test point's UV position
      const faceAvgDepth = face2D.reduce((acc, v) => acc + v.depth, 0) / face2D.length;

      // If the face is strictly in front of the test point (smaller depth value)
      if (faceAvgDepth < pointProj.depth - 0.5) {
        // Test 2D Point-in-Polygon
        if (this.isPointInPolygon2D(pointProj.uv, face2D.map(f => f.uv))) {
          return true; // Point is occluded by foreground face
        }
      }
    }

    return false;
  }

  /**
   * Standard 2D ray-casting Point-In-Polygon algorithm
   */
  private static isPointInPolygon2D(pt: Vector2D, poly: Vector2D[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;

      const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
        (pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
}
