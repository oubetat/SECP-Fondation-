/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-258 — Kinematic Chain & Rigid Body Node Hierarchy
 */

import { Vector3D } from '../../cadKernel';
import { 
  FiveAxisMachineDefinition, 
  KinematicChainNode, 
  KinematicJointDefinition,
  MachineAxesState,
  MachineArchitectureType,
  MachineKinematicTopology
} from './FiveAxisTypes';
import { FiveAxisMathUtils, Matrix4x4 } from './FiveAxisMathUtils';

export class FiveAxisKinematicChain {
  /**
   * Builds standard kinematic chain nodes for a given machine definition
   */
  public static buildKinematicChain(
    architecture: MachineArchitectureType,
    topology: MachineKinematicTopology,
    tableCenterMm: Vector3D,
    gaugePivotOffsetMm: Vector3D
  ): KinematicChainNode[] {
    const nodes: KinematicChainNode[] = [];

    // Base Frame
    const baseJoint: KinematicJointDefinition = {
      axisName: 'X',
      axisType: 'LINEAR',
      axisVector: { x: 1, y: 0, z: 0 },
      pivotCenterMm: { x: 0, y: 0, z: 0 },
      minLimit: -1000,
      maxLimit: 1000,
      maxVelocity: 50000,
      maxAcceleration: 5000
    };
    nodes.push({
      id: 'NODE_BASE',
      name: 'Machine Base Bed',
      joint: baseJoint,
      transformFromParent: FiveAxisMathUtils.identityMatrix()
    });

    // Linear X, Y, Z Stages
    const xJoint: KinematicJointDefinition = {
      axisName: 'X',
      axisType: 'LINEAR',
      axisVector: { x: 1, y: 0, z: 0 },
      pivotCenterMm: { x: 0, y: 0, z: 0 },
      minLimit: -500,
      maxLimit: 500,
      maxVelocity: 50000,
      maxAcceleration: 5000
    };
    nodes.push({
      id: 'NODE_LINEAR_X',
      name: 'X-Axis Carriage',
      parentJointId: 'NODE_BASE',
      joint: xJoint,
      transformFromParent: FiveAxisMathUtils.identityMatrix()
    });

    const yJoint: KinematicJointDefinition = {
      axisName: 'Y',
      axisType: 'LINEAR',
      axisVector: { x: 0, y: 1, z: 0 },
      pivotCenterMm: { x: 0, y: 0, z: 0 },
      minLimit: -500,
      maxLimit: 500,
      maxVelocity: 50000,
      maxAcceleration: 5000
    };
    nodes.push({
      id: 'NODE_LINEAR_Y',
      name: 'Y-Axis Saddle',
      parentJointId: 'NODE_LINEAR_X',
      joint: yJoint,
      transformFromParent: FiveAxisMathUtils.identityMatrix()
    });

    const zJoint: KinematicJointDefinition = {
      axisName: 'Z',
      axisType: 'LINEAR',
      axisVector: { x: 0, y: 0, z: 1 },
      pivotCenterMm: { x: 0, y: 0, z: 0 },
      minLimit: -500,
      maxLimit: 200,
      maxVelocity: 50000,
      maxAcceleration: 5000
    };
    nodes.push({
      id: 'NODE_LINEAR_Z',
      name: 'Z-Axis Column/Ram',
      parentJointId: 'NODE_LINEAR_Y',
      joint: zJoint,
      transformFromParent: FiveAxisMathUtils.identityMatrix()
    });

    // Architecture-specific Rotary Nodes
    if (architecture === 'TABLE_TABLE') {
      const isAC = topology === 'TABLE_TABLE_AC';
      // Primary table tilt (A or B)
      const primaryRotary: KinematicJointDefinition = {
        axisName: isAC ? 'A' : 'B',
        axisType: 'ROTARY',
        axisVector: isAC ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 },
        pivotCenterMm: tableCenterMm,
        minLimit: -120,
        maxLimit: 120,
        maxVelocity: 18000,
        maxAcceleration: 2000
      };
      nodes.push({
        id: 'NODE_TABLE_TILT',
        name: isAC ? 'Trunnion Cradle (A-Axis)' : 'Swivel Cradle (B-Axis)',
        parentJointId: 'NODE_BASE',
        joint: primaryRotary,
        transformFromParent: FiveAxisMathUtils.translationMatrix(tableCenterMm.x, tableCenterMm.y, tableCenterMm.z)
      });

      // Secondary rotary platter (C)
      const secondaryRotary: KinematicJointDefinition = {
        axisName: 'C',
        axisType: 'ROTARY',
        axisVector: { x: 0, y: 0, z: 1 },
        pivotCenterMm: tableCenterMm,
        minLimit: -9999,
        maxLimit: 9999,
        maxVelocity: 36000,
        maxAcceleration: 3000,
        isContinuousRotation: true
      };
      nodes.push({
        id: 'NODE_TABLE_ROTARY',
        name: 'Rotary Platter (C-Axis)',
        parentJointId: 'NODE_TABLE_TILT',
        joint: secondaryRotary,
        transformFromParent: FiveAxisMathUtils.identityMatrix()
      });
    } else if (architecture === 'HEAD_HEAD') {
      const isAB = topology === 'HEAD_HEAD_AB';
      // Primary head swivel
      const primaryHead: KinematicJointDefinition = {
        axisName: isAB ? 'A' : 'B',
        axisType: 'ROTARY',
        axisVector: isAB ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 },
        pivotCenterMm: gaugePivotOffsetMm,
        minLimit: -110,
        maxLimit: 110,
        maxVelocity: 15000,
        maxAcceleration: 1800
      };
      nodes.push({
        id: 'NODE_HEAD_SWIVEL_1',
        name: isAB ? 'Fork Swivel (A-Axis)' : 'Fork Swivel (B-Axis)',
        parentJointId: 'NODE_LINEAR_Z',
        joint: primaryHead,
        transformFromParent: FiveAxisMathUtils.translationMatrix(0, 0, -gaugePivotOffsetMm.z)
      });

