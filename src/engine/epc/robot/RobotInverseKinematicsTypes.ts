/**
 * SECP Industrial OS — EPC-045: Inverse Kinematics Types
 * Formal interfaces for Target Pose specification, Joint Limits, Solver Configuration,
 * Damped Least Squares numerical optimization, Convergence Criteria, Singularity Analysis,
 * Multi-Solution sets, Forward Kinematics Closure verification, Evidence Package, and Gate Reports.
 */

import { Vector3D } from '../../cadKernel';
import { Matrix4x4 } from '../../assembly/graph/types';
import { ForwardKinematicsResult, JointConfigDetail } from './RobotForwardKinematicsTypes';
import { KinematicJointDefinition } from './RobotKinematicTypes';

export type InverseKinematicsConvergenceStatus =
  | 'CONVERGED'
  | 'NOT_CONVERGED'
  | 'UNREACHABLE'
  | 'INVALID_LIMITS'
  | 'SINGULARITY'
  | 'INVALID_INPUT';

export type SolutionSelectionCriterion =
  | 'MINIMUM_DISPLACEMENT'
  | 'CENTERED_LIMITS'
  | 'MAXIMUM_MANIPULABILITY'
  | 'MINIMUM_ENERGY';

export interface InverseKinematicsTargetPose {
  /** Target 3D position vector [x, y, z] in mm */
  position: Vector3D;
  /** Optional 3x3 rotation matrix in base frame */
  rotationMatrix?: number[][];
  /** Optional unit quaternion [w, x, y, z] */
  quaternion?: { w: number; x: number; y: number; z: number };
  /** Optional Euler XYZ angles in degrees */
  eulerXYZDeg?: Vector3D;
  /** Optional Euler ZYX angles in degrees */
  eulerZYXDeg?: Vector3D;
  /** Optional full 4x4 homogeneous transformation matrix */
  transformMatrix?: Matrix4x4;
  /** If true, solve only for end-effector position (3 DOFs), ignoring orientation constraints */
  positionOnly?: boolean;
}

export interface InverseKinematicsSolverConfig {
  /** Maximum number of numerical iterations (default: 150) */
  maxIterations: number;
  /** Initial Levenberg-Marquardt / Damped Least Squares damping factor (default: 1e-2) */
  initialDamping: number;
  /** Minimum damping parameter to maintain stability near singularities (default: 1e-6) */
  minimumDamping: number;
  /** Maximum damping parameter before giving up on local descent (default: 1e4) */
  maximumDamping: number;
  /** Weight on position error in cost function (default: 1.0) */
  positionWeight: number;
  /** Weight on orientation error in cost function (default: 1.0) */
  orientationWeight: number;
  /** Step size factor for line search / descent step (default: 1.0) */
  stepSize: number;
  /** Singularity detection threshold on manipulability index (default: 1e-4) */
  singularityThreshold: number;
  /** Condition number threshold for ill-conditioned Jacobian (default: 1e4) */
  conditionNumberThreshold: number;
  /** Enable strict joint limit projection during solver iterations (default: true) */
  enforceJointLimits: number | boolean;
  /** Solution selection criterion when multiple valid candidates are found */
  solutionCriterion: SolutionSelectionCriterion;
}

export interface InverseKinematicsInput {
  robotId: string;
  configurationId: string;
  kinematicChainId: string;
  baseFrame: string;
  endEffectorFrame: string;
  targetPose: InverseKinematicsTargetPose;
  initialJointConfiguration?: Record<string, number>;
  jointLimits?: Record<string, { min: number; max: number }>;
  solverConfiguration?: Partial<InverseKinematicsSolverConfig>;
  positionTolerance?: number;    // in mm (default: 1e-3)
  orientationTolerance?: number; // in deg (default: 1e-3)
  revision: string;
  jointDefinitions?: KinematicJointDefinition[];
}

export interface InverseKinematicsIterationRecord {
  iteration: number;
  jointConfiguration: Record<string, number>;
  positionError: number;        // Euclidean norm in mm
  orientationError: number;     // Angular distance in deg
  totalError: number;           // Weighted composite error
  stepSize: number;
  dampingFactor: number;
  constraintStatus: 'SATISFIED' | 'LIMIT_BOUNDED' | 'VIOLATED';
}

