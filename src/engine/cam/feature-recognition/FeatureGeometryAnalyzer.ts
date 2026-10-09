/**
 * SECP Industrial OS v2 — CAM Production Engine
 * PATCH-255 — Feature Geometry Analyzer
 */

import { Vector3D } from '../../cadKernel';
import { Face, Edge, Vertex, Loop } from '../../cad-kernel/topology/TopologyContracts';
import { Point, Surface, Curve } from '../../cad-kernel/geometry/GeometryContracts';

export interface FaceGeometryInfo {
  faceId: string;
  surfaceType: 'PLANE' | 'CYLINDER' | 'CONE' | 'SPHERE' | 'TORUS' | 'NURBS' | 'OTHER';
  areaMm2: number;
  normal: Vector3D;
  centroid: Vector3D;
  boundsMm: {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
  };
  cylinderParams?: {
    radiusMm: number;
    diameterMm: number;
    axisDirection: Vector3D;
    axisOrigin: Vector3D;
    heightMm: number;
    isConcaveToMaterial: boolean;
  };
  coneParams?: {
    halfAngleDeg: number;
    apex: Vector3D;
    axisDirection: Vector3D;
    topRadiusMm: number;
    bottomRadiusMm: number;
  };
  planeParams?: {
    origin: Vector3D;
    normal: Vector3D;
  };
}

export class FeatureGeometryAnalyzer {
  private static readonly EPSILON = 1e-5;

  /**
   * Evaluates geometric properties of a B-Rep face
   */
  public static analyzeFaceGeometry(face: Face): FaceGeometryInfo {
    const surface = face.geometry;
    const surfaceType = this.classifySurfaceType(surface);
    const vertices = this.extractFaceVertices(face);
    const bounds = this.calculateBounds(vertices);
    const centroid = this.calculateCentroid(vertices);
    const normal = this.calculateFaceNormal(face, centroid);
    const areaMm2 = this.estimateFaceArea(face, bounds);

    const info: FaceGeometryInfo = {
      faceId: face.id,
      surfaceType,
      areaMm2,
      normal,
      centroid,
      boundsMm: bounds,
    };

    if (surfaceType === 'PLANE') {
      info.planeParams = {
        origin: surface.origin ? { x: surface.origin.x * 1000, y: surface.origin.y * 1000, z: surface.origin.z * 1000 } : centroid,
        normal,
      };
    } else if (surfaceType === 'CYLINDER') {
      info.cylinderParams = this.extractCylinderParams(face, vertices, bounds);
    } else if (surfaceType === 'CONE') {
      info.coneParams = this.extractConeParams(face, vertices, bounds);
    }

    return info;
  }

  /**
   * Classify surface type based on analytical surface or NURBS evaluation
   */
  public static classifySurfaceType(surface: Surface): 'PLANE' | 'CYLINDER' | 'CONE' | 'SPHERE' | 'TORUS' | 'NURBS' | 'OTHER' {
    if (!surface) return 'PLANE';
    if (surface.type) {
      const t = surface.type.toUpperCase();
      if (t.includes('PLANE')) return 'PLANE';
      if (t.includes('CYLINDER')) return 'CYLINDER';
      if (t.includes('CONE')) return 'CONE';
      if (t.includes('SPHERE')) return 'SPHERE';
      if (t.includes('TORUS')) return 'TORUS';
      if (t.includes('NURBS') || t.includes('B_SPLINE')) return 'NURBS';
    }
    return 'PLANE';
  }

