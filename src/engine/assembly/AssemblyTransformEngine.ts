/**
 * PATCH-SECP-045 — Assembly Transform Engine
 * High-precision 4x4 Transformation Math & Hierarchical Propagation:
 *  - Matrix multiplication, inversion, determinant, transposition
 *  - Euler angles <-> Rotation Matrix conversions (ZYX / XYZ standard)
 *  - Rodrigues axis-angle rotation formulas
 *  - Matrix numerical validation (NaN/Inf rejection, Orthogonality R^T * R = I, Det(R) = +1)
 *  - Deterministic forward transform propagation
 */

import { Vector3D } from '../cadKernel';
import { Tolerance } from '../geometry/GeometryTolerance';
import { Transform3D } from './AssemblyConstraintTypes';

export class AssemblyTransformEngine {
  /**
   * Creates an identity 4x4 matrix (16 elements row-major)
   */
  public static identity(): number[] {
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];
  }

  /**
   * Creates 4x4 matrix from Position (Vector3D) and Euler Rotations (deg)
   */
  public static fromPositionRotation(position: Vector3D, rotationDeg: Vector3D): number[] {
    const radX = (rotationDeg.x * Math.PI) / 180;
    const radY = (rotationDeg.y * Math.PI) / 180;
    const radZ = (rotationDeg.z * Math.PI) / 180;

    const cx = Math.cos(radX);
    const sx = Math.sin(radX);
    const cy = Math.cos(radY);
    const sy = Math.sin(radY);
    const cz = Math.cos(radZ);
    const sz = Math.sin(radZ);

    // R = Rz * Ry * Rx
    const r00 = cy * cz;
    const r01 = sx * sy * cz - cx * sz;
    const r02 = cx * sy * cz + sx * sz;

    const r10 = cy * sz;
    const r11 = sx * sy * sz + cx * cz;
    const r12 = cx * sy * sz - sx * cz;

    const r20 = -sy;
    const r21 = sx * cy;
    const r22 = cx * cy;

    return [
      r00, r01, r02, position.x,
      r10, r11, r12, position.y,
      r20, r21, r22, position.z,
      0,   0,   0,   1
    ];
  }

  /**
   * Multiplies two 4x4 matrices A and B (A * B)
   */
  public static multiply(a: number[], b: number[]): number[] {
    const out = new Array(16).fill(0);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a[row * 4 + k] * b[k * 4 + col];
        }
        out[row * 4 + col] = sum;
      }
    }
    return out;
  }

  /**
   * Creates a pure translation matrix
   */
  public static translation(tx: number, ty: number, tz: number): number[] {
    return [
      1, 0, 0, tx,
      0, 1, 0, ty,
      0, 0, 1, tz,
      0, 0, 0, 1
    ];
  }

  /**
   * Creates a rotation matrix around an arbitrary unit axis using Rodrigues formula
   */
  public static rotationAroundAxis(axis: Vector3D, angleRad: number): number[] {
    const len = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
    if (len < 1e-9) {
      return this.identity();
    }
    const ux = axis.x / len;
    const uy = axis.y / len;
    const uz = axis.z / len;

    const c = Math.cos(angleRad);
    const s = Math.sin(angleRad);
    const t = 1 - c;

    return [
      t * ux * ux + c,      t * ux * uy - s * uz, t * ux * uz + s * uy, 0,
      t * ux * uy + s * uz, t * uy * uy + c,      t * uy * uz - s * ux, 0,
      t * ux * uz - s * uy, t * uy * uz + s * ux, t * uz * uz + c,      0,
      0,                    0,                    0,                    1
    ];
  }

  /**
   * Creates a canonical joint rotation transform around an arbitrary joint origin and axis
   */
  public static createJointRotationTransform(
    jointOrigin: Vector3D,
    axis: Vector3D,
    angleRad: number
  ): number[] {
    const toOrigin = this.translation(-jointOrigin.x, -jointOrigin.y, -jointOrigin.z);
    const rotation = this.rotationAroundAxis(axis, angleRad);
    const fromOrigin = this.translation(jointOrigin.x, jointOrigin.y, jointOrigin.z);

    const step1 = this.multiply(rotation, toOrigin);
    return this.multiply(fromOrigin, step1);
  }

  /**
   * Creates a revolute joint transformation matrix (relative to joint origin and axis)
   */
  public static revoluteJointTransform(
    origin: Vector3D,
    axis: Vector3D,
    angleDeg: number
  ): number[] {
    const rad = (angleDeg * Math.PI) / 180;
    return this.createJointRotationTransform(origin, axis, rad);
  }

  /**
   * Creates a prismatic joint transformation matrix (translation along joint axis)
   */
  public static prismaticJointTransform(
    axis: Vector3D,
    distanceMm: number
  ): number[] {
    const len = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
    if (len < 1e-9) return this.identity();
    const ux = axis.x / len;
    const uy = axis.y / len;
    const uz = axis.z / len;

    return this.translation(ux * distanceMm, uy * distanceMm, uz * distanceMm);
  }

  /**
   * Computes the 3x3 rotation matrix determinant
   */
  public static determinant3x3(m: number[]): number {
    return (
      m[0] * (m[5] * m[10] - m[6] * m[9]) -
      m[1] * (m[4] * m[10] - m[6] * m[8]) +
      m[2] * (m[4] * m[9] - m[5] * m[8])
    );
  }

  /**
   * Extracts position from a 4x4 matrix
   */
  public static getPosition(m: number[]): Vector3D {
    return {
      x: m[3],
      y: m[7],
      z: m[11]
    };
  }

  /**
   * Extracts Euler angles (deg) from a 4x4 matrix
   */
  public static getEulerAnglesDeg(m: number[]): Vector3D {
    const r00 = m[0], r01 = m[1], r02 = m[2];
    const r10 = m[4], r11 = m[5], r12 = m[6];
    const r20 = m[8], r21 = m[9], r22 = m[10];

    let pitch: number;
    let roll: number;
    let yaw: number;

    if (Math.abs(r20) < 0.99999) {
      pitch = -Math.asin(r20);
      roll = Math.atan2(r21, r22);
      yaw = Math.atan2(r10, r00);
    } else {
      // Gimbal lock
      pitch = r20 < 0 ? Math.PI / 2 : -Math.PI / 2;
      roll = Math.atan2(-r01, r11);
      yaw = 0;
    }

    return {
      x: (roll * 180) / Math.PI,
      y: (pitch * 180) / Math.PI,
      z: (yaw * 180) / Math.PI
    };
  }

  /**
   * Transforms a 3D point by a 4x4 matrix (including translation)
   */
  public static transformPoint(m: number[], p: Vector3D): Vector3D {
    return {
      x: m[0] * p.x + m[1] * p.y + m[2] * p.z + m[3],
      y: m[4] * p.x + m[5] * p.y + m[6] * p.z + m[7],
      z: m[8] * p.x + m[9] * p.y + m[10] * p.z + m[11]
    };
  }

  /**
   * Transforms a 3D direction vector by a 4x4 matrix (rotational only, no translation)
   */
  public static transformDirection(m: number[], d: Vector3D): Vector3D {
    return {
      x: m[0] * d.x + m[1] * d.y + m[2] * d.z,
      y: m[4] * d.x + m[5] * d.y + m[6] * d.z,
      z: m[8] * d.x + m[9] * d.y + m[10] * d.z
    };
  }

  /**
   * Inverts a rigid body 4x4 transformation matrix [R | t; 0 1] -> [R^T | -R^T * t; 0 1]
   */
  public static invertRigid(m: number[]): number[] {
    // R is top-left 3x3, R^T is transpose of R
    const r00 = m[0], r01 = m[4], r02 = m[8];
    const r10 = m[1], r11 = m[5], r12 = m[9];
    const r20 = m[2], r21 = m[6], r22 = m[10];

    const tx = m[3], ty = m[7], tz = m[11];

    const invTx = -(r00 * tx + r01 * ty + r02 * tz);
    const invTy = -(r10 * tx + r11 * ty + r12 * tz);
    const invTz = -(r20 * tx + r21 * ty + r22 * tz);

    return [
      r00, r01, r02, invTx,
      r10, r11, r12, invTy,
      r20, r21, r22, invTz,
      0,   0,   0,   1
    ];
  }

  /**
   * Validates a 4x4 matrix for numerical sanity:
   *  - No NaN or Infinity
   *  - Determinant of 3x3 rotation block == +1.0 within tolerance
   *  - Columns/Rows of R are orthogonal (R^T * R == I)
   *  - Bottom row is [0, 0, 0, 1]
   */
  public static validateMatrix(m: number[], tolerance: number = 1e-4): {
    isValid: boolean;
    isFinite: boolean;
    isOrthogonal: boolean;
    isUnitDeterminant: boolean;
    det: number;
    errorReason?: string;
  } {
    if (!m || m.length !== 16) {
      return {
        isValid: false,
        isFinite: false,
        isOrthogonal: false,
        isUnitDeterminant: false,
        det: 0,
        errorReason: 'Matrix does not contain exactly 16 elements.'
      };
    }

    // 1. Finite numbers check
    for (let i = 0; i < 16; i++) {
      if (!Number.isFinite(m[i])) {
        return {
          isValid: false,
          isFinite: false,
          isOrthogonal: false,
          isUnitDeterminant: false,
          det: 0,
          errorReason: `Matrix element at index ${i} is not finite (${m[i]}).`
        };
      }
    }

    // 2. Bottom row sanity check
    if (
      Math.abs(m[12]) > tolerance ||
      Math.abs(m[13]) > tolerance ||
      Math.abs(m[14]) > tolerance ||
      Math.abs(m[15] - 1.0) > tolerance
    ) {
      return {
        isValid: false,
        isFinite: true,
        isOrthogonal: false,
        isUnitDeterminant: false,
        det: 0,
        errorReason: 'Bottom row is not [0, 0, 0, 1].'
      };
    }

    // 3. Determinant of R
    const det = this.determinant3x3(m);
    const isUnitDeterminant = Math.abs(det - 1.0) < tolerance;

    // 4. Orthogonality check: dot products of column vectors
    const c0 = { x: m[0], y: m[4], z: m[8] };
    const c1 = { x: m[1], y: m[5], z: m[9] };
    const c2 = { x: m[2], y: m[6], z: m[10] };

    const len0 = Math.sqrt(c0.x * c0.x + c0.y * c0.y + c0.z * c0.z);
    const len1 = Math.sqrt(c1.x * c1.x + c1.y * c1.y + c1.z * c1.z);
    const len2 = Math.sqrt(c2.x * c2.x + c2.y * c2.y + c2.z * c2.z);

    const dot01 = c0.x * c1.x + c0.y * c1.y + c0.z * c1.z;
    const dot02 = c0.x * c2.x + c0.y * c2.y + c0.z * c2.z;
    const dot12 = c1.x * c2.x + c1.y * c2.y + c1.z * c2.z;

    const isOrthogonal = 
      Math.abs(len0 - 1.0) < tolerance &&
      Math.abs(len1 - 1.0) < tolerance &&
      Math.abs(len2 - 1.0) < tolerance &&
      Math.abs(dot01) < tolerance &&
      Math.abs(dot02) < tolerance &&
      Math.abs(dot12) < tolerance;

    const isValid = isUnitDeterminant && isOrthogonal;

    return {
      isValid,
      isFinite: true,
      isOrthogonal,
      isUnitDeterminant,
      det,
      errorReason: isValid ? undefined : `Matrix failed rigid body checks (det=${det.toFixed(4)}, orthogonal=${isOrthogonal}).`
    };
  }
}
