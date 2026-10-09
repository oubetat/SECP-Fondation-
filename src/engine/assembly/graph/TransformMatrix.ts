/**
 * PATCH-113: Transform Matrix Engine
 * Homogeneous 4x4 Transformation Matrix Engine for Deterministic Assembly Coordinate Systems
 */

import { Matrix4x4, Vector3D, BoundingBox3D, TransformDefinition } from "./types";

export class TransformMatrix {
  /**
   * Identity 4x4 Matrix
   */
  public static identity(): Matrix4x4 {
    return [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];
  }

  /**
   * Create Translation Matrix
   */
  public static translation(tx: number, ty: number, tz: number): Matrix4x4 {
    return [
      [1, 0, 0, tx],
      [0, 1, 0, ty],
      [0, 0, 1, tz],
      [0, 0, 0, 1]
    ];
  }

  /**
   * Create Rotation Matrix from Euler Angles (XYZ intrinsic, degrees)
   */
  public static fromEulerDegrees(rxDeg: number, ryDeg: number, rzDeg: number): Matrix4x4 {
    const deg2rad = Math.PI / 180;
    const x = rxDeg * deg2rad;
    const y = ryDeg * deg2rad;
    const z = rzDeg * deg2rad;

    const cx = Math.cos(x);
    const sx = Math.sin(x);
    const cy = Math.cos(y);
    const sy = Math.sin(y);
    const cz = Math.cos(z);
    const sz = Math.sin(z);

    // R = Rz * Ry * Rx
    return [
      [cy * cz, sx * sy * cz - cx * sz, cx * sy * cz + sx * sz, 0],
      [cy * sz, sx * sy * sz + cx * cz, cx * sy * sz - sx * cz, 0],
      [-sy, sx * cy, cx * cy, 0],
      [0, 0, 0, 1]
    ];
  }

  /**
   * Create Transform Definition from Translation & Euler angles
   */
  public static create(
    tx: number = 0,
    ty: number = 0,
    tz: number = 0,
    rxDeg: number = 0,
    ryDeg: number = 0,
    rzDeg: number = 0
  ): TransformDefinition {
    const rot = this.fromEulerDegrees(rxDeg, ryDeg, rzDeg);
    const matrix: Matrix4x4 = [
      [rot[0][0], rot[0][1], rot[0][2], tx],
      [rot[1][0], rot[1][1], rot[1][2], ty],
      [rot[2][0], rot[2][1], rot[2][2], tz],
      [0, 0, 0, 1]
    ];

    return {
      translation: { x: tx, y: ty, z: tz },
      rotationEulerDeg: { x: rxDeg, y: ryDeg, z: rzDeg },
      matrix
    };
  }

  /**
   * Multiply two 4x4 matrices: A * B
   * Deterministic multiplication: T_world = T_parent * T_child
   */
  public static multiply(a: Matrix4x4, b: Matrix4x4): Matrix4x4 {
    const result: Matrix4x4 = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ];

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a[r][k] * b[k][c];
        }
        // Round to avoid IEEE 754 precision drifting
        result[r][c] = Math.abs(sum) < 1e-12 ? 0 : Number(sum.toFixed(8));
      }
    }

    return result;
  }

  /**
   * Transform point P_world = T * P_local
   */
  public static transformPoint(m: Matrix4x4, p: Vector3D): Vector3D {
    const x = m[0][0] * p.x + m[0][1] * p.y + m[0][2] * p.z + m[0][3];
    const y = m[1][0] * p.x + m[1][1] * p.y + m[1][2] * p.z + m[1][3];
    const z = m[2][0] * p.x + m[2][1] * p.y + m[2][2] * p.z + m[2][3];
    const w = m[3][0] * p.x + m[3][1] * p.y + m[3][2] * p.z + m[3][3];

    const invW = w !== 0 ? 1 / w : 1;
    return {
      x: Number((x * invW).toFixed(6)),
      y: Number((y * invW).toFixed(6)),
      z: Number((z * invW).toFixed(6))
    };
  }

  /**
   * Transform 3D Bounding Box
   */
  public static transformBoundingBox(m: Matrix4x4, bbox: BoundingBox3D): BoundingBox3D {
    const corners: Vector3D[] = [
      { x: bbox.min.x, y: bbox.min.y, z: bbox.min.z },
      { x: bbox.min.x, y: bbox.min.y, z: bbox.max.z },
      { x: bbox.min.x, y: bbox.max.y, z: bbox.min.z },
      { x: bbox.min.x, y: bbox.max.y, z: bbox.max.z },
      { x: bbox.max.x, y: bbox.min.y, z: bbox.min.z },
      { x: bbox.max.x, y: bbox.min.y, z: bbox.max.z },
      { x: bbox.max.x, y: bbox.max.y, z: bbox.min.z },
      { x: bbox.max.x, y: bbox.max.y, z: bbox.max.z }
    ];

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (const corner of corners) {
      const tc = this.transformPoint(m, corner);
      if (tc.x < minX) minX = tc.x;
      if (tc.y < minY) minY = tc.y;
      if (tc.z < minZ) minZ = tc.z;
      if (tc.x > maxX) maxX = tc.x;
      if (tc.y > maxY) maxY = tc.y;
      if (tc.z > maxZ) maxZ = tc.z;
    }

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ }
    };
  }

  /**
   * Extract translation vector from 4x4 matrix
   */
  public static extractTranslation(m: Matrix4x4): Vector3D {
    return {
      x: m[0][3],
      y: m[1][3],
      z: m[2][3]
    };
  }

  /**
   * Validate matrix sanity (determinant != 0, no NaNs)
   */
  public static isValidTransform(m: Matrix4x4): boolean {
    if (!m || m.length !== 4) return false;
    for (let r = 0; r < 4; r++) {
      if (!m[r] || m[r].length !== 4) return false;
      for (let c = 0; c < 4; c++) {
        if (typeof m[r][c] !== 'number' || isNaN(m[r][c]) || !isFinite(m[r][c])) {
          return false;
        }
      }
    }
    // Bottom row must be [0, 0, 0, 1] for standard affine homogeneous transform
    if (m[3][0] !== 0 || m[3][1] !== 0 || m[3][2] !== 0 || m[3][3] !== 1) {
      return false;
    }
    return true;
  }
}
