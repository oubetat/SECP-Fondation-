/**
 * SECP Industrial OS v2 — CAD Benchmark Battery
 * Independent Analytical & Mathematical Oracles
 * 
 * Provides pure mathematical ground-truth implementations that do NOT rely on SECP CAD internal logic.
 */

import { OracleType, BenchmarkOracleSpec } from './types';

export class CADBenchmarkOracle {
  /**
   * Analytical Box (Cuboid) Oracle
   */
  public static boxOracle(dx: number, dy: number, dz: number) {
    const volume = dx * dy * dz;
    const surfaceArea = 2 * (dx * dy + dy * dz + dz * dx);
    const cog = { x: dx / 2, y: dy / 2, z: dz / 2 };
    const eulerCharacteristic = 2; // For any simply connected solid polyhedron: V - E + F = 2
    const vertexCount = 8;
    const edgeCount = 12;
    const faceCount = 6;
    return { volume, surfaceArea, cog, eulerCharacteristic, vertexCount, edgeCount, faceCount };
  }

  /**
   * Analytical Cylinder Oracle
   */
  public static cylinderOracle(radius: number, height: number) {
    const volume = Math.PI * radius * radius * height;
    const lateralArea = 2 * Math.PI * radius * height;
    const baseArea = 2 * (Math.PI * radius * radius);
    const surfaceArea = lateralArea + baseArea;
    const cog = { x: 0, y: 0, z: height / 2 };
    return { volume, surfaceArea, cog };
  }

  /**
   * Analytical Sphere Oracle
   */
  public static sphereOracle(radius: number) {
    const volume = (4 / 3) * Math.PI * Math.pow(radius, 3);
    const surfaceArea = 4 * Math.PI * Math.pow(radius, 2);
    const cog = { x: 0, y: 0, z: 0 };
    return { volume, surfaceArea, cog };
  }

  /**
   * Analytical Cone Oracle
   */
  public static coneOracle(radius: number, height: number) {
    const volume = (1 / 3) * Math.PI * Math.pow(radius, 2) * height;
    const slantHeight = Math.sqrt(radius * radius + height * height);
    const surfaceArea = Math.PI * radius * (radius + slantHeight);
    const cog = { x: 0, y: 0, z: height / 4 };
    return { volume, surfaceArea, cog };
  }

  /**
   * Analytical Torus Oracle
   */
  public static torusOracle(majorRadius: number, minorRadius: number) {
    const volume = 2 * Math.PI * Math.PI * majorRadius * Math.pow(minorRadius, 2);
    const surfaceArea = 4 * Math.PI * Math.PI * majorRadius * minorRadius;
    const cog = { x: 0, y: 0, z: 0 };
    const eulerCharacteristic = 0; // Genus 1 torus: V - E + F = 2(1 - 1) = 0
    return { volume, surfaceArea, cog, eulerCharacteristic };
  }

  /**
   * Independent NURBS 90-degree Circular Arc Exact Oracle
   * Standard quadratic rational Bezier curve:
   * P0=(R, 0), P1=(R, R), P2=(0, R), weights = (1, sqrt(2)/2, 1)
   * Exact evaluation at u: x(u) = R * cos(theta(u)), y(u) = R * sin(theta(u))
   */
  public static nurbsQuarterCircleOracle(radius: number, u: number): { x: number; y: number; z: number } {
    // Exact rational quadratic formulation:
    // x(u) = R * (1 - u^2) / (1 + u^2) for standard rational half-angle,
    // or through trigonometric parametric equation:
    const theta = u * (Math.PI / 2);
    return {
      x: radius * Math.cos(theta),
      y: radius * Math.sin(theta),
      z: 0
    };
  }

  /**
   * Independent de Casteljau / Bernstein evaluation for Cubic Bezier
   */
  public static cubicBezierOracle(
    p0: { x: number; y: number; z: number },
    p1: { x: number; y: number; z: number },
    p2: { x: number; y: number; z: number },
    p3: { x: number; y: number; z: number },
    u: number
  ): { x: number; y: number; z: number } {
    const b0 = Math.pow(1 - u, 3);
    const b1 = 3 * Math.pow(1 - u, 2) * u;
    const b2 = 3 * (1 - u) * Math.pow(u, 2);
    const b3 = Math.pow(u, 3);

    return {
      x: b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x,
      y: b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y,
      z: b0 * p0.z + b1 * p1.z + b2 * p2.z + b3 * p3.z
    };
  }

  /**
   * Independent Euler-Poincaré Formula: V - E + F - (L - F) - 2(S - G) = 0
   * For simple polyhedral shells: V - E + F = 2(S - G)
   */
  public static eulerPoincareOracle(V: number, E: number, F: number, S = 1, G = 0): {
    expectedEulerChar: number;
    actualEulerChar: number;
    isValidTopology: boolean;
  } {
    const expected = 2 * (S - G);
    const actual = V - E + F;
    return {
      expectedEulerChar: expected,
      actualEulerChar: actual,
      isValidTopology: actual === expected
    };
  }

  /**
   * Independent 2D Triangle Barycentric Containment
   */
  public static pointInTriangleOracle(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number
  ): { isInside: boolean; isOnBoundary: boolean; alpha: number; beta: number; gamma: number } {
    const denom = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(denom) < 1e-15) {
      return { isInside: false, isOnBoundary: false, alpha: 0, beta: 0, gamma: 0 };
    }
    const alpha = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / denom;
    const beta = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / denom;
    const gamma = 1.0 - alpha - beta;

