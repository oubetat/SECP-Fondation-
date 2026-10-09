import { JointCoordinateValue } from './KinematicJointModel';
import { Vector3D } from '../../cadKernel';

/**
 * Engineering motion command representing a verified kinematic state change
 */
export interface KinematicMotionCommand {
  jointId: string;
  targetPosition?: JointCoordinateValue;
  targetVelocity?: number | number[] | Vector3D | { [key: string]: number };
  targetAcceleration?: number | number[] | Vector3D | { [key: string]: number };
  requestedAt: string;
  parentRevisionId: string;
}

export interface MotionExecutionOptions {
  clampToLimits?: boolean;
  tolerance?: number;
  enforceAssemblyConstraints?: boolean;
}
