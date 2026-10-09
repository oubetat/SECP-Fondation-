/**
 * SECP Industrial OS — EPC-044: Robot Forward Kinematics Engine
 * Computes end-effector 3D pose (position & orientation) from serial joint configurations.
 * Reuses core SECP infrastructure:
 * - TransformMatrix & Vector3D math
 * - RobotKinematicChainManager & RobotJointDesignEngine
 * - Sequential homogeneous coordinate transformation chain composition
 * - Deterministic validation & numerical tolerance enforcement
 */

import { Vector3D } from '../../cadKernel';
import { Matrix4x4 } from '../../assembly/graph/types';
import { TransformMatrix } from '../../assembly/graph/TransformMatrix';
import { KinematicJointDefinition } from './RobotKinematicTypes';
import { RobotKinematicChainManager } from './RobotKinematicChainManager';
import {
  ForwardKinematicsInput,
  ForwardKinematicsResult,
  ForwardKinematicsCalculationStatus,
  TransformationStep,
  JointConfigDetail,
  EndEffectorOrientation
} from './RobotForwardKinematicsTypes';

export class RobotForwardKinematicsEngine {
  public static readonly DEFAULT_POSITION_TOLERANCE_MM = 1e-5;
  public static readonly DEFAULT_ORIENTATION_TOLERANCE_DEG = 1e-5;

  private chainManager: RobotKinematicChainManager;

  constructor(chainManager?: RobotKinematicChainManager) {
    this.chainManager = chainManager || new RobotKinematicChainManager();
  }

