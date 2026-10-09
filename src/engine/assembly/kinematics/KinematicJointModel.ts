import { Vector3D } from '../../cadKernel';

export type KinematicJointType =
  | 'FIXED'
  | 'REVOLUTE'
  | 'PRISMATIC'
  | 'CYLINDRICAL'
  | 'PLANAR'
  | 'BALL'
  | 'UNIVERSAL';

/**
 * Explicit idealized degrees of freedom per joint type.
 * Note: UNIVERSAL is 2 DOF, marked UNPROVEN if unexecutable.
 */
export const IDEALIZED_JOINT_DOF: Record<KinematicJointType, number> = {
  FIXED: 0,
  REVOLUTE: 1,
  PRISMATIC: 1,
  CYLINDRICAL: 2,
  PLANAR: 3,
  BALL: 3,
  UNIVERSAL: 2,
};

export interface JointLimits {
  min?: number;
  max?: number;
  min2?: number;          // Secondary coordinate limit (e.g. translation in cylindrical / planar)
  max2?: number;
  min3?: number;          // Tertiary coordinate limit (e.g. angle in planar / ball)
  max3?: number;
  velocityMax?: number;
  accelerationMax?: number;
}

export interface KinematicFrame {
  origin: Vector3D;
  primaryAxis: Vector3D;     // Z or primary direction (must be normalized)
  secondaryAxis?: Vector3D;   // X or secondary direction (must be orthogonal & normalized)
  transform?: number[][];    // 4x4 matrix representation
}

export interface KinematicJointParameters {
  axis?: Vector3D;
  origin?: Vector3D;
  planeNormal?: Vector3D;
  initialPosition?: number | number[] | Vector3D;
  [key: string]: unknown;
}

export type JointCoordinateValue = number | number[] | Vector3D | { rx: number; ry: number; rz: number; qx?: number; qy?: number; qz?: number; qw?: number };

export interface KinematicJoint {
  jointId: string;
  assemblyId: string;
  parentBodyId: string;
  childBodyId: string;
  jointType: KinematicJointType;

  parentFrame: KinematicFrame;
  childFrame: KinematicFrame;

  parameters: KinematicJointParameters;

  limits?: JointLimits;
  enabled: boolean;
  suppressed: boolean;

  position: JointCoordinateValue;
  velocity?: number | number[] | Vector3D | { [key: string]: number };
  acceleration?: number | number[] | Vector3D | { [key: string]: number };

  tolerance: number;
  createdAt: string;
}
