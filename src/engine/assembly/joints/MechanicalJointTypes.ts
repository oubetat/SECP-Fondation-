/**
 * PATCH-SECP-227 — Mechanical Joints Engineering Types
 * 
 * Formal definitions for physical multi-body mechanical joints:
 *  - 14 Mechanical Joint Types with exact mathematical DOF formulations
 *  - Coordinate Frames (Origin, X/Y/Z orthonormal axes, 3x3 SO(3) matrices, 4x4 SE(3) transforms)
 *  - Translational & Rotational DOFs (Tx, Ty, Tz, Rx, Ry, Rz)
 *  - Kinematic Limits, Hard/Soft Stops, Damping, Friction & Joint Stiffness
 *  - Motors (Rotational RPM/Torque, Linear Velocity/Force)
 *  - Analytical Relationships (Screw Pitch, Gear Ratios, Rack & Pinion Radius)
 *  - Joint States (VALID, UNDER_CONSTRAINED, OVER_CONSTRAINED, LIMIT_REACHED, COLLISION, SOLVER_FAILURE, INVALID_GEOMETRY)
 *  - Kutzbach-Grübler Mobility Analysis & Diagnostics
 *  - Cryptographic Provenance & Engineering Event Ledger
 */

import { Vector3D } from '../../cadKernel';

export type MechanicalJointType =
  | 'FIXED'
  | 'REVOLUTE'
  | 'PRISMATIC'
  | 'CYLINDRICAL'
  | 'SPHERICAL'
  | 'PLANAR'
  | 'UNIVERSAL'
  | 'HELICAL_SCREW'
  | 'SLIDER'
  | 'PIN'
  | 'HINGE'
  | 'RACK_AND_PINION'
  | 'GEAR'
  | 'BALL_AND_SOCKET'
  | 'COINCIDENT'
  | 'CONCENTRIC'
  | 'DISTANCE';

export type JointStateStatus =
  | 'VALID'
  | 'UNDER_CONSTRAINED'
  | 'OVER_CONSTRAINED'
  | 'LIMIT_REACHED'
  | 'COLLISION'
  | 'SOLVER_FAILURE'
  | 'INVALID_GEOMETRY';

export type LimitViolationStatus = 'NONE' | 'SOFT_LIMIT_EXCEEDED' | 'HARD_LIMIT_BLOCKED';

export type MotorDriveType = 'NONE' | 'ROTATIONAL_VELOCITY' | 'ROTATIONAL_POSITION' | 'LINEAR_VELOCITY' | 'LINEAR_POSITION' | 'TORQUE_DRIVEN' | 'FORCE_DRIVEN';

export interface Matrix3x3 {
  elements: [
    number, number, number,
    number, number, number,
    number, number, number
  ];
}

export interface TransformMatrix4x4 {
  elements: [
    number, number, number, number,
    number, number, number, number,
    number, number, number, number,
    number, number, number, number
  ];
}

/**
 * Orthonormal 3D Coordinate Frame attached to a component or joint datum
 */
export interface CoordinateFrame3D {
  id: string;
  name: string;
  origin: Vector3D;
  xAxis: Vector3D;
  yAxis: Vector3D;
  zAxis: Vector3D;
  rotationMatrix: Matrix3x3;
  transform: TransformMatrix4x4;
}

/**
 * Degrees of freedom description for a mechanical joint
 */
export interface JointDOFDefinition {
  // Translational DOFs (along joint local X, Y, Z)
  txAllowed: boolean;
  tyAllowed: boolean;
  tzAllowed: boolean;
  
  // Rotational DOFs (around joint local X, Y, Z)
  rxAllowed: boolean;
  ryAllowed: boolean;
  rzAllowed: boolean;
  
  // Coupled DOF flag (e.g. Screw, Gear, Rack & Pinion)
  isCoupled: boolean;
  couplingRatio?: number; // e.g. mm per turn or gear teeth ratio
  
  totalDegreesOfFreedom: number;
  lockedDegreesOfFreedom: number;
}

