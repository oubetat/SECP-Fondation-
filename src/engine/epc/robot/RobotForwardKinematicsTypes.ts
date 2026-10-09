/**
 * SECP Industrial OS — EPC-044: Forward Kinematics Types
 * Domain model and validation interfaces for Forward Kinematics calculation,
 * sequential transformation chain composition, end-effector pose computation,
 * independent mathematical reference verification, numerical tolerances,
 * continuity & determinism tests, configuration traceability, and cryptographic evidence.
 */

import { Vector3D } from '../../cadKernel';
import { Matrix4x4 } from '../../assembly/graph/types';
import { KinematicJointDefinition } from './RobotKinematicTypes';

export type ForwardKinematicsCalculationStatus =
  | 'VALID'
  | 'INVALID_LIMITS'
  | 'SINGULARITY'
  | 'DISCONNECTED_CHAIN'
  | 'COMPUTATION_ERROR';

export interface JointStateInput {
  jointId: string;
  position: number;     // angle in degrees (REVOLUTE) or displacement in mm (PRISMATIC)
  unit?: string;        // 'deg' | 'rad' | 'mm' | 'm'
}

export interface ForwardKinematicsInput {
  robotId: string;
  configurationId: string;
  kinematicChainId: string;
  baseFrame: string;
  jointDefinitions: KinematicJointDefinition[];
  jointStates: Record<string, number> | JointStateInput[];
  linkTransforms?: Record<string, Matrix4x4>;
  endEffectorFrame: string;
  unitSystem: 'SI_MM_DEG' | 'SI_M_RAD';
  revision: string;
}

export interface TransformationStep {
  step: number;
  jointId: string;
  jointType: string;
  parentFrame: string;
  childFrame: string;
  jointValue: number;
  unit: string;
  localTransform: Matrix4x4;
  accumulatedTransform: Matrix4x4;
}

export interface EndEffectorOrientation {
  rotationMatrix: number[][]; // 3x3
  quaternion: { w: number; x: number; y: number; z: number };
  eulerXYZDeg: Vector3D;
  eulerZYXDeg: Vector3D;
}

export interface JointConfigDetail {
  jointId: string;
  jointType: string;
  position: number;
  unit: string;
  isWithinLimits: boolean;
  minLimit: number;
  maxLimit: number;
}

export interface ForwardKinematicsResult {
  robotId: string;
  configurationId: string;
  kinematicChainId: string;
  robotRevision: string;
  baseFrame: string;
  endEffectorFrame: string;
  calculationStatus: ForwardKinematicsCalculationStatus;
  endEffectorPosition: Vector3D;
  endEffectorOrientation: EndEffectorOrientation;
  homogeneousTransform: Matrix4x4;
  jointConfiguration: Record<string, JointConfigDetail>;
  transformationSequence: TransformationStep[];
  positionTolerance: number;    // e.g. 1e-5 mm
  orientationTolerance: number; // e.g. 1e-5 deg/rad
}

export interface IndependentReferenceResult {
  position: Vector3D;
  rotationMatrix: number[][];
  method: string; // e.g. 'Independent Product of Exponentials / Denavit-Hartenberg Direct Kinematics'
}

export interface ForwardKinematicsComparison {
  referenceResult: IndependentReferenceResult;
  positionError: number;        // Euclidean norm ||P_secp - P_ref||
  orientationError: number;     // Frobenius norm or max element difference
  passed: boolean;
  positionTolerance: number;
  orientationTolerance: number;
}

export interface ForwardKinematicsTraceability {
  robotId: string;
  robotRevision: string;
  kinematicChainId: string;
  linkDefinitionsCount: number;
  jointDefinitionsCount: number;
  jointConfiguration: Record<string, number>;
  coordinateFrames: string[];
  mathematicalMethod: string;
  evidenceHash: string;
}

export interface EPC044EvidencePackage {
  epcId: 'EPC-044';
  robotId: string;
  revision: string;
  kinematicChainId: string;
  jointConfiguration: Record<string, number>;
  inputFrames: {
    baseFrame: string;
    endEffectorFrame: string;
  };
  jointDefinitions: {
    jointId: string;
    type: string;
    axis: Vector3D;
    origin: Vector3D;
    limits: { min: number; max: number };
  }[];
  transformationSequence: {
    step: number;
    jointId: string;
    localTransformTranslation: Vector3D;
    accumulatedTranslation: Vector3D;
  }[];
  finalTransformation: Matrix4x4;
  endEffectorPose: {
    position: Vector3D;
    orientationEulerDeg: Vector3D;
    quaternion: { w: number; x: number; y: number; z: number };
  };
  numericalTolerances: {
    positionTolerance: number;
    orientationTolerance: number;
  };
  referenceResult: {
    position: Vector3D;
    method: string;
  };
  comparisonError: {
    positionError: number;
    orientationError: number;
    passed: boolean;
  };
  continuityTest: {
    perturbedJointId: string;
    deltaQ: number;
    initialPosition: Vector3D;
    perturbedPosition: Vector3D;
    positionDelta: number;
    isContinuous: boolean;
  };
  determinismTest: {
    executions: number;
    maxPositionDeviation: number;
    maxOrientationDeviation: number;
    isDeterministic: boolean;
  };
  testResults: Record<string, boolean>;
  traceability: ForwardKinematicsTraceability;
  timestamp: string;
  provenance: {
    who: string;
    what: string;
    when: string;
    engine: string;
    version: string;
  };
  evidenceHash: string;
  verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
}

export interface EPC044GateReport {
  readonly epc: 'EPC-044';
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
