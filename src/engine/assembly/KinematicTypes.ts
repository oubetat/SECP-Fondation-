/**
 * PATCH-SECP-045 — Advanced Assembly & Kinematics Engine Types
 * Strongly typed domain model for Multi-Body Kinematic Assemblies:
 *  - KinematicJoint (Fixed, Revolute, Prismatic, Cylindrical, Spherical, Planar, Universal, Gear, Rack&Pinion)
 *  - KinematicLimit (Minimum, Maximum, SoftLimit, HardLimit)
 *  - KinematicState (4x4 TransformMatrix, Joint Coordinates, Validity)
 *  - KinematicSolveResult (Residuals, DOF, Collisions, Deterministic Hash)
 *  - DOFReport (Geometric vs Count DOF, Redundancies, Singularities)
 *  - KinematicRevisionRecord (Provenance & Revision Hash Tracking)
 */

import { Vector3D } from '../cadKernel';
import { AssemblyConstraintType, GeometryReference } from './AssemblyConstraintTypes';

export type KinematicJointType = 
  | 'FIXED'
  | 'REVOLUTE'
  | 'PRISMATIC'
  | 'CYLINDRICAL'
  | 'SPHERICAL'
  | 'PLANAR'
  | 'UNIVERSAL'
  | 'GEAR'
  | 'RACK_AND_PINION';

export type JointCapabilityStatus = 'OPERATIONAL' | 'EXPERIMENTAL' | 'UNSUPPORTED';

export type LimitViolationType = 'SOFT_LIMIT' | 'HARD_LIMIT';

export interface KinematicLimit {
  minimum: number;
  maximum: number;
  unit: string;
  softLimit: boolean;
  hardLimit: boolean;
}

export interface KinematicJoint {
  id: string;
  name: string;
  type: KinematicJointType;
  parentComponentId: string;
  childComponentId: string;
  anchorReference?: GeometryReference;
  axis: Vector3D;
  origin: Vector3D;
  limits?: KinematicLimit;
  currentPosition: number;        // Angle (deg) for revolute, translation (mm) for prismatic
  currentVelocity: number;        // deg/s or mm/s
  currentAcceleration: number;    // deg/s2 or mm/s2
  enabled: boolean;
  revisionNumber: number;
  capabilityStatus: JointCapabilityStatus;
  secondaryPosition?: number;     // e.g. Translation for Cylindrical, Pitch/Yaw for Universal/Spherical
}

export interface GearJoint {
  id: string;
  name: string;
  drivingJointId: string;
  drivenJointId: string;
  ratio: number;                  // ratio = driven / driving. Must be != 0
  direction: 1 | -1;              // 1 = same direction, -1 = reverse (external mesh)
  phaseOffset: number;            // deg
}

export interface RackAndPinionJoint {
  id: string;
  name: string;
  pinionJointId: string;          // Revolute joint
  rackJointId: string;            // Prismatic joint
  pitchRadiusMm: number;          // Pitch circle radius of pinion
}

export interface KinematicState {
  componentId: string;
  transformMatrix: number[];      // 16 floats (row-major 4x4)
  position: Vector3D;
  orientation: Vector3D;          // Euler angles in degrees
  jointCoordinates: Record<string, number>;
  timestamp: number;              // Deterministic simulation time step in seconds
  validity: boolean;
}

export type SolverOutcome = 
  | 'SOLVED' 
  | 'UNDER_CONSTRAINED' 
  | 'OVER_CONSTRAINED' 
  | 'SINGULAR' 
  | 'NON_CONVERGENT' 
  | 'INVALID'
  | 'LIMIT_VIOLATED';

export interface ClashClassification {
  componentA: string;
  componentB: string;
  volumeMm3: number;
  type: 'CLEARANCE' | 'CONTACT' | 'INTERFERENCE' | 'INVALID_GEOMETRY';
  centroid?: Vector3D;
}

export interface LimitViolation {
  jointId: string;
  jointName: string;
  limitType: LimitViolationType;
  value: number;
  bound: number;
  isUpper: boolean;
}

export interface KinematicSolveResult {
  status: SolverOutcome;
  solved: boolean;
  degreesOfFreedom: number;
  constrainedDOF: number;
  freeDOF: number;
  componentTransforms: Record<string, number[]>;
  residualError: number;
  violatedConstraints: string[];
  violatedLimits: LimitViolation[];
  collisions: ClashClassification[];
  solverIterations: number;
  deterministicHash: string;
  diagnostics: string[];
}

export interface NormalizedConstraint {
  constraintId: string;
  sourceComponentId: string;
  targetComponentId: string;
  type: AssemblyConstraintType;
  geometricReferences: GeometryReference[];
  mathematicalRelation: string;
  dofContribution: number;
  tolerance: number;
  status: 'READY' | 'UNSUPPORTED' | 'INVALID';
  offsetValue?: number;
}

export interface DOFReport {
  totalDOF: number;
  constrainedDOF: number;
  freeDOF: number;
  status: 'FULLY_CONSTRAINED' | 'UNDER_CONSTRAINED' | 'OVER_CONSTRAINED' | 'INVALID';
  redundantConstraints: string[];
  unresolvedConstraints: string[];
  independentCoordinates: string[];
  geometricDofCount: number;
  estimatedDofCount: number;
  componentDofs: Record<string, {
    instanceId: string;
    isFixed: boolean;
    freeTx: boolean;
    freeTy: boolean;
    freeTz: boolean;
    freeRx: boolean;
    freeRy: boolean;
    freeRz: boolean;
    remainingDof: number;
  }>;
}

export interface KinematicRevisionRecord {
  assemblyId: string;
  assemblyRevision: number;
  solverVersion: string;
  kernelVersion: string;
  inputStateHash: string;
  constraintHash: string;
  outputStateHash: string;
  timestamp: string;
  status: string;
  validationSummary: string;
}

export interface SimulationFrame {
  step: number;
  timeS: number;
  jointValues: Record<string, number>;
  componentTransforms: Record<string, number[]>;
  residualError: number;
  hasCollision: boolean;
  clashes: ClashClassification[];
  limitViolations: LimitViolation[];
}

export interface SimulationResult {
  durationS: number;
  timestepS: number;
  frameCount: number;
  frames: SimulationFrame[];
  maxResidualError: number;
  totalClashesDetected: number;
  deterministicHash: string;
  success: boolean;
}