    const eps = 1e-9;
    const isInside = alpha >= -eps && beta >= -eps && gamma >= -eps;
    const isOnBoundary = isInside && (Math.abs(alpha) < eps || Math.abs(beta) < eps || Math.abs(gamma) < eps);

    return { isInside, isOnBoundary, alpha, beta, gamma };
  }

  /**
   * Independent Boolean Box Intersection Oracle (Axis Aligned)
   */
  public static boxIntersectionVolumeOracle(
    boxA: any,
    boxB: any
  ): number {
    const minAx = boxA.minX ?? boxA.min?.x ?? 0;
    const maxAx = boxA.maxX ?? boxA.max?.x ?? 0;
    const minAy = boxA.minY ?? boxA.min?.y ?? 0;
    const maxAy = boxA.maxY ?? boxA.max?.y ?? 0;
    const minAz = boxA.minZ ?? boxA.min?.z ?? 0;
    const maxAz = boxA.maxZ ?? boxA.max?.z ?? 0;

    const minBx = boxB.minX ?? boxB.min?.x ?? 0;
    const maxBx = boxB.maxX ?? boxB.max?.x ?? 0;
    const minBy = boxB.minY ?? boxB.min?.y ?? 0;
    const maxBy = boxB.maxY ?? boxB.max?.y ?? 0;
    const minBz = boxB.minZ ?? boxB.min?.z ?? 0;
    const maxBz = boxB.maxZ ?? boxB.max?.z ?? 0;

    const overlapX = Math.max(0, Math.min(maxAx, maxBx) - Math.max(minAx, minBx));
    const overlapY = Math.max(0, Math.min(maxAy, maxBy) - Math.max(minAy, minBy));
    const overlapZ = Math.max(0, Math.min(maxAz, maxBz) - Math.max(minAz, minBz));
    return overlapX * overlapY * overlapZ;
  }

  /**
   * Independent Boolean Box Union Volume Oracle (Axis Aligned)
   */
  public static boxUnionVolumeOracle(
    boxA: any,
    boxB: any
  ): number {
    const minAx = boxA.minX ?? boxA.min?.x ?? 0;
    const maxAx = boxA.maxX ?? boxA.max?.x ?? 0;
    const minAy = boxA.minY ?? boxA.min?.y ?? 0;
    const maxAy = boxA.maxY ?? boxA.max?.y ?? 0;
    const minAz = boxA.minZ ?? boxA.min?.z ?? 0;
    const maxAz = boxA.maxZ ?? boxA.max?.z ?? 0;

    const minBx = boxB.minX ?? boxB.min?.x ?? 0;
    const maxBx = boxB.maxX ?? boxB.max?.x ?? 0;
    const minBy = boxB.minY ?? boxB.min?.y ?? 0;
    const maxBy = boxB.maxY ?? boxB.max?.y ?? 0;
    const minBz = boxB.minZ ?? boxB.min?.z ?? 0;
    const maxBz = boxB.maxZ ?? boxB.max?.z ?? 0;

    const volA = (maxAx - minAx) * (maxAy - minAy) * (maxAz - minAz);
    const volB = (maxBx - minBx) * (maxBy - minBy) * (maxBz - minBz);
    const intersectVol = CADBenchmarkOracle.boxIntersectionVolumeOracle(boxA, boxB);
    return volA + volB - intersectVol;
  }

  /**
   * Point to Plane Distance Oracle
   */
  public static pointToPlaneDistanceOracle(
    pt: { x: number; y: number; z: number },
    planePoint: { x: number; y: number; z: number },
    planeNormal: { x: number; y: number; z: number }
  ): number {
    const len = Math.sqrt(planeNormal.x ** 2 + planeNormal.y ** 2 + planeNormal.z ** 2);
    if (len < 1e-15) return 0;
    const nx = planeNormal.x / len;
    const ny = planeNormal.y / len;
    const nz = planeNormal.z / len;
    const dx = pt.x - planePoint.x;
    const dy = pt.y - planePoint.y;
    const dz = pt.z - planePoint.z;
    return Math.abs(dx * nx + dy * ny + dz * nz);
  }

  /**
   * Transform 3D Points by Euler Angles & Translation
   */
  public static transformPointOracle(
    pt: { x: number; y: number; z: number },
    translation: { x: number; y: number; z: number },
    rotRad: number | { x?: number; y?: number; z?: number }
  ): { x: number; y: number; z: number } {
    const rx = typeof rotRad === 'number' ? 0 : (rotRad.x ?? 0);
    const ry = typeof rotRad === 'number' ? 0 : (rotRad.y ?? 0);
    const rz = typeof rotRad === 'number' ? rotRad : (rotRad.z ?? 0);

    // Rotation Z * Y * X
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const cz = Math.cos(rz), sz = Math.sin(rz);

    // R = Rz * Ry * Rx
    const r00 = cz * cy;
    const r01 = cz * sy * sx - sz * cx;
    const r02 = cz * sy * cx + sz * sx;

    const r10 = sz * cy;
    const r11 = sz * sy * sx + cz * cx;
    const r12 = sz * sy * cx - cz * sx;

    const r20 = -sy;
    const r21 = cy * sx;
    const r22 = cy * cx;

    return {
      x: r00 * pt.x + r01 * pt.y + r02 * pt.z + translation.x,
      y: r10 * pt.x + r11 * pt.y + r12 * pt.z + translation.y,
      z: r20 * pt.x + r21 * pt.y + r22 * pt.z + translation.z
    };
  }
}
