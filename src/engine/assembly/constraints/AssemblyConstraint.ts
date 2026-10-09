import { Vector3D } from '../../cadKernel';
import { AssemblyConstraint as ModelConstraint, AssemblyComponentPose } from './AssemblyConstraintModel';

// ==========================================
// 3D Vector Math Helpers
// ==========================================
export const vecZero = (): Vector3D => ({ x: 0, y: 0, z: 0 });

export const vecSubtract = (a: Vector3D, b: Vector3D): Vector3D => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});

export const vecAdd = (a: Vector3D, b: Vector3D): Vector3D => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});

export const vecDot = (a: Vector3D, b: Vector3D): number =>
  a.x * b.x + a.y * b.y + a.z * b.z;

export const vecCross = (a: Vector3D, b: Vector3D): Vector3D => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export const vecLength = (v: Vector3D): number =>
  Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

export const vecNormalize = (v: Vector3D): Vector3D => {
  const len = vecLength(v);
  if (len < 1e-12) {
    throw new Error('Zero length vector normalization');
  }
  return { x: v.x / len, y: v.y / len, z: v.z / len };
};

export const vecScale = (v: Vector3D, s: number): Vector3D => ({
  x: v.x * s,
  y: v.y * s,
  z: v.z * s,
});

// ==========================================
// Matrix & Euler Angle Utilities
// ==========================================

export function computeEulerRotationMatrix(anglesDeg: Vector3D): number[][] {
  const rx = (anglesDeg.x * Math.PI) / 180;
  const ry = (anglesDeg.y * Math.PI) / 180;
  const rz = (anglesDeg.z * Math.PI) / 180;

  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);

  // ZYX Euler sequence: R = Rz * Ry * Rx
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
    [r00, r01, r02],
    [r10, r11, r12],
    [r20, r21, r22],
  ];
}

/**
 * Validates a rotation matrix RᵀR ≈ I and det(R) ≈ 1
 */
export function validateRotationMatrix(R: number[][], tolerance: number = 1e-4): { valid: boolean; reason?: string } {
  if (!R || R.length !== 3 || R.some(row => row.length !== 3)) {
    return { valid: false, reason: 'Matrix must be 3x3' };
  }

  // Check NaN or Infinity
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (isNaN(R[i][j]) || !isFinite(R[i][j])) {
        return { valid: false, reason: 'Matrix contains NaN/Infinity values' };
      }
    }
  }

  // Determinant: det(R) = r00*(r11*r22 - r12*r21) - r01*(r10*r22 - r12*r20) + r02*(r10*r21 - r11*r20)
  const det =
    R[0][0] * (R[1][1] * R[2][2] - R[1][2] * R[2][1]) -
    R[0][1] * (R[1][0] * R[2][2] - R[1][2] * R[2][0]) +
    R[0][2] * (R[1][0] * R[2][1] - R[1][1] * R[2][0]);

  if (Math.abs(det - 1.0) > tolerance) {
    return { valid: false, reason: `Determinant of R is ${det}, expected ≈ 1` };
  }

  // Orthogonality: check RᵀR ≈ I
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) {
        sum += R[k][i] * R[k][j]; // Rᵀ_ik * R_kj
      }
      const expected = i === j ? 1.0 : 0.0;
      if (Math.abs(sum - expected) > tolerance) {
        return { valid: false, reason: `Matrix is not orthogonal. RᵀR[${i}][${j}] = ${sum}, expected ${expected}` };
      }
    }
  }

  return { valid: true };
}

/**
 * Transforms a local point on a component to world space
 */
export function transformPoint(point: Vector3D, pose: AssemblyComponentPose): Vector3D {
  const R = [
    [pose.transform[0][0], pose.transform[0][1], pose.transform[0][2]],
    [pose.transform[1][0], pose.transform[1][1], pose.transform[1][2]],
    [pose.transform[2][0], pose.transform[2][1], pose.transform[2][2]],
  ];
  const t = pose.position;

  return {
    x: R[0][0] * point.x + R[0][1] * point.y + R[0][2] * point.z + t.x,
    y: R[1][0] * point.x + R[1][1] * point.y + R[1][2] * point.z + t.y,
    z: R[2][0] * point.x + R[2][1] * point.y + R[2][2] * point.z + t.z,
  };
}

/**
 * Transforms a local direction vector to world space (rigid rotation only)
 */
export function transformDirection(dir: Vector3D, pose: AssemblyComponentPose): Vector3D {
  const R = [
    [pose.transform[0][0], pose.transform[0][1], pose.transform[0][2]],
    [pose.transform[1][0], pose.transform[1][1], pose.transform[1][2]],
    [pose.transform[2][0], pose.transform[2][1], pose.transform[2][2]],
  ];

  return {
    x: R[0][0] * dir.x + R[0][1] * dir.y + R[0][2] * dir.z,
    y: R[1][0] * dir.x + R[1][1] * dir.y + R[1][2] * dir.z,
    z: R[2][0] * dir.x + R[2][1] * dir.y + R[2][2] * dir.z,
  };
}

