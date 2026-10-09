/**
 * PATCH-SECP-227 — Coordinate Frame Engine
 * 
 * Implements rigorous 3D spatial transformations, orthonormal frames,
 * $SO(3)$ rotations and $SE(3)$ homogeneous rigid body kinematics.
 * Guarantees zero UI-approximation error.
 */

import { Vector3D } from '../../cadKernel';
import { CoordinateFrame3D, Matrix3x3, TransformMatrix4x4 } from './MechanicalJointTypes';

export class CoordinateFrameEngine {
  /**
   * Vector Math Utilities
   */
  public static vecAdd(a: Vector3D, b: Vector3D): Vector3D {
    if (!a && !b) return { x: 0, y: 0, z: 0 };
    return { 
      x: (a?.x || 0) + (b?.x || 0), 
      y: (a?.y || 0) + (b?.y || 0), 
      z: (a?.z || 0) + (b?.z || 0) 
    };
  }

  public static vecSub(a: Vector3D, b: Vector3D): Vector3D {
    if (!a && !b) return { x: 0, y: 0, z: 0 };
    return { 
      x: (a?.x || 0) - (b?.x || 0), 
      y: (a?.y || 0) - (b?.y || 0), 
      z: (a?.z || 0) - (b?.z || 0) 
    };
  }

  public static vecScale(v: Vector3D, s: number): Vector3D {
    return { 
      x: (v?.x || 0) * s, 
      y: (v?.y || 0) * s, 
      z: (v?.z || 0) * s 
    };
  }

  public static vecDot(a: Vector3D, b: Vector3D): number {
    return (a?.x || 0) * (b?.x || 0) + (a?.y || 0) * (b?.y || 0) + (a?.z || 0) * (b?.z || 0);
  }

  public static vecCross(a: Vector3D, b: Vector3D): Vector3D {
    const ax = a?.x || 0, ay = a?.y || 0, az = a?.z || 0;
    const bx = b?.x || 0, by = b?.y || 0, bz = b?.z || 0;
    return {
      x: ay * bz - az * by,
      y: az * bx - ax * bz,
      z: ax * by - ay * bx
    };
  }

  public static vecLength(v: Vector3D): number {
    const x = v?.x || 0, y = v?.y || 0, z = v?.z || 0;
    return Math.sqrt(x * x + y * y + z * z);
  }

  public static vecNormalize(v: Vector3D): Vector3D {
    const len = this.vecLength(v);
    if (len < 1e-12) {
      return { x: 0, y: 0, z: 1 };
    }
    return { x: (v?.x || 0) / len, y: (v?.y || 0) / len, z: (v?.z || 0) / len };
  }

  public static vecDistance(a: Vector3D, b: Vector3D): number {
    return this.vecLength(this.vecSub(a, b));
  }

