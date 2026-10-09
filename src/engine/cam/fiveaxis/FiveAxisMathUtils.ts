/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-258 — 5-Axis Kinematics Math Utilities & Matrix Transforms
 */

import { Vector3D } from '../../cadKernel';
import { ToolOrientationVector } from './FiveAxisTypes';

export type Matrix4x4 = [
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number]
];

export class FiveAxisMathUtils {
  public static readonly EPSILON = 1e-9;
  public static readonly DEG2RAD = Math.PI / 180;
  public static readonly RAD2DEG = 180 / Math.PI;

  // ----------------------------------------------------
  // Vector 3D Operations
  // ----------------------------------------------------

  public static createVector(x: number, y: number, z: number): Vector3D {
    return { x, y, z };
  }

  public static add(a: Vector3D, b: Vector3D): Vector3D {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  public static subtract(a: Vector3D, b: Vector3D): Vector3D {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  public static scale(v: Vector3D, s: number): Vector3D {
    return { x: v.x * s, y: v.y * s, z: v.z * s };
  }

  public static dot(a: Vector3D, b: Vector3D): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  public static cross(a: Vector3D, b: Vector3D): Vector3D {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  public static norm(v: Vector3D): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  public static distance(a: Vector3D, b: Vector3D): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  public static normalize(v: Vector3D): Vector3D {
    const len = this.norm(v);
    if (len < this.EPSILON) {
      return { x: 0, y: 0, z: 1 };
    }
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  public static toOrientationVector(v: Vector3D): ToolOrientationVector {
    const normV = this.normalize(v);
    const mag = this.norm(normV);
    return {
      x: normV.x,
      y: normV.y,
      z: normV.z,
      normalizedMagnitude: Number(mag.toFixed(7))
    };
  }

  public static angleBetween(a: Vector3D, b: Vector3D): number {
    const na = this.normalize(a);
    const nb = this.normalize(b);
    const d = Math.max(-1.0, Math.min(1.0, this.dot(na, nb)));
    return Math.acos(d); // Radians
  }

  public static angleBetweenDeg(a: Vector3D, b: Vector3D): number {
    return this.angleBetween(a, b) * this.RAD2DEG;
  }

  // ----------------------------------------------------
  // Rodrigues' Rotation Formula
  // Rotate vector v around unit axis k by angle theta (rad)
  // ----------------------------------------------------
  public static rotateVectorAxis(v: Vector3D, axis: Vector3D, thetaRad: number): Vector3D {
    const k = this.normalize(axis);
    const cosT = Math.cos(thetaRad);
    const sinT = Math.sin(thetaRad);

    // v_rot = v * cos(theta) + (k x v) * sin(theta) + k * (k . v) * (1 - cos(theta))
    const term1 = this.scale(v, cosT);
    const term2 = this.scale(this.cross(k, v), sinT);
    const term3 = this.scale(k, this.dot(k, v) * (1 - cosT));

    return this.add(this.add(term1, term2), term3);
  }

  // ----------------------------------------------------
  // Matrix 4x4 Operations (Homogeneous Coordinates)
  // ----------------------------------------------------

  public static identityMatrix(): Matrix4x4 {
    return [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];
  }

  public static translationMatrix(tx: number, ty: number, tz: number): Matrix4x4 {
    return [
      [1, 0, 0, tx],
      [0, 1, 0, ty],
      [0, 0, 1, tz],
      [0, 0, 0, 1]
    ];
  }

  public static rotationXMatrix(rad: number): Matrix4x4 {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return [
      [1, 0, 0, 0],
      [0, c, -s, 0],
      [0, s, c, 0],
      [0, 0, 0, 1]
    ];
  }

  public static rotationYMatrix(rad: number): Matrix4x4 {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return [
      [c, 0, s, 0],
      [0, 1, 0, 0],
      [-s, 0, c, 0],
      [0, 0, 0, 1]
    ];
  }

  public static rotationZMatrix(rad: number): Matrix4x4 {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return [
      [c, -s, 0, 0],
      [s, c, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];
  }

  public static multiplyMatrices(a: Matrix4x4, b: Matrix4x4): Matrix4x4 {
    const result = this.identityMatrix();
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a[r][k] * b[k][c];
        }
        result[r][c] = sum;
      }
    }
    return result;
  }

  public static transformPoint(m: Matrix4x4, p: Vector3D): Vector3D {
    const x = m[0][0] * p.x + m[0][1] * p.y + m[0][2] * p.z + m[0][3];
    const y = m[1][0] * p.x + m[1][1] * p.y + m[1][2] * p.z + m[1][3];
    const z = m[2][0] * p.x + m[2][1] * p.y + m[2][2] * p.z + m[2][3];
    const w = m[3][0] * p.x + m[3][1] * p.y + m[3][2] * p.z + m[3][3];
    const scale = Math.abs(w) > this.EPSILON ? 1 / w : 1.0;
    return { x: x * scale, y: y * scale, z: z * scale };
  }

  public static transformVector(m: Matrix4x4, v: Vector3D): Vector3D {
    // Pure 3x3 rotation matrix component
    const x = m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z;
    const y = m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z;
    const z = m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z;
    return { x, y, z };
  }

  /**
   * Inverts a standard 4x4 Rigid Body Transform (Rotation + Translation)
   * R_inv = R^T, T_inv = -R^T * T
   */
  public static invertRigidTransform(m: Matrix4x4): Matrix4x4 {
    const inv = this.identityMatrix();
    // Transpose 3x3 rotation part
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        inv[i][j] = m[j][i];
      }
    }
    // Translation: -R^T * T
    const tx = m[0][3];
    const ty = m[1][3];
    const tz = m[2][3];
    inv[0][3] = -(inv[0][0] * tx + inv[0][1] * ty + inv[0][2] * tz);
    inv[1][3] = -(inv[1][0] * tx + inv[1][1] * ty + inv[1][2] * tz);
    inv[2][3] = -(inv[2][0] * tx + inv[2][1] * ty + inv[2][2] * tz);
    return inv;
  }

  // ----------------------------------------------------
  // Spherical Linear Interpolation (SLERP) for Unit Vectors
  // ----------------------------------------------------
  public static slerpVector(v0: Vector3D, v1: Vector3D, t: number): Vector3D {
    const u0 = this.normalize(v0);
    const u1 = this.normalize(v1);
    let dot = this.dot(u0, u1);
    dot = Math.max(-1.0, Math.min(1.0, dot));

    if (dot > 0.99995) {
      // Vectors are almost parallel, use linear interpolation
      const result = this.add(this.scale(u0, 1 - t), this.scale(u1, t));
      return this.normalize(result);
    }

    const theta = Math.acos(dot);
    const sinTheta = Math.sin(theta);
    const s0 = Math.sin((1 - t) * theta) / sinTheta;
    const s1 = Math.sin(t * theta) / sinTheta;

    const result = this.add(this.scale(u0, s0), this.scale(u1, s1));
    return this.normalize(result);
  }

  // ----------------------------------------------------
  // Angle Unwrapper for Continuous Rotary Toolpaths
  // ----------------------------------------------------
  public static unwrapAngle(targetDeg: number, referenceDeg: number): { unwoundDeg: number; unwrapped: boolean } {
    let diff = targetDeg - referenceDeg;
    let unwrapped = false;
    while (diff > 180.0001) {
      targetDeg -= 360;
      diff -= 360;
      unwrapped = true;
    }
    while (diff < -180.0001) {
      targetDeg += 360;
      diff += 360;
      unwrapped = true;
    }
    return { unwoundDeg: targetDeg, unwrapped };
  }
}