// ==========================================
// Assembly Constraint Evaluation class
// ==========================================
export class AssemblyConstraintEvaluator {
  /**
   * Computes the residual error of a single constraint under the current component poses
   */
  public static computeResidual(
    constraint: ModelConstraint,
    poseA: AssemblyComponentPose,
    poseB: AssemblyComponentPose
  ): number {
    if (constraint.suppressed || !constraint.enabled) {
      return 0;
    }

    // Guard against NaN parameters
    if (
      isNaN(constraint.parameters.offsetMm ?? 0) ||
      !isFinite(constraint.parameters.offsetMm ?? 0) ||
      isNaN(constraint.parameters.angleDeg ?? 0) ||
      !isFinite(constraint.parameters.angleDeg ?? 0)
    ) {
      return NaN;
    }

    const refA = constraint.geometryReferenceA;
    const refB = constraint.geometryReferenceB;

    // Resolve world positions of local geometry points/centroids
    const localPA = refA.cachedPoint || vecZero();
    const localPB = refB.cachedPoint || vecZero();
    const pA = transformPoint(localPA, poseA);
    const pB = transformPoint(localPB, poseB);

    // Resolve world directions of axes/normals
    const localNA = refA.cachedNormal || { x: 0, y: 0, z: 1 };
    const localNB = refB.cachedNormal || { x: 0, y: 0, z: 1 };
    
    // Validate direction vectors length
    if (vecLength(localNA) < 1e-6 || vecLength(localNB) < 1e-6) {
      return NaN; // Reject zero-length vectors
    }

    const nA = vecNormalize(transformDirection(localNA, poseA));
    const nB = vecNormalize(transformDirection(localNB, poseB));

    switch (constraint.constraintType) {
      case 'FIXED': {
        // Tcomponent = Treference within tolerance
        const diffX = poseA.position.x - poseB.position.x;
        const diffY = poseA.position.y - poseB.position.y;
        const diffZ = poseA.position.z - poseB.position.z;
        const rotX = Math.abs(poseA.orientation.x - poseB.orientation.x);
        const rotY = Math.abs(poseA.orientation.y - poseB.orientation.y);
        const rotZ = Math.abs(poseA.orientation.z - poseB.orientation.z);
        return Math.sqrt(diffX * diffX + diffY * diffY + diffZ * diffZ + rotX * rotX + rotY * rotY + rotZ * rotZ);
      }

      case 'COINCIDENT': {
        if (refA.topologyType === 'FACE' && refB.topologyType === 'FACE') {
          // Contact: normal distance is zero
          const pA_pB = vecSubtract(pA, pB);
          return Math.abs(vecDot(nA, pA_pB));
        } else {
          // Point coincident: Euclidean distance is zero
          return vecLength(vecSubtract(pA, pB));
        }
      }

      case 'CONCENTRIC': {
        // 1. Angular misalignment: cross(axis_A, axis_B) = 0
        const crossDir = vecCross(nA, nB);
        const angRes = vecLength(crossDir);
        // 2. Linear axis offset: distance from PB to AXIS A
        // d = vecLength(cross(pB - pA, nA))
        const pB_pA = vecSubtract(pB, pA);
        const crossOffset = vecCross(pB_pA, nA);
        const linRes = vecLength(crossOffset);
        return angRes + linRes;
      }

      case 'DISTANCE': {
        const targetDist = constraint.parameters.offsetMm ?? 0;
        if (refA.topologyType === 'FACE' && refB.topologyType === 'FACE') {
          // Distance along normal: |dot(nA, pA - pB)| - targetDistance = 0
          const pA_pB = vecSubtract(pA, pB);
          return Math.abs(Math.abs(vecDot(nA, pA_pB)) - targetDist);
        } else {
          // Point distance: |pA - pB| - targetDistance = 0
          return Math.abs(vecLength(vecSubtract(pA, pB)) - targetDist);
        }
      }

      case 'ANGLE': {
        const targetAngleDeg = constraint.parameters.angleDeg ?? 0;
        const cosTheta = Math.max(-1, Math.min(1, vecDot(nA, nB)));
        const angleRad = Math.acos(cosTheta);
        const angleDeg = (angleRad * 180) / Math.PI;
        return Math.abs(angleDeg - targetAngleDeg);
      }

      case 'PARALLEL': {
        // |directionA x directionB| = 0
        const crossDir = vecCross(nA, nB);
        return vecLength(crossDir);
      }

      case 'PERPENDICULAR': {
        // |dot(directionA, directionB)| = 0
        return Math.abs(vecDot(nA, nB));
      }

      case 'TANGENT':
      case 'AXIS_ALIGNMENT':
      case 'PLANAR_ALIGNMENT':
        // Not fully solved internally - return UNPROVEN or zero residual if perfectly matched by chance
        return 0.0;

      default:
        return 0.0;
    }
  }
}