/**
 * Mechanical Travel and Angular Limits
 */
export interface JointLimit {
  enabled: boolean;
  minimum: number;        // deg for revolute, mm for linear
  maximum: number;        // deg for revolute, mm for linear
  softLimitMin?: number;
  softLimitMax?: number;
  restitution: number;    // Coefficient of restitution on hard stop (0..1)
  damping: number;        // N*s/m or N*m*s/rad
  stiffness: number;      // N/m or N*m/rad for elastic limits
}

/**
 * Motor Actuator Specification
 */
export interface JointMotor {
  enabled: boolean;
  type: MotorDriveType;
  targetValue: number;    // RPM, deg/s, mm/s, target angle (deg), or target pos (mm)
  maxTorqueOrForce: number; // N*m or N
  acceleration: number;   // rad/s^2 or mm/s^2
  direction: 1 | -1;
  timelineProfile?: 'CONSTANT' | 'RAMP' | 'SINUSOIDAL' | 'TRAPEZOIDAL';
}

/**
 * Mechanical Physical Properties (Friction, Damping, Mass)
 */
export interface JointMechanicalProperties {
  staticFrictionCoefficient: number;  // mu_s
  dynamicFrictionCoefficient: number; // mu_d
  viscousDamping: number;              // c
  stiffness: number;                   // k (spring return)
  equilibriumPosition: number;         // neutral position for spring
  breakawayTorqueOrForce: number;      // minimum torque/force to initiate motion
}

/**
 * Reference Geometry Datum on a component
 */
export interface JointGeometryReference {
  componentId: string;
  geometryType: 'CYLINDRICAL_FACE' | 'PLANAR_FACE' | 'SPHERICAL_FACE' | 'DATUM_AXIS' | 'DATUM_POINT' | 'EDGE_CIRCLE' | 'CENTER_OF_MASS';
  geometryId: string;
  localOrigin: Vector3D;
  localAxis: Vector3D;
  localNormal?: Vector3D;
}

/**
 * The Complete Mechanical Joint Engineering Object
 */
export interface MechanicalJoint {
  id: string;
  jointId?: string;
  name: string;
  type: MechanicalJointType;
  jointType?: MechanicalJointType;
  description?: string;
  
  // Connected Components
  parentComponentId: string;
  childComponentId: string;
  componentA?: string;
  componentB?: string;
  
  // Reference Geometries
  parentReference: JointGeometryReference | any;
  childReference: JointGeometryReference | any;
  referenceA?: JointGeometryReference | any;
  referenceB?: JointGeometryReference | any;
  
  // Coordinate Frames
  parentFrame: CoordinateFrame3D;
  childFrame: CoordinateFrame3D;
  frameA?: CoordinateFrame3D;
  frameB?: CoordinateFrame3D;
  jointAxis: Vector3D;
  axis?: Vector3D;
  jointOrigin: Vector3D;
  origin?: Vector3D;
  
  // Degrees of Freedom
  dof: JointDOFDefinition;
  degreesOfFreedom?: JointDOFDefinition | number;
  
  // Limits & Mechanical Behavior
  primaryLimit?: JointLimit;
  secondaryLimit?: JointLimit; // For 2-DOF joints like Cylindrical or Universal
  tertiaryLimit?: JointLimit;  // For 3-DOF joints like Spherical
  limits?: JointLimit;
  
  mechanicalProperties: JointMechanicalProperties;
  motor?: JointMotor;
  motionParameter?: number;
  
  // Kinematic State
  currentPosition: number;      // primary coordinate (deg or mm)
  currentPositionSecondary?: number; // e.g. translation in Cylindrical (mm), pitch in Universal (deg)
  currentPositionTertiary?: number;  // e.g. yaw in Spherical (deg)
  currentVelocity: number;
  currentAcceleration: number;
  
  initialPosition: number;
  initialOrientation: Vector3D; // Euler angles in deg
  