export interface SingularityDiagnostic {
  isNearSingular: boolean;
  manipulabilityIndex: number; // Yoshikawa metric sqrt(det(J * J^T))
  conditionNumber: number;     // kappa(J)
  rank: number;
  statusMessage: string;
}

export interface CandidateJointSolution {
  solutionId: string;
  jointConfiguration: Record<string, number>;
  forwardKinematicsResult: ForwardKinematicsResult;
  positionError: number;
  orientationError: number;
  totalError: number;
  displacementFromInitial: number;
  manipulabilityIndex: number;
  isWithinLimits: boolean;
  iterations: number;
}

export interface ForwardKinematicsClosureVerification {
  evaluatedPose: ForwardKinematicsResult;
  targetPosition: Vector3D;
  actualPosition: Vector3D;
  positionError: number;
  orientationError: number;
  positionTolerance: number;
  orientationTolerance: number;
  positionPassed: boolean;
  orientationPassed: boolean;
  passed: boolean;
}

export interface InverseKinematicsResult {
  robotId: string;
  configurationId: string;
  kinematicChainId: string;
  robotRevision: string;
  baseFrame: string;
  endEffectorFrame: string;
  targetPose: InverseKinematicsTargetPose;
  initialJointConfiguration: Record<string, number>;
  finalJointConfiguration: Record<string, number>;
  finalPose: ForwardKinematicsResult;
  positionError: number;        // mm
  orientationError: number;     // deg
  totalError: number;
  convergenceStatus: InverseKinematicsConvergenceStatus;
  constraintStatus: 'SATISFIED' | 'LIMIT_BOUNDED' | 'VIOLATED';
  singularityStatus: SingularityDiagnostic;
  iterations: number;
  executionTimeMs: number;
  solverMethod: string;
  solverConfiguration: InverseKinematicsSolverConfig;
  positionTolerance: number;
  orientationTolerance: number;
  alternativeSolutions: CandidateJointSolution[];
  selectedSolutionCriterion: SolutionSelectionCriterion;
  forwardKinematicsVerification: ForwardKinematicsClosureVerification;
  iterationHistory: InverseKinematicsIterationRecord[];
}

export interface EPC045EvidencePackage {
  epcId: 'EPC-045';
  robotId: string;
  robotRevision: string;
  kinematicChainId: string;
  targetPose: {
    position: Vector3D;
    orientationEulerDeg?: Vector3D;
    quaternion?: { w: number; x: number; y: number; z: number };
    positionOnly: boolean;
  };
  initialJointConfiguration: Record<string, number>;
  finalJointConfiguration: Record<string, number>;
  jointLimits: Record<string, { min: number; max: number }>;
  solverMethod: string;
  solverConfiguration: InverseKinematicsSolverConfig;
  positionTolerance: number;
  orientationTolerance: number;
  iterations: number;
  finalPose: {
    position: Vector3D;
    orientationEulerDeg: Vector3D;
    quaternion: { w: number; x: number; y: number; z: number };
  };
  positionError: number;
  orientationError: number;
  totalError: number;
  convergenceStatus: InverseKinematicsConvergenceStatus;
  constraintStatus: 'SATISFIED' | 'LIMIT_BOUNDED' | 'VIOLATED';
  singularityStatus: SingularityDiagnostic;
  alternativeSolutionsCount: number;
  selectedSolutionCriterion: SolutionSelectionCriterion;
  forwardKinematicsVerification: {
    passed: boolean;
    positionError: number;
    orientationError: number;
  };
  testResults: Record<string, boolean>;
  timestamp: string;
  provenance: {
    provenanceId: string;
    actor: string;
    action: string;
    timestamp: string;
    source: string;
    sourceVersion: string;
    inputs: Record<string, unknown>;
    process: string;
    outputs: Record<string, unknown>;
  };
  traceability: {
    robotId: string;
    robotRevision: string;
    kinematicChainId: string;
    baseFrame: string;
    endEffectorFrame: string;
    mathematicalMethod: string;
    fkEngineVersion: string;
    evidenceHash: string;
  };
  evidenceHash: string;
  verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
}

export interface EPC045GateReport {
  readonly epc: 'EPC-045';
  readonly name: string;
  readonly verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  readonly checks: Record<string, { passed: boolean; message: string }>;
  readonly summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
  };
  readonly evidenceHash: string;
  readonly timestamp: string;
}
