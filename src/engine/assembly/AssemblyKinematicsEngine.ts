/**
 * PATCH-SECP-043 — Assembly Kinematics Engine
 * Provides Kinematic Joint definition and interactive preview:
 *   - Revolute (1 Rotational DOF)
 *   - Prismatic (1 Translational DOF)
 *   - Cylindrical (1 Rotation + 1 Translation DOF)
 *   - Fixed (0 DOF)
 * Supports motion scrubbing, limits enforcement, velocity calculations, and forward kinematic evaluation.
 */

import { Vector3D } from '../cadKernel';
import {
  KinematicJoint,
  KinematicJointType,
  AssemblyComponent,
  computeTransformMatrix
} from './AssemblyConstraintTypes';

export class AssemblyKinematicsEngine {
  /**
   * Evaluates forward kinematics for a joint at a specific position/angle
   */
  public static evaluateJointState(
    joint: KinematicJoint,
    targetPosition: number,
    parentComponent: AssemblyComponent,
    childComponent: AssemblyComponent
  ): {
    updatedPosition: Vector3D;
    updatedRotation: Vector3D;
    clampedPosition: number;
    velocity: number;
  } {
    // 1. Clamp to joint motion range if limits are enabled
    let pos = targetPosition;
    if (joint.limitsEnabled) {
      pos = Math.max(joint.motionRange.min, Math.min(joint.motionRange.max, pos));
    }

    const parentPos = parentComponent.worldTransform.position;
    const parentRot = parentComponent.worldTransform.rotation;

    let updatedPos: Vector3D = { ...childComponent.placementTransform.position };
    let updatedRot: Vector3D = { ...childComponent.placementTransform.rotation };

    const axis = joint.axis;

    switch (joint.type) {
      case 'REVOLUTE': {
        // Rotation around joint axis by pos degrees
        updatedRot = {
          x: parentRot.x + axis.x * pos,
          y: parentRot.y + axis.y * pos,
          z: parentRot.z + axis.z * pos
        };
        // Orbit around joint origin if offset exists
        updatedPos = {
          x: parentPos.x + joint.origin.x,
          y: parentPos.y + joint.origin.y,
          z: parentPos.z + joint.origin.z
        };
        break;
      }

      case 'PRISMATIC': {
        // Linear displacement along joint axis by pos mm
        updatedPos = {
          x: parentPos.x + joint.origin.x + axis.x * pos,
          y: parentPos.y + joint.origin.y + axis.y * pos,
          z: parentPos.z + joint.origin.z + axis.z * pos
        };
        updatedRot = { ...parentRot };
        break;
      }

      case 'CYLINDRICAL': {
        // Rotation around axis + displacement along axis
        updatedRot = {
          x: parentRot.x + axis.x * pos,
          y: parentRot.y + axis.y * pos,
          z: parentRot.z + axis.z * pos
        };
        updatedPos = {
          x: parentPos.x + joint.origin.x + axis.x * (pos * 0.2), // helical pitch ratio
          y: parentPos.y + joint.origin.y + axis.y * (pos * 0.2),
          z: parentPos.z + joint.origin.z + axis.z * (pos * 0.2)
        };
        break;
      }

      case 'FIXED': {
        updatedPos = { ...parentPos };
        updatedRot = { ...parentRot };
        break;
      }
    }

    // Velocity estimation based on position difference
    const dt = 0.016; // 60fps frame delta
    const velocity = (pos - joint.currentPosition) / dt;
    joint.currentPosition = pos;
    joint.velocity = velocity;

    // Update child component world transform matrix
    childComponent.worldTransform = {
      position: updatedPos,
      rotation: updatedRot,
      matrix: computeTransformMatrix(updatedPos, updatedRot, childComponent.placementTransform.scale)
    };

    return {
      updatedPosition: updatedPos,
      updatedRotation: updatedRot,
      clampedPosition: pos,
      velocity
    };
  }

  /**
   * Generates default kinematic joints for common mechanisms (e.g. Gearbox, Crank-slider)
   */
  public static createDefaultKinematicJoints(): KinematicJoint[] {
    return [
      {
        jointId: 'joint-crank-rev',
        name: 'Crankshaft Main Bearing (Revolute)',
        type: 'REVOLUTE',
        parentComponentId: 'comp-block',
        childComponentId: 'comp-crank',
        axis: { x: 0, y: 0, z: 1 },
        origin: { x: 0, y: 0, z: 0 },
        motionRange: { min: -360, max: 360 },
        currentPosition: 0,
        velocity: 120,
        limitsEnabled: false,
        dofRemaining: 1,
        suppressionState: 'ACTIVE'
      },
      {
        jointId: 'joint-piston-prism',
        name: 'Piston Bore Guide (Prismatic)',
        type: 'PRISMATIC',
        parentComponentId: 'comp-block',
        childComponentId: 'comp-piston',
        axis: { x: 0, y: 1, z: 0 },
        origin: { x: 0, y: 60, z: 0 },
        motionRange: { min: -50, max: 50 },
        currentPosition: 0,
        velocity: 45,
        limitsEnabled: true,
        dofRemaining: 1,
        suppressionState: 'ACTIVE'
      },
      {
        jointId: 'joint-valve-cyl',
        name: 'Intake Valve Helical Guide (Cylindrical)',
        type: 'CYLINDRICAL',
        parentComponentId: 'comp-head',
        childComponentId: 'comp-valve',
        axis: { x: 0, y: 0, z: 1 },
        origin: { x: 40, y: 40, z: 180 },
        motionRange: { min: -12, max: 12 },
        currentPosition: 0,
        velocity: 15,
        limitsEnabled: true,
        dofRemaining: 2,
        suppressionState: 'ACTIVE'
      }
    ];
  }
}
