/**
 * SECP Industrial OS — EPC-044: Independent Kinematic Reference Verifier
 * Implements an independent mathematical reference solver for forward kinematics,
 * performing independent transformation chain calculations and cross-checking
 * SECP Forward Kinematics output against reference calculations.
 */

import { Vector3D } from '../../cadKernel';
import { Matrix4x4 } from '../../assembly/graph/types';
import { TransformMatrix } from '../../assembly/graph/TransformMatrix';
import { KinematicJointDefinition } from './RobotKinematicTypes';
import {
  ForwardKinematicsResult,
  ForwardKinematicsComparison,
  IndependentReferenceResult
} from './RobotForwardKinematicsTypes';

export class RobotKinematicIndependentVerifier {
  /**
   * Independent reference calculation for a serial joint chain.
   * Directly computes joint relative transforms from scratch using standard trigonometric formulas,
   * without calling the production engine's internal state manager.
   */
  public static computeReferenceFK(
    jointDefinitions: KinematicJointDefinition[],
    jointValues: Record<string, number>
  ): IndependentReferenceResult {
    let T_accum = TransformMatrix.identity();

    for (const joint of jointDefinitions) {
      const val = jointValues[joint.jointId] ?? joint.state.position ?? 0;
      let T_local = TransformMatrix.identity();

      if (joint.jointType === 'REVOLUTE') {
        const rad = (val * Math.PI) / 180;
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        const C = 1 - c;

        // Axis normalization
        const len = Math.sqrt(
          joint.axis.x * joint.axis.x + joint.axis.y * joint.axis.y + joint.axis.z * joint.axis.z
        );
        const ux = len > 1e-12 ? joint.axis.x / len : 0;
        const uy = len > 1e-12 ? joint.axis.y / len : 0;
        const uz = len > 1e-12 ? joint.axis.z / len : 1;

        const R_joint: Matrix4x4 = [
          [ux * ux * C + c, ux * uy * C - uz * s, ux * uz * C + uy * s, 0],
          [uy * ux * C + uz * s, uy * uy * C + c, uy * uz * C - ux * s, 0],
          [uz * ux * C - uy * s, uz * uy * C + ux * s, uz * uz * C + c, 0],
          [0, 0, 0, 1]
        ];

        T_local = TransformMatrix.multiply(joint.originTransform, R_joint);
      } else if (joint.jointType === 'PRISMATIC') {
        const len = Math.sqrt(
          joint.axis.x * joint.axis.x + joint.axis.y * joint.axis.y + joint.axis.z * joint.axis.z
        );
        const ux = len > 1e-12 ? joint.axis.x / len : 0;
        const uy = len > 1e-12 ? joint.axis.y / len : 0;
        const uz = len > 1e-12 ? joint.axis.z / len : 1;

        const T_trans = TransformMatrix.translation(ux * val, uy * val, uz * val);
        T_local = TransformMatrix.multiply(joint.originTransform, T_trans);
      } else {
        T_local = joint.originTransform;
      }

      T_accum = TransformMatrix.multiply(T_accum, T_local);
    }

    const position: Vector3D = {
      x: T_accum[0][3],
      y: T_accum[1][3],
      z: T_accum[2][3]
    };

    const rotationMatrix: number[][] = [
      [T_accum[0][0], T_accum[0][1], T_accum[0][2]],
      [T_accum[1][0], T_accum[1][1], T_accum[1][2]],
      [T_accum[2][0], T_accum[2][1], T_accum[2][2]]
    ];

    return {
      position,
      rotationMatrix,
      method: 'Independent Matrix Chain Multiplication Engine (Reference)'
    };
  }

  /**
   * Compares SECP Forward Kinematics result against independent reference computation.
   */
  public static verifyResult(
    secpResult: ForwardKinematicsResult,
    jointDefinitions: KinematicJointDefinition[]
  ): ForwardKinematicsComparison {
    const jointValues: Record<string, number> = {};
    for (const [jId, detail] of Object.entries(secpResult.jointConfiguration)) {
      jointValues[jId] = detail.position;
    }

    const ref = RobotKinematicIndependentVerifier.computeReferenceFK(jointDefinitions, jointValues);

    // Compute Euclidean position error
    const dx = secpResult.endEffectorPosition.x - ref.position.x;
    const dy = secpResult.endEffectorPosition.y - ref.position.y;
    const dz = secpResult.endEffectorPosition.z - ref.position.z;
    const positionError = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Compute Orientation Matrix element-wise max deviation
    let maxRotDiff = 0;
    const R_secp = secpResult.endEffectorOrientation.rotationMatrix;
    const R_ref = ref.rotationMatrix;

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const diff = Math.abs(R_secp[r][c] - R_ref[r][c]);
        if (diff > maxRotDiff) {
          maxRotDiff = diff;
        }
      }
    }

    const posTol = secpResult.positionTolerance;
    const rotTol = secpResult.orientationTolerance;

    const passed = positionError <= posTol && maxRotDiff <= rotTol;

    return {
      referenceResult: ref,
      positionError,
      orientationError: maxRotDiff,
      passed,
      positionTolerance: posTol,
      orientationTolerance: rotTol
    };
  }
}