  /**
   * Convert 3x3 rotation matrix to unit quaternion [w, x, y, z]
   */
  public static matrixToQuaternion(R: number[][]): { w: number; x: number; y: number; z: number } {
    const m00 = R[0][0], m01 = R[0][1], m02 = R[0][2];
    const m10 = R[1][0], m11 = R[1][1], m12 = R[1][2];
    const m20 = R[2][0], m21 = R[2][1], m22 = R[2][2];

    const trace = m00 + m11 + m22;
    let w = 1, x = 0, y = 0, z = 0;

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0);
      w = 0.25 / s;
      x = (m21 - m12) * s;
      y = (m02 - m20) * s;
      z = (m10 - m01) * s;
    } else if (m00 > m11 && m00 > m22) {
      const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
      w = (m21 - m12) / s;
      x = 0.25 * s;
      y = (m01 + m10) / s;
      z = (m02 + m20) / s;
    } else if (m11 > m22) {
      const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
      w = (m02 - m20) / s;
      x = (m01 + m10) / s;
      y = 0.25 * s;
      z = (m12 + m21) / s;
    } else {
      const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
      w = (m10 - m01) / s;
      x = (m02 + m20) / s;
      y = (m12 + m21) / s;
      z = 0.25 * s;
    }

    const norm = Math.sqrt(w * w + x * x + y * y + z * z);
    if (norm > 1e-12) {
      w /= norm;
      x /= norm;
      y /= norm;
      z /= norm;
    }

    return {
      w: Number(w.toFixed(8)),
      x: Number(x.toFixed(8)),
      y: Number(y.toFixed(8)),
      z: Number(z.toFixed(8))
    };
  }

  /**
   * Extract Euler ZYX (yaw, pitch, roll) angles in degrees from 3x3 rotation matrix
   */
  public static extractEulerZYXDeg(R: number[][]): Vector3D {
    const rad2deg = 180 / Math.PI;
    const sy = Math.sqrt(R[0][0] * R[0][0] + R[1][0] * R[1][0]);

    let x = 0;
    let y = 0;
    let z = 0;

    if (sy > 1e-6) {
      x = Math.atan2(R[2][1], R[2][2]) * rad2deg;
      y = Math.atan2(-R[2][0], sy) * rad2deg;
      z = Math.atan2(R[1][0], R[0][0]) * rad2deg;
    } else {
      x = Math.atan2(-R[1][2], R[1][1]) * rad2deg;
      y = Math.atan2(-R[2][0], sy) * rad2deg;
      z = 0;
    }

    return {
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
      z: Number(z.toFixed(4))
    };
  }

  /**
   * Extract Euler XYZ (roll, pitch, yaw) angles in degrees from 3x3 rotation matrix
   */
  public static extractEulerXYZDeg(R: number[][]): Vector3D {
    const rad2deg = 180 / Math.PI;
    const clampedM02 = Math.max(-1, Math.min(1, R[0][2]));

    let x = 0;
    let y = Math.asin(clampedM02) * rad2deg;
    let z = 0;

    if (Math.abs(clampedM02) < 0.99999) {
      x = Math.atan2(-R[1][2], R[2][2]) * rad2deg;
      z = Math.atan2(-R[0][1], R[0][0]) * rad2deg;
    } else {
      x = Math.atan2(R[2][1], R[1][1]) * rad2deg;
      z = 0;
    }

    return {
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
      z: Number(z.toFixed(4))
    };
  }

  /**
   * Compute Forward Kinematics for a given kinematic input configuration
   */
  public compute(input: ForwardKinematicsInput): ForwardKinematicsResult {
    const jointDefs = input.jointDefinitions;
    const jointStatesRaw = input.jointStates;

    // Parse joint state values into map
    const jointValueMap = new Map<string, number>();
    if (Array.isArray(jointStatesRaw)) {
      for (const js of jointStatesRaw) {
        let pos = js.position;
        // Unit conversion if needed
        if (js.unit === 'rad') {
          pos = (pos * 180) / Math.PI;
        } else if (js.unit === 'm') {
          pos = pos * 1000;
        }
        jointValueMap.set(js.jointId, pos);
      }
    } else {
      for (const [key, val] of Object.entries(jointStatesRaw)) {
        jointValueMap.set(key, val);
      }
    }

    let status: ForwardKinematicsCalculationStatus = 'VALID';
    const jointConfigDetails: Record<string, JointConfigDetail> = {};

    // Validate joint limits
    for (const jDef of jointDefs) {
      const pos = jointValueMap.get(jDef.jointId) ?? jDef.state.position ?? 0;
      const min = jDef.limits.minimumPosition;
      const max = jDef.limits.maximumPosition;
      const withinLimits = pos >= min - 1e-6 && pos <= max + 1e-6;

      if (!withinLimits) {
        status = 'INVALID_LIMITS';
      }

      const unit = jDef.jointType === 'REVOLUTE' ? 'deg' : jDef.jointType === 'PRISMATIC' ? 'mm' : 'N/A';
      jointConfigDetails[jDef.jointId] = {
        jointId: jDef.jointId,
        jointType: jDef.jointType,
        position: pos,
        unit,
        isWithinLimits: withinLimits,
        minLimit: min,
        maxLimit: max
      };
    }

    // Compute sequential transformation chain
    let T_accum = TransformMatrix.identity();
    const sequence: TransformationStep[] = [];

    let stepCounter = 1;
    let prevFrame = input.baseFrame;

    for (const jDef of jointDefs) {
      const q = jointValueMap.get(jDef.jointId) ?? jDef.state.position ?? 0;
      let T_local = TransformMatrix.identity();

      if (jDef.jointType === 'REVOLUTE') {
        const rotMat = RobotKinematicChainManager.rotationAroundAxis(jDef.axis, q);
        T_local = TransformMatrix.multiply(jDef.originTransform, rotMat);
      } else if (jDef.jointType === 'PRISMATIC') {
        const len = Math.sqrt(jDef.axis.x * jDef.axis.x + jDef.axis.y * jDef.axis.y + jDef.axis.z * jDef.axis.z);
        const ux = len > 1e-12 ? jDef.axis.x / len : 0;
        const uy = len > 1e-12 ? jDef.axis.y / len : 0;
        const uz = len > 1e-12 ? jDef.axis.z / len : 1;
        const transMat = TransformMatrix.translation(ux * q, uy * q, uz * q);
        T_local = TransformMatrix.multiply(jDef.originTransform, transMat);
      } else {
        T_local = jDef.originTransform;
      }

      T_accum = TransformMatrix.multiply(T_accum, T_local);

      const nextFrame = `FRAME-${jDef.jointId}`;
      const unit = jDef.jointType === 'REVOLUTE' ? 'deg' : 'mm';

      sequence.push({
        step: stepCounter++,
        jointId: jDef.jointId,
        jointType: jDef.jointType,
        parentFrame: prevFrame,
        childFrame: nextFrame,
        jointValue: q,
        unit,
        localTransform: T_local,
        accumulatedTransform: T_accum
      });

      prevFrame = nextFrame;
    }

    // Extract end-effector position
    const endEffectorPosition: Vector3D = {
      x: Number(T_accum[0][3].toFixed(6)),
      y: Number(T_accum[1][3].toFixed(6)),
      z: Number(T_accum[2][3].toFixed(6))
    };

    // Extract 3x3 rotation matrix
    const R: number[][] = [
      [T_accum[0][0], T_accum[0][1], T_accum[0][2]],
      [T_accum[1][0], T_accum[1][1], T_accum[1][2]],
      [T_accum[2][0], T_accum[2][1], T_accum[2][2]]
    ];

    const quaternion = RobotForwardKinematicsEngine.matrixToQuaternion(R);
    const eulerXYZDeg = RobotForwardKinematicsEngine.extractEulerXYZDeg(R);
    const eulerZYXDeg = RobotForwardKinematicsEngine.extractEulerZYXDeg(R);

    const orientation: EndEffectorOrientation = {
      rotationMatrix: R,
      quaternion,
      eulerXYZDeg,
      eulerZYXDeg
    };

    return {
      robotId: input.robotId,
      configurationId: input.configurationId,
      kinematicChainId: input.kinematicChainId,
      robotRevision: input.revision,
      baseFrame: input.baseFrame,
      endEffectorFrame: input.endEffectorFrame,
      calculationStatus: status,
      endEffectorPosition,
      endEffectorOrientation: orientation,
      homogeneousTransform: T_accum,
      jointConfiguration: jointConfigDetails,
      transformationSequence: sequence,
      positionTolerance: RobotForwardKinematicsEngine.DEFAULT_POSITION_TOLERANCE_MM,
      orientationTolerance: RobotForwardKinematicsEngine.DEFAULT_ORIENTATION_TOLERANCE_DEG
    };
  }

  /**
   * Helper method to run Forward Kinematics directly on the internal chain manager with custom joint values
   */
  public computeFromChainManager(jointPositions?: Record<string, number>): ForwardKinematicsResult {
    const joints = this.chainManager.getJoints();
    const jointStates: Record<string, number> = {};

    for (const j of joints) {
      jointStates[j.jointId] = jointPositions?.[j.jointId] ?? j.state.position ?? 0;
    }

    const input: ForwardKinematicsInput = {
      robotId: this.chainManager.robotId,
      configurationId: 'CONFIG-FK-STD-01',
      kinematicChainId: this.chainManager.chainId,
      baseFrame: 'FRAME-WORLD',
      jointDefinitions: joints,
      jointStates,
      endEffectorFrame: 'FRAME-END-EFFECTOR',
      unitSystem: 'SI_MM_DEG',
      revision: this.chainManager.revision
    };

    return this.compute(input);
  }
}
