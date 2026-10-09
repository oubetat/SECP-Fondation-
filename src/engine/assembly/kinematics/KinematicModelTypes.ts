/**
 * PATCH-SECP-229 — Kinematic Solver Model Types
 * 
 * Data models and interfaces for exact multi-body kinematic solving:
 *  - Bodies, Components, Reference Frames
 *  - Joints, Constraints, Motion Links
 *  - System DOFs, Driving Variables, Dependent Variables
 *  - Position vector q, Velocity vector q_dot, Acceleration vector q_ddot
 *  - Non-linear constraint residuals, Jacobian evaluation, convergence metrics
 *  - Collision events & clearance thresholds
 *  - PLM Auditability & SHA-256 evidence hashing
 */

import { Vector3D } from '../../cadKernel';
import { MechanicalJointType, CoordinateFrame3D, Matrix3x3, TransformMatrix4x4 } from '../joints/MechanicalJointTypes';
import { MotionLinkType } from '../motionLinks/MotionLinkTypes';

export type KinematicSolverStatus =
  | 'CONVERGED'
  | 'MAX_ITERATIONS_EXCEEDED'
  | 'SINGULAR_JACOBIAN'
  | 'CONSTRAINT_CONFLICT'
  | 'UNDER_CONSTRAINED'
  | 'OVER_CONSTRAINED'
  | 'COLLISION_STOP'
  | 'UNSOLVED';

export type DriverMotionType =
  | 'CONSTANT_VELOCITY'
  | 'CONSTANT_ACCELERATION'
  | 'HARMONIC_OSCILLATION'
  | 'RAMP'
  | 'CUSTOM_EXPRESSION';

export interface RigidBodyKinematicState {
  id: string;
  name: string;
  isFixedGround: boolean;
  isGroundGround?: boolean;
  
  // Position in global frame (mm)
  position: Vector3D;
  
  // Orientation as unit quaternion [w, x, y, z] or rotation matrix
  orientationQuaternion: [number, number, number, number];
  rotationMatrix: Matrix3x3;
  transform: TransformMatrix4x4;
  
  // First-order kinematics (Velocities)
  linearVelocity: Vector3D;  // mm/s
  angularVelocity: Vector3D; // rad/s
  
  // Second-order kinematics (Accelerations)
  linearAcceleration: Vector3D;  // mm/s²
  angularAcceleration: Vector3D; // rad/s²
  
  // Reference Frames attached to this body
  localFrames: CoordinateFrame3D[];
}

export interface JointKinematicConstraint {
  id: string;
  name: string;
  type: MechanicalJointType;
  bodyAId: string; // Base / Parent body ID
  bodyBId: string; // Follower / Child body ID
  
  frameA: CoordinateFrame3D; // Datum frame on body A
  frameB: CoordinateFrame3D; // Datum frame on body B
  
  // Joint primary DOF coordinates (e.g., angle θ in rad or distance x in mm)
  dofCoordinates: number[];
  dofVelocities: number[];
  dofAccelerations: number[];
  
  // Limits
  limitsEnabled: boolean;
  minLimit?: number;
  maxLimit?: number;
  
  // Number of independent kinematic constraint scalar equations imposed on system
  constraintEquationCount: number;
}

export interface MotionLinkKinematicConstraint {
  id: string;
  name: string;
  type: MotionLinkType;
  driverJointId?: string;
  followerJointId?: string;
  jointAId?: string;
  jointBId?: string;
  ratio?: number;
  enabled?: boolean;
  
  gearRatio?: number;
  pitchRadiusA?: number;
  pitchRadiusB?: number;
  leadPitch?: number; // mm per turn
  directionInverted?: boolean;
  phaseOffsetRad?: number;
  
  // Scalar relationship equation count
  constraintEquationCount?: number;
}

export interface KinematicMotionDriver {
  id: string;
  name: string;
  targetJointId: string;
  dofIndex: number; // 0 for primary joint coordinate
  motionType: DriverMotionType;
  
  // Drivers: q_drive(t), v_drive(t), a_drive(t)
  targetRPM?: number;          // rotational RPM
  targetVelocity?: number;     // linear mm/s or angular rad/s
  amplitude?: number;          // mm or rad
  frequencyHz?: number;        // Hz
  phaseOffsetRad?: number;
  constantAcceleration?: number;// mm/s² or rad/s²
  
  enabled: boolean;
}

export interface SystemDOFSummary {
  numBodies: number;
  numGrounds: number;
  numJoints: number;
  numMotionLinks: number;
  grossDegreesOfFreedom: number; // 6 * (N - 1)
  numConstraintEquations: number;
  netDegreesOfFreedom: number;   // M = 6*(N-1) - sum(C_i)
  
  numDrivenDOFs: number;
  numIndependentDOFs: number;
  numRedundantConstraints: number;
  
  mobilityState: 'FULLY_CONSTRAINED' | 'UNDER_CONSTRAINED' | 'OVER_CONSTRAINED' | 'FREE_MOTION';
  jacobianRank: number;
  jacobianConditionNumber: number;
  isSingular: boolean;
  singularValues: number[];
}

export interface KinematicSolveResult {
  status: KinematicSolverStatus;
  timestamp: string;
  timeSeconds: number;
  
  iterations: number;
  maxResidualNorm: number;
  residualVector: number[];
  
  solveTimeMs: number;
  
  // Solved state vectors
  generalizedPositions: number[]; // q
  generalizedVelocities: number[]; // q_dot
  generalizedAccelerations: number[]; // q_ddot
  
  // Body states after solve
  bodies: Map<string, RigidBodyKinematicState>;
  
  // DOF analysis
  dofSummary: SystemDOFSummary;
  
  // Interference & Clearance
  collisionDetected: boolean;
  minClearanceMm: number;
  interferingPairNames?: [string, string][];
  
  // Diagnostics
  diagnostics: string[];
  reproducibilityHash: string;
}

export interface KinematicSolverConfig {
  maxNewtonIterations: number;
  positionTolerance: number;   // e.g. 1e-6 mm
  velocityTolerance: number;   // e.g. 1e-5 mm/s
  accelerationTolerance: number; // e.g. 1e-4 mm/s²
  dampingFactor: number;       // Levenberg-Marquardt damping parameter
  detectSingularities: boolean;
  haltOnCollision: boolean;
  requiredClearanceMm: number;
}

export interface KinematicTrajectoryFrame {
  stepIndex: number;
  timeSeconds: number;
  driverValues: Map<string, number>;
  jointPositions: Map<string, number>;
  jointVelocities: Map<string, number>;
  jointAccelerations: Map<string, number>;
  residualNorm: number;
  converged: boolean;
  minClearanceMm: number;
  hasCollision: boolean;
}
