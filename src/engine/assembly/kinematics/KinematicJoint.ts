import { Vector3D } from '../../cadKernel';
import {
  vecNormalize,
  vecDot,
  vecCross,
  vecLength,
  vecSubtract,
  validateRotationMatrix,
} from '../constraints/AssemblyConstraint';
import {
  KinematicJoint,
  KinematicFrame,
  JointCoordinateValue,
  JointLimits,
} from './KinematicJointModel';
import { createIdentityTransform } from './KinematicBody';

// ==========================================
// 4x4 Rigid Matrix Math Utilities
// ==========================================

export function multiplyTransforms(A: number[][], B: number[][]): number[][] {
  const result: number[][] = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += A[i][k] * B[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

/**
 * Inverts a 4x4 rigid transformation matrix [ R  t ; 0  1 ] -> [ R^T  -R^T*t ; 0  1 ]
 */
export function invertRigidTransform(M: number[][]): number[][] {
  const R_T: number[][] = [
    [M[0][0], M[1][0], M[2][0]],
    [M[0][1], M[1][1], M[2][1]],
    [M[0][2], M[1][2], M[2][2]],
  ];

  const tx = M[0][3];
  const ty = M[1][3];
  const tz = M[2][3];

  const inv_tx = -(R_T[0][0] * tx + R_T[0][1] * ty + R_T[0][2] * tz);
  const inv_ty = -(R_T[1][0] * tx + R_T[1][1] * ty + R_T[1][2] * tz);
  const inv_tz = -(R_T[2][0] * tx + R_T[2][1] * ty + R_T[2][2] * tz);

  return [
    [R_T[0][0], R_T[0][1], R_T[0][2], inv_tx],
    [R_T[1][0], R_T[1][1], R_T[1][2], inv_ty],
    [R_T[2][0], R_T[2][1], R_T[2][2], inv_tz],
    [0, 0, 0, 1],
  ];
}

/**
 * Creates a 4x4 pure translation transform
 */
export function createTranslationTransform(t: Vector3D): number[][] {
  return [
    [1, 0, 0, t.x],
    [0, 1, 0, t.y],
    [0, 0, 1, t.z],
    [0, 0, 0, 1],
  ];
}

/**
 * Creates a 4x4 rotation transform around a given normalized axis by angle in degrees (Rodrigues formula)
 */
export function createAxisAngleTransform(axis: Vector3D, angleDeg: number): number[][] {
  const u = vecNormalize(axis);
  const rad = (angleDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const t = 1 - c;

  const r00 = t * u.x * u.x + c;
  const r01 = t * u.x * u.y - s * u.z;
  const r02 = t * u.x * u.z + s * u.y;

  const r10 = t * u.x * u.y + s * u.z;
  const r11 = t * u.y * u.y + c;
  const r12 = t * u.y * u.z - s * u.x;

  const r20 = t * u.x * u.z - s * u.y;
  const r21 = t * u.y * u.z + s * u.x;
  const r22 = t * u.z * u.z + c;

  return [
    [r00, r01, r02, 0],
    [r10, r11, r12, 0],
    [r20, r21, r22, 0],
    [0, 0, 0, 1],
  ];
}

/**
 * Converts a normalized unit quaternion [x, y, z, w] to a 4x4 rotation matrix
 */
export function createQuaternionTransform(qx: number, qy: number, qz: number, qw: number): number[][] {
  const len = Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw);
  if (len < 1e-8 || isNaN(len) || !isFinite(len)) {
    throw new Error('Invalid or zero-length quaternion');
  }
  const x = qx / len;
  const y = qy / len;
  const z = qz / len;
  const w = qw / len;

  const r00 = 1 - 2 * (y * y + z * z);
  const r01 = 2 * (x * y - z * w);
  const r02 = 2 * (x * z + y * w);

  const r10 = 2 * (x * y + z * w);
  const r11 = 1 - 2 * (x * x + z * z);
  const r12 = 2 * (y * z - x * w);

  const r20 = 2 * (x * z - y * w);
  const r21 = 2 * (y * z + x * w);
  const r22 = 1 - 2 * (x * x + y * y);

  return [
    [r00, r01, r02, 0],
    [r10, r11, r12, 0],
    [r20, r21, r22, 0],
    [0, 0, 0, 1],
  ];
}

/**
 * Converts a KinematicFrame into an absolute 4x4 transformation matrix
 */
export function frameToTransform(frame: KinematicFrame): number[][] {
  if (frame.transform) {
    return frame.transform;
  }

  const zAxis = vecNormalize(frame.primaryAxis);
  let xAxis: Vector3D;

  if (frame.secondaryAxis) {
    // Project and orthogonalize secondary axis relative to zAxis
    const sec = frame.secondaryAxis;
    const dot = vecDot(sec, zAxis);
    const ortho = vecSubtract(sec, { x: zAxis.x * dot, y: zAxis.y * dot, z: zAxis.z * dot });
    if (vecLength(ortho) > 1e-6) {
      xAxis = vecNormalize(ortho);
    } else {
      const helper = Math.abs(zAxis.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
      xAxis = vecNormalize(vecCross(helper, zAxis));
    }
  } else {
    const helper = Math.abs(zAxis.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    xAxis = vecNormalize(vecCross(helper, zAxis));
  }

  const yAxis = vecNormalize(vecCross(zAxis, xAxis));

  return [
    [xAxis.x, yAxis.x, zAxis.x, frame.origin.x],
    [xAxis.y, yAxis.y, zAxis.y, frame.origin.y],
    [xAxis.z, yAxis.z, zAxis.z, frame.origin.z],
    [0, 0, 0, 1],
  ];
}

export class KinematicJointEvaluator {
  /**
   * Validates a joint definition for numerical safety and frame coherence
   */
  public static validateJointDefinition(joint: KinematicJoint): { valid: boolean; reason?: string } {
    if (!joint.jointId || !joint.parentBodyId || !joint.childBodyId) {
      return { valid: false, reason: 'Missing joint or body IDs' };
    }

    if (joint.parentBodyId === joint.childBodyId) {
      return { valid: false, reason: 'Self-connecting joints are not permitted' };
    }

    // Validate frames
    try {
      const zP = vecLength(joint.parentFrame.primaryAxis);
      const zC = vecLength(joint.childFrame.primaryAxis);
      if (zP < 1e-8 || isNaN(zP) || !isFinite(zP)) {
        return { valid: false, reason: 'Parent frame primary axis is zero-length or non-finite' };
      }
      if (zC < 1e-8 || isNaN(zC) || !isFinite(zC)) {
        return { valid: false, reason: 'Child frame primary axis is zero-length or non-finite' };
      }

      const TfP = frameToTransform(joint.parentFrame);
      const TfC = frameToTransform(joint.childFrame);

      const rotP = [
        [TfP[0][0], TfP[0][1], TfP[0][2]],
        [TfP[1][0], TfP[1][1], TfP[1][2]],
        [TfP[2][0], TfP[2][1], TfP[2][2]],
      ];
      const rotC = [
        [TfC[0][0], TfC[0][1], TfC[0][2]],
        [TfC[1][0], TfC[1][1], TfC[1][2]],
        [TfC[2][0], TfC[2][1], TfC[2][2]],
      ];

      const valP = validateRotationMatrix(rotP);
      if (!valP.valid) return { valid: false, reason: `Parent frame rotation invalid: ${valP.reason}` };

      const valC = validateRotationMatrix(rotC);
      if (!valC.valid) return { valid: false, reason: `Child frame rotation invalid: ${valC.reason}` };
    } catch (e: any) {
      return { valid: false, reason: e.message || 'Frame calculation error' };
    }

    // Validate parameters specific to type
    if (joint.jointType === 'REVOLUTE' || joint.jointType === 'PRISMATIC' || joint.jointType === 'CYLINDRICAL') {
      const axis = joint.parameters.axis || joint.parentFrame.primaryAxis;
      const len = vecLength(axis);
      if (len < 1e-8 || isNaN(len) || !isFinite(len)) {
        return { valid: false, reason: 'Joint axis is zero-length or invalid' };
      }
    }

    return { valid: true };
  }

  /**
   * Validates requested joint coordinates against defined joint limits
   */
  public static validateJointLimits(
    joint: KinematicJoint,
    coords: JointCoordinateValue
  ): { valid: boolean; violationType?: string; requestedValue?: any; min?: any; max?: any; reason?: string } {
    if (!joint.limits) {
      return { valid: true };
    }

    const limits = joint.limits;

    if (joint.jointType === 'REVOLUTE') {
      const q = typeof coords === 'number' ? coords : (coords as any).q ?? (coords as any).rx ?? 0;
      if (isNaN(q) || !isFinite(q)) {
        return { valid: false, violationType: 'NUMERICAL_INVALID', requestedValue: q, reason: 'Coordinate is NaN/Infinity' };
      }
      if (limits.min !== undefined && q < limits.min - joint.tolerance) {
        return { valid: false, violationType: 'MIN_LIMIT_EXCEEDED', requestedValue: q, min: limits.min, reason: `Value ${q} < min limit ${limits.min}` };
      }
      if (limits.max !== undefined && q > limits.max + joint.tolerance) {
        return { valid: false, violationType: 'MAX_LIMIT_EXCEEDED', requestedValue: q, max: limits.max, reason: `Value ${q} > max limit ${limits.max}` };
      }
    } else if (joint.jointType === 'PRISMATIC') {
      const q = typeof coords === 'number' ? coords : (coords as any).q ?? (coords as any).x ?? 0;
      if (isNaN(q) || !isFinite(q)) {
        return { valid: false, violationType: 'NUMERICAL_INVALID', requestedValue: q, reason: 'Coordinate is NaN/Infinity' };
      }
      if (limits.min !== undefined && q < limits.min - joint.tolerance) {
        return { valid: false, violationType: 'MIN_LIMIT_EXCEEDED', requestedValue: q, min: limits.min, reason: `Value ${q} < min limit ${limits.min}` };
      }
      if (limits.max !== undefined && q > limits.max + joint.tolerance) {
        return { valid: false, violationType: 'MAX_LIMIT_EXCEEDED', requestedValue: q, max: limits.max, reason: `Value ${q} > max limit ${limits.max}` };
      }
    } else if (joint.jointType === 'CYLINDRICAL') {
      let qR = 0;
      let qT = 0;
      if (Array.isArray(coords)) {
        qR = coords[0] ?? 0;
        qT = coords[1] ?? 0;
      } else if (typeof coords === 'object' && coords !== null) {
        qR = (coords as any).qR ?? (coords as any).rx ?? 0;
        qT = (coords as any).qT ?? (coords as any).z ?? 0;
      }
      if (isNaN(qR) || !isFinite(qR) || isNaN(qT) || !isFinite(qT)) {
        return { valid: false, violationType: 'NUMERICAL_INVALID', requestedValue: [qR, qT], reason: 'Coordinates contain NaN/Infinity' };
      }
      if (limits.min !== undefined && qR < limits.min - joint.tolerance) {
        return { valid: false, violationType: 'ROTATION_MIN_LIMIT', requestedValue: qR, min: limits.min };
      }
      if (limits.max !== undefined && qR > limits.max + joint.tolerance) {
        return { valid: false, violationType: 'ROTATION_MAX_LIMIT', requestedValue: qR, max: limits.max };
      }
      if (limits.min2 !== undefined && qT < limits.min2 - joint.tolerance) {
        return { valid: false, violationType: 'TRANSLATION_MIN_LIMIT', requestedValue: qT, min: limits.min2 };
      }
      if (limits.max2 !== undefined && qT > limits.max2 + joint.tolerance) {
        return { valid: false, violationType: 'TRANSLATION_MAX_LIMIT', requestedValue: qT, max: limits.max2 };
      }
    }

    return { valid: true };
  }

  /**
   * Computes the 4x4 relative transform T_rel between parent and child bodies
   * such that: T_child_world = T_parent_world * T_rel
   */
  public static computeRelativeTransform(
    joint: KinematicJoint,
    coords?: JointCoordinateValue
  ): number[][] {
    const coordVal = coords !== undefined ? coords : joint.position;
    const parentFrameT = frameToTransform(joint.parentFrame);
    const childFrameT = frameToTransform(joint.childFrame);
    const invChildFrameT = invertRigidTransform(childFrameT);

    let motionT = createIdentityTransform();

    switch (joint.jointType) {
      case 'FIXED': {
        // T_rel = ParentFrame * ChildFrame^-1
        motionT = createIdentityTransform();
        break;
      }

      case 'REVOLUTE': {
        // T(q) = Trans(origin) * Rot(axis, q) * Trans(-origin)
        const q = typeof coordVal === 'number' ? coordVal : (coordVal as any).q ?? (coordVal as any).rx ?? 0;
        const axis = joint.parameters.axis || { x: 0, y: 0, z: 1 };
        const origin = joint.parameters.origin || { x: 0, y: 0, z: 0 };

        const rot = createAxisAngleTransform(axis, q);
        if (origin.x !== 0 || origin.y !== 0 || origin.z !== 0) {
          const transPos = createTranslationTransform(origin);
          const transNeg = createTranslationTransform({ x: -origin.x, y: -origin.y, z: -origin.z });
          motionT = multiplyTransforms(transPos, multiplyTransforms(rot, transNeg));
        } else {
          motionT = rot;
        }
        break;
      }

      case 'PRISMATIC': {
        // T(q) = Trans(axis * q)
        const q = typeof coordVal === 'number' ? coordVal : (coordVal as any).q ?? (coordVal as any).x ?? 0;
        const axis = vecNormalize(joint.parameters.axis || { x: 0, y: 0, z: 1 });
        const shift: Vector3D = { x: axis.x * q, y: axis.y * q, z: axis.z * q };
        motionT = createTranslationTransform(shift);
        break;
      }

      case 'CYLINDRICAL': {
        // T(qR, qT) = Trans(axis * qT) * Rot(axis, qR)
        let qR = 0;
        let qT = 0;
        if (Array.isArray(coordVal)) {
          qR = coordVal[0] ?? 0;
          qT = coordVal[1] ?? 0;
        } else if (typeof coordVal === 'object' && coordVal !== null) {
          qR = (coordVal as any).qR ?? (coordVal as any).rx ?? 0;
          qT = (coordVal as any).qT ?? (coordVal as any).z ?? 0;
        }
        const axis = vecNormalize(joint.parameters.axis || { x: 0, y: 0, z: 1 });
        const shift: Vector3D = { x: axis.x * qT, y: axis.y * qT, z: axis.z * qT };
        const transT = createTranslationTransform(shift);
        const rotT = createAxisAngleTransform(axis, qR);
        motionT = multiplyTransforms(transT, rotT);
        break;
      }

      case 'PLANAR': {
        // 2 translations in plane (u, v) + 1 rotation theta around plane normal
        let u = 0;
        let v = 0;
        let theta = 0;
        if (Array.isArray(coordVal)) {
          u = coordVal[0] ?? 0;
          v = coordVal[1] ?? 0;
          theta = coordVal[2] ?? 0;
        } else if (typeof coordVal === 'object' && coordVal !== null) {
          u = (coordVal as any).u ?? (coordVal as any).x ?? 0;
          v = (coordVal as any).v ?? (coordVal as any).y ?? 0;
          theta = (coordVal as any).theta ?? (coordVal as any).rz ?? 0;
        }
        const normal = vecNormalize(joint.parameters.planeNormal || { x: 0, y: 0, z: 1 });
        const transT = createTranslationTransform({ x: u, y: v, z: 0 });
        const rotT = createAxisAngleTransform(normal, theta);
        motionT = multiplyTransforms(transT, rotT);
        break;
      }

      case 'BALL': {
        // 3 rotational DOF, 0 translation
        if (typeof coordVal === 'object' && coordVal !== null) {
          if ('qx' in coordVal && 'qy' in coordVal && 'qz' in coordVal && 'qw' in coordVal) {
            motionT = createQuaternionTransform(
              (coordVal as any).qx,
              (coordVal as any).qy,
              (coordVal as any).qz,
              (coordVal as any).qw
            );
          } else {
            const rx = (coordVal as any).rx ?? (coordVal as any).x ?? 0;
            const ry = (coordVal as any).ry ?? (coordVal as any).y ?? 0;
            const rz = (coordVal as any).rz ?? (coordVal as any).z ?? 0;
            const rotX = createAxisAngleTransform({ x: 1, y: 0, z: 0 }, rx);
            const rotY = createAxisAngleTransform({ x: 0, y: 1, z: 0 }, ry);
            const rotZ = createAxisAngleTransform({ x: 0, y: 0, z: 1 }, rz);
            motionT = multiplyTransforms(rotZ, multiplyTransforms(rotY, rotX));
          }
        }
        break;
      }

      case 'UNIVERSAL': {
        // 2 orthogonal rotational DOF
        let q1 = 0;
        let q2 = 0;
        if (Array.isArray(coordVal)) {
          q1 = coordVal[0] ?? 0;
          q2 = coordVal[1] ?? 0;
        } else if (typeof coordVal === 'object' && coordVal !== null) {
          q1 = (coordVal as any).q1 ?? (coordVal as any).rx ?? 0;
          q2 = (coordVal as any).q2 ?? (coordVal as any).ry ?? 0;
        }
        const rot1 = createAxisAngleTransform({ x: 1, y: 0, z: 0 }, q1);
        const rot2 = createAxisAngleTransform({ x: 0, y: 1, z: 0 }, q2);
        motionT = multiplyTransforms(rot2, rot1);
        break;
      }

      default:
        motionT = createIdentityTransform();
        break;
    }

    // T_rel = ParentFrame * Motion * ChildFrame^-1
    return multiplyTransforms(parentFrameT, multiplyTransforms(motionT, invChildFrameT));
  }

  /**
   * Computes the geometric residual between actual child transform and expected parent*T_rel transform
   */
  public static computeJointResidual(
    joint: KinematicJoint,
    parentTransform: number[][],
    childTransform: number[][],
    currentCoordinate?: JointCoordinateValue
  ): number {
    const expectedT = multiplyTransforms(
      parentTransform,
      this.computeRelativeTransform(joint, currentCoordinate ?? joint.position)
    );

    let maxDiff = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const diff = Math.abs(childTransform[i][j] - expectedT[i][j]);
        if (diff > maxDiff) {
          maxDiff = diff;
        }
      }
    }
    return maxDiff;
  }
}