  /**
   * Extracts cylinder parameters from face geometry & loops
   */
  private static extractCylinderParams(face: Face, vertices: Vector3D[], bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }) {
    const dx = bounds.maxX - bounds.minX;
    const dy = bounds.maxY - bounds.minY;
    const dz = bounds.maxZ - bounds.minZ;

    let radiusMm = 0;
    let heightMm = 0;
    let axisDirection: Vector3D = { x: 0, y: 0, z: 1 };
    let axisOrigin: Vector3D = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };

    // Determine orientation along major axis
    if (dz >= dx && dz >= dy) {
      // Cylinder along Z
      axisDirection = { x: 0, y: 0, z: 1 };
      radiusMm = Math.max(dx, dy) / 2;
      heightMm = dz;
    } else if (dx >= dy && dx >= dz) {
      // Cylinder along X
      axisDirection = { x: 1, y: 0, z: 0 };
      radiusMm = Math.max(dy, dz) / 2;
      heightMm = dx;
    } else {
      // Cylinder along Y
      axisDirection = { x: 0, y: 1, z: 0 };
      radiusMm = Math.max(dx, dz) / 2;
      heightMm = dy;
    }

    if (radiusMm <= 0) radiusMm = 5.0;
    if (heightMm <= 0) heightMm = 10.0;

    return {
      radiusMm,
      diameterMm: radiusMm * 2,
      axisDirection,
      axisOrigin,
      heightMm,
      isConcaveToMaterial: true, // Will be verified with topology
    };
  }

  /**
   * Extract conical params (countersinks, taper holes)
   */
  private static extractConeParams(face: Face, vertices: Vector3D[], bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }) {
    const dz = bounds.maxZ - bounds.minZ;
    return {
      halfAngleDeg: 45, // 90° standard countersink or 60° (118° drill point)
      apex: { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2, z: bounds.minZ },
      axisDirection: { x: 0, y: 0, z: 1 },
      topRadiusMm: Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2,
      bottomRadiusMm: Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 4,
    };
  }

  /**
   * Collects all vertex coordinates in millimeters
   */
  public static extractFaceVertices(face: Face): Vector3D[] {
    const pts: Vector3D[] = [];
    if (!face.outerLoop || !face.outerLoop.orientedEdges) {
      return [{ x: 0, y: 0, z: 0 }];
    }

    for (const oe of face.outerLoop.orientedEdges) {
      if (oe.edge) {
        if (oe.edge.startVertex?.geometry) {
          pts.push({
            x: oe.edge.startVertex.geometry.x * 1000,
            y: oe.edge.startVertex.geometry.y * 1000,
            z: oe.edge.startVertex.geometry.z * 1000,
          });
        }
        if (oe.edge.endVertex?.geometry) {
          pts.push({
            x: oe.edge.endVertex.geometry.x * 1000,
            y: oe.edge.endVertex.geometry.y * 1000,
            z: oe.edge.endVertex.geometry.z * 1000,
          });
        }
      }
    }

    if (pts.length === 0) {
      pts.push({ x: 0, y: 0, z: 0 });
    }
    return pts;
  }

  /**
   * Compute bounding box in millimeters
   */
  public static calculateBounds(vertices: Vector3D[]) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const v of vertices) {
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
      if (v.z < minZ) minZ = v.z;
      if (v.z > maxZ) maxZ = v.z;
    }

    if (minX === Infinity) {
      return { minX: 0, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 10 };
    }

    return { minX, maxX, minY, maxY, minZ, maxZ };
  }

  /**
   * Compute centroid in millimeters
   */
  public static calculateCentroid(vertices: Vector3D[]): Vector3D {
    if (vertices.length === 0) return { x: 0, y: 0, z: 0 };
    let sx = 0, sy = 0, sz = 0;
    for (const v of vertices) {
      sx += v.x;
      sy += v.y;
      sz += v.z;
    }
    return {
      x: sx / vertices.length,
      y: sy / vertices.length,
      z: sz / vertices.length,
    };
  }

  /**
   * Compute normal vector (normalized)
   */
  public static calculateFaceNormal(face: Face, centroid: Vector3D): Vector3D {
    if (face.geometry && face.geometry.normal) {
      const n = face.geometry.normal;
      const len = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z) || 1;
      return { x: n.x / len, y: n.y / len, z: n.z / len };
    }

    // Fallback: estimate from loop cross product
    const verts = this.extractFaceVertices(face);
    if (verts.length >= 3) {
      const v0 = verts[0];
      const v1 = verts[1];
      const v2 = verts[2];

      const ax = v1.x - v0.x;
      const ay = v1.y - v0.y;
      const az = v1.z - v0.z;

      const bx = v2.x - v0.x;
      const by = v2.y - v0.y;
      const bz = v2.z - v0.z;

      const nx = ay * bz - az * by;
      const ny = az * bx - ax * bz;
      const nz = ax * by - ay * bx;

      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len > 1e-6) {
        return { x: nx / len, y: ny / len, z: nz / len };
      }
    }

    return { x: 0, y: 0, z: 1 };
  }

  /**
   * Estimate surface area in mm^2
   */
  public static estimateFaceArea(face: Face, bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }): number {
    const dx = Math.max(0.01, bounds.maxX - bounds.minX);
    const dy = Math.max(0.01, bounds.maxY - bounds.minY);
    const dz = Math.max(0.01, bounds.maxZ - bounds.minZ);

    if (face.geometry?.type?.toUpperCase().includes('CYLINDER')) {
      const r = Math.max(dx, dy) / 2;
      const h = dz;
      return 2 * Math.PI * r * h;
    }

    // For planar faces, approximate projected area
    return Math.max(dx * dy, Math.max(dy * dz, dz * dx));
  }

  /**
   * Check if two vectors are parallel
   */
  public static areParallel(v1: Vector3D, v2: Vector3D, tol = 1e-3): boolean {
    const dot = Math.abs(v1.x * v2.x + v1.y * v2.y + v1.z * v2.z);
    return Math.abs(dot - 1.0) < tol;
  }

  /**
   * Check if two vectors are perpendicular
   */
  public static arePerpendicular(v1: Vector3D, v2: Vector3D, tol = 1e-3): boolean {
    const dot = Math.abs(v1.x * v2.x + v1.y * v2.y + v1.z * v2.z);
    return dot < tol;
  }
}