  /**
   * Identity 3x3 Matrix
   */
  public static identity3x3(): Matrix3x3 {
    return {
      elements: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      ]
    };
  }

  /**
   * Identity 4x4 Transform Matrix
   */
  public static identity4x4(): TransformMatrix4x4 {
    return {
      elements: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]
    };
  }

  /**
   * Construct 3x3 Rotation Matrix from Euler Angles (XYZ intrinsic, in radians)
   */
  public static eulerToRotationMatrix(rollX: number, pitchY: number, yawZ: number): Matrix3x3 {
    const cx = Math.cos(rollX), sx = Math.sin(rollX);
    const cy = Math.cos(pitchY), sy = Math.sin(pitchY);
    const cz = Math.cos(yawZ), sz = Math.sin(yawZ);

    // R = Rz * Ry * Rx
    return {
      elements: [
        cy * cz,               sx * sy * cz - cx * sz,         cx * sy * cz + sx * sz,
        cy * sz,               sx * sy * sz + cx * cz,         cx * sy * sz - sx * cz,
        -sy,                   sx * cy,                         cx * cy
      ]
    };
  }

  /**
   * Construct 3x3 Rotation Matrix from Axis and Angle (Rodrigues' rotation formula)
   */
  public static axisAngleToRotationMatrix(axis: Vector3D, angleRad: number): Matrix3x3 {
    const u = this.vecNormalize(axis);
    const c = Math.cos(angleRad);
    const s = Math.sin(angleRad);
    const t = 1 - c;

    return {
      elements: [
        t * u.x * u.x + c,       t * u.x * u.y - s * u.z, t * u.x * u.z + s * u.y,
        t * u.x * u.y + s * u.z, t * u.y * u.y + c,       t * u.y * u.z - s * u.x,
        t * u.x * u.z - s * u.y, t * u.y * u.z + s * u.x, t * u.z * u.z + c
      ]
    };
  }

  /**
   * Construct Coordinate Frame from Origin and Z-Axis (with auto-orthogonalized X and Y axes)
   */
  public static createFrameFromOriginAndAxis(
    id: string,
    name: string,
    origin: Vector3D,
    zAxis: Vector3D,
    approxXAxis?: Vector3D
  ): CoordinateFrame3D {
    const zNorm = this.vecNormalize(zAxis);
    
    // Choose perpendicular reference vector for X if not provided
    let xRef = approxXAxis ? this.vecNormalize(approxXAxis) : { x: 1, y: 0, z: 0 };
    if (Math.abs(this.vecDot(zNorm, xRef)) > 0.95) {
      xRef = { x: 0, y: 1, z: 0 };
      if (Math.abs(this.vecDot(zNorm, xRef)) > 0.95) {
        xRef = { x: 0, y: 0, z: 1 };
      }
    }

    // Gram-Schmidt orthogonalization
    const yNorm = this.vecNormalize(this.vecCross(zNorm, xRef));
    const xNorm = this.vecNormalize(this.vecCross(yNorm, zNorm));

    const rot: Matrix3x3 = {
      elements: [
        xNorm.x, yNorm.x, zNorm.x,
        xNorm.y, yNorm.y, zNorm.y,
        xNorm.z, yNorm.z, zNorm.z
      ]
    };

    const transform: TransformMatrix4x4 = {
      elements: [
        xNorm.x, yNorm.x, zNorm.x, origin.x,
        xNorm.y, yNorm.y, zNorm.y, origin.y,
        xNorm.z, yNorm.z, zNorm.z, origin.z,
        0,       0,       0,       1
      ]
    };

    return {
      id,
      name,
      origin: { ...origin },
      xAxis: xNorm,
      yAxis: yNorm,
      zAxis: zNorm,
      rotationMatrix: rot,
      transform
    };
  }

  /**
   * Multiply 4x4 Transform Matrices: C = A * B
   */
  public static multiplyTransforms(a: TransformMatrix4x4, b: TransformMatrix4x4): TransformMatrix4x4 {
    if (!a?.elements || !b?.elements) return this.identity4x4();
    const ae = a.elements;
    const be = b.elements;
    const result: number[] = new Array(16);

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += (ae[row * 4 + k] || 0) * (be[k * 4 + col] || 0);
        }
        result[row * 4 + col] = sum;
      }
    }

    return { elements: result as any };
  }

  /**
   * Multiply 3x3 Matrices: C = A * B
   */
  public static multiplyMatrix3x3(a: Matrix3x3, b: Matrix3x3): Matrix3x3 {
    if (!a?.elements || !b?.elements) return this.identity3x3();
    const ae = a.elements;
    const be = b.elements;
    const result: number[] = new Array(9);

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) {
          sum += (ae[row * 3 + k] || 0) * (be[k * 3 + col] || 0);
        }
        result[row * 3 + col] = sum;
      }
    }

    return { elements: result as any };
  }

  /**
   * Transform a 3D point by 4x4 matrix: p' = T * p
   */
  public static transformPoint(p: Vector3D, transform: TransformMatrix4x4): Vector3D {
    if (!transform || !transform.elements) return { x: 0, y: 0, z: 0 };
    const e = transform.elements;
    const px = p?.x || 0, py = p?.y || 0, pz = p?.z || 0;
    return {
      x: (e[0] || 0) * px + (e[1] || 0) * py + (e[2] || 0) * pz + (e[3] || 0),
      y: (e[4] || 0) * px + (e[5] || 0) * py + (e[6] || 0) * pz + (e[7] || 0),
      z: (e[8] || 0) * px + (e[9] || 0) * py + (e[10] || 0) * pz + (e[11] || 0)
    };
  }

  /**
   * Transform a 3D vector (direction only) by 4x4 matrix
   */
  public static transformVector(v: Vector3D, transform: TransformMatrix4x4): Vector3D {
    if (!transform || !transform.elements) return { x: 0, y: 0, z: 1 };
    const e = transform.elements;
    const vx = v?.x || 0, vy = v?.y || 0, vz = v?.z || 0;
    return {
      x: (e[0] || 0) * vx + (e[1] || 0) * vy + (e[2] || 0) * vz,
      y: (e[4] || 0) * vx + (e[5] || 0) * vy + (e[6] || 0) * vz,
      z: (e[8] || 0) * vx + (e[9] || 0) * vy + (e[10] || 0) * vz
    };
  }

  /**
   * Invert Rigid Body 4x4 Matrix (R^T and -R^T * T)
   */
  public static invertRigidTransform(transform: TransformMatrix4x4): TransformMatrix4x4 {
    if (!transform || !transform.elements) return this.identity4x4();
    const e = transform.elements;
    // R is top-left 3x3
    // R^T:
    const r00 = e[0] || 0, r01 = e[4] || 0, r02 = e[8] || 0;
    const r10 = e[1] || 0, r11 = e[5] || 0, r12 = e[9] || 0;
    const r20 = e[2] || 0, r21 = e[6] || 0, r22 = e[10] || 0;

    const tx = e[3] || 0, ty = e[7] || 0, tz = e[11] || 0;

    // New translation: -R^T * T
    const ntx = -(r00 * tx + r01 * ty + r02 * tz);
    const nty = -(r10 * tx + r11 * ty + r12 * tz);
    const ntz = -(r20 * tx + r21 * ty + r22 * tz);

    return {
      elements: [
        r00, r01, r02, ntx,
        r10, r11, r12, nty,
        r20, r21, r22, ntz,
        0,   0,   0,   1
      ]
    };
  }

  /**
   * Build Transform Matrix from Rotation Matrix and Translation Vector
   */
  public static makeTransform(rot: Matrix3x3, trans: Vector3D): TransformMatrix4x4 {
    const r = rot?.elements || [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const tx = trans?.x || 0;
    const ty = trans?.y || 0;
    const tz = trans?.z || 0;
    return {
      elements: [
        r[0] || 0, r[1] || 0, r[2] || 0, tx,
        r[3] || 0, r[4] || 0, r[5] || 0, ty,
        r[6] || 0, r[7] || 0, r[8] || 0, tz,
        0,    0,    0,    1
      ]
    };
  }

  /**
   * Extract Translation Vector from 4x4 Matrix
   */
  public static getTranslation(transform: TransformMatrix4x4): Vector3D {
    const e = transform?.elements || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
    return { x: e[3] || 0, y: e[7] || 0, z: e[11] || 0 };
  }

  /**
   * Extract 3x3 Rotation Matrix from 4x4 Matrix
   */
  public static getRotationMatrix(transform: TransformMatrix4x4): Matrix3x3 {
    const e = transform?.elements || [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1];
    return {
      elements: [
        e[0] || 0, e[1] || 0, e[2] || 0,
        e[4] || 0, e[5] || 0, e[6] || 0,
        e[8] || 0, e[9] || 0, e[10] || 0
      ]
    };
  }

  /**
   * Extract Euler angles (rollX, pitchY, yawZ in radians) from 3x3 Rotation Matrix
   */
  public static rotationMatrixToEuler(rot: Matrix3x3): Vector3D {
    const e = rot.elements;
    const sy = Math.sqrt(e[0] * e[0] + e[3] * e[3]);
    const singular = sy < 1e-6;

    let x: number, y: number, z: number;
    if (!singular) {
      x = Math.atan2(e[7], e[8]);
      y = Math.atan2(-e[6], sy);
      z = Math.atan2(e[3], e[0]);
    } else {
      x = Math.atan2(-e[5], e[4]);
      y = Math.atan2(-e[6], sy);
      z = 0;
    }
    return { x, y, z };
  }
}