      // Secondary head swivel
      const secondaryHead: KinematicJointDefinition = {
        axisName: isAB ? 'B' : 'C',
        axisType: 'ROTARY',
        axisVector: isAB ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 },
        pivotCenterMm: { x: 0, y: 0, z: 0 },
        minLimit: isAB ? -180 : -9999,
        maxLimit: isAB ? 180 : 9999,
        maxVelocity: 18000,
        maxAcceleration: 2000,
        isContinuousRotation: !isAB
      };
      nodes.push({
        id: 'NODE_HEAD_SWIVEL_2',
        name: isAB ? 'Spindle Head (B-Axis)' : 'Spindle Head (C-Axis)',
        parentJointId: 'NODE_HEAD_SWIVEL_1',
        joint: secondaryHead,
        transformFromParent: FiveAxisMathUtils.identityMatrix()
      });
    } else {
      // HEAD_TABLE (e.g. Head B + Table C)
      const headTilt: KinematicJointDefinition = {
        axisName: topology === 'HEAD_TABLE_AC' ? 'A' : 'B',
        axisType: 'ROTARY',
        axisVector: topology === 'HEAD_TABLE_AC' ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 },
        pivotCenterMm: gaugePivotOffsetMm,
        minLimit: -115,
        maxLimit: 115,
        maxVelocity: 15000,
        maxAcceleration: 2500
      };
      nodes.push({
        id: 'NODE_HEAD_TILT',
        name: 'Nutating / Tilting Head',
        parentJointId: 'NODE_LINEAR_Z',
        joint: headTilt,
        transformFromParent: FiveAxisMathUtils.translationMatrix(0, 0, -gaugePivotOffsetMm.z)
      });

      const tableRotary: KinematicJointDefinition = {
        axisName: 'C',
        axisType: 'ROTARY',
        axisVector: { x: 0, y: 0, z: 1 },
        pivotCenterMm: tableCenterMm,
        minLimit: -9999,
        maxLimit: 9999,
        maxVelocity: 48000,
        maxAcceleration: 4000,
        isContinuousRotation: true
      };
      nodes.push({
        id: 'NODE_TABLE_ROTARY',
        name: 'Rotary Table (C-Axis)',
        parentJointId: 'NODE_BASE',
        joint: tableRotary,
        transformFromParent: FiveAxisMathUtils.translationMatrix(tableCenterMm.x, tableCenterMm.y, tableCenterMm.z)
      });
    }

    return nodes;
  }

  /**
   * Computes the 4x4 transformation matrix for a specific joint given its current state value (q)
   */
  public static computeJointTransform(joint: KinematicJointDefinition, qValue: number): Matrix4x4 {
    if (joint.axisType === 'LINEAR') {
      const tx = joint.axisVector.x * qValue;
      const ty = joint.axisVector.y * qValue;
      const tz = joint.axisVector.z * qValue;
      return FiveAxisMathUtils.translationMatrix(tx, ty, tz);
    } else {
      const rad = qValue * FiveAxisMathUtils.DEG2RAD;
      if (Math.abs(joint.axisVector.x - 1) < 1e-6) {
        return FiveAxisMathUtils.rotationXMatrix(rad);
      } else if (Math.abs(joint.axisVector.y - 1) < 1e-6) {
        return FiveAxisMathUtils.rotationYMatrix(rad);
      } else if (Math.abs(joint.axisVector.z - 1) < 1e-6) {
        return FiveAxisMathUtils.rotationZMatrix(rad);
      } else {
        // Generic axis rotation
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        const u = FiveAxisMathUtils.normalize(joint.axisVector);
        return [
          [c + u.x * u.x * (1 - c), u.x * u.y * (1 - c) - u.z * s, u.x * u.z * (1 - c) + u.y * s, 0],
          [u.y * u.x * (1 - c) + u.z * s, c + u.y * u.y * (1 - c), u.y * u.z * (1 - c) - u.x * s, 0],
          [u.z * u.x * (1 - c) - u.y * s, u.z * u.y * (1 - c) + u.x * s, c + u.z * u.z * (1 - c), 0],
          [0, 0, 0, 1]
        ];
      }
    }
  }
}