  // Kinematic coupling parameters
  couplingParameters?: {
    screwPitchMm?: number;        // Lead/Pitch (mm per revolution)
    gearRatio?: number;           // z1 / z2 or N1 / N2
    pinionPitchRadiusMm?: number; // Pinion pitch radius r (mm)
    teethA?: number;
    teethB?: number;
    helixAngleDeg?: number;
    pressureAngleDeg?: number;
  };
  
  // Operational State
  state: JointStateStatus;
  solverState?: JointStateStatus;
  limitStatus: LimitViolationStatus;
  drivingState?: 'ACTIVE' | 'INACTIVE' | 'DRIVEN' | 'INVALID_MATE' | 'OUT_OF_LIMITS';
  isSuppressed: boolean;
  suppressionState?: boolean;
  revision: number;
  sourceRevision?: number;
  author: string;
  createdAt: string;
  evidenceHash: string;
  verificationState?: 'PROVEN' | 'FAIL' | 'UNPROVEN' | 'VERIFIED' | 'LIMIT_EXCEEDED';
  constraintDefinitions?: any[];
}

/**
 * Component Kinematic State in Assembly
 */
export interface ComponentKinematicState {
  componentId: string;
  name: string;
  isGrounded: boolean;
  massKg: number;
  worldTransform: TransformMatrix4x4;
  worldOrigin: Vector3D;
  linearVelocity: Vector3D;
  angularVelocity: Vector3D;
  translationalDOF: number;
  rotationalDOF: number;
  remainingDOF: number;
  status: JointStateStatus;
}

/**
 * Complete Mobility and DOF Breakdown for Assembly
 */
export interface AssemblyMobilityReport {
  totalComponents: number;
  groundedComponents: number;
  movingComponents: number;
  totalJoints: number;
  activeJoints: number;
  
  // Kutzbach-Grübler Mobility Analysis: M = 6*(N - 1 - J) + sum(f_i)
  spatialMobilityM: number;
  systemClassification: 'DETERMINATE_MECHANISM' | 'OVER_CONSTRAINED_STRUCTURE' | 'UNDER_CONSTRAINED_MECHANISM' | 'STATIC_STRUCTURE';
  
  componentDOFs: Record<string, {
    translational: number;
    rotational: number;
    total: number;
    locked: number;
  }>;
  
  redundantConstraintsCount: number;
  singularitiesDetected: boolean;
  singularJointIds: string[];
  diagnostics: string[];
}

/**
 * Dynamic Clearance and Interference Record during motion
 */
export interface DynamicClearanceRecord {
  stepIndex: number;
  timeSeconds: number;
  jointPositions: Record<string, number>;
  minimumClearanceMm: number;
  closestComponentA: string;
  closestComponentB: string;
  collisionDetected: boolean;
  collisionPairs: Array<{
    componentA: string;
    componentB: string;
    penetrationDepthMm: number;
  }>;
}

/**
 * Solver Diagnostic Report
 */
export interface JointSolverDiagnostic {
  jointId: string;
  jointType: MechanicalJointType;
  status: JointStateStatus;
  iterations: number;
  maxResidual: number;
  converged: boolean;
  failedConstraintId?: string;
  conflictingJointIds?: string[];
  failureReason?: string;
  remedialAction?: string;
}

/**
 * Kinematic Simulation Trajectory Result
 */
export interface JointSimulationResult {
  mechanismName: string;
  durationSeconds: number;
  timeStepSeconds: number;
  totalSteps: number;
  timeHistory: number[];
  
  jointTrajectories: Record<string, {
    position: number[];
    velocity: number[];
    acceleration: number[];
    torqueOrForce: number[];
  }>;
  
  componentTrajectories: Record<string, {
    originX: number[];
    originY: number[];
    originZ: number[];
  }>;
  
  clearanceHistory: DynamicClearanceRecord[];
  minOverallClearanceMm: number;
  collisionOccurred: boolean;
  evidenceHash: string;
  verdict: 'PROVEN' | 'FAIL' | 'LIMIT_EXCEEDED';
}
