/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 003
 * Human Kinematics Engine Types & Interface Contracts
 */

import { Matrix4x4, Vector3D } from '../../assembly/graph/types';
import { AnatomicalRegion } from '../types/SkeletalTopologyTypes';

export interface HumanJointAngles {
  flexionExtension: number;
  abductionAdduction?: number;
  internalExternalRotation?: number;
  lateralBending?: number;
  axialRotation?: number;
}

export interface HumanPoseState {
  pelvisPositionMm: Vector3D;
  pelvisRotationEulerDeg: Vector3D;
  jointAngles: Record<string, HumanJointAngles>;
}

export interface SegmentKinematicState {
  segmentId: AnatomicalRegion;
  localTransform: Matrix4x4;
  globalTransform: Matrix4x4;
  jointOriginMm: Vector3D;
  endOriginMm: Vector3D;
}

export interface HumanFKResult {
  success: boolean;
  segmentStates: Record<AnatomicalRegion, SegmentKinematicState>;
  endEffectors: Record<string, { positionMm: Vector3D; globalTransform: Matrix4x4 }>;
  diagnostics: string[];
}

export interface IKEffectorTarget {
  effectorRegion: AnatomicalRegion; // e.g. LEFT_HAND, RIGHT_HAND, LEFT_FOOT, RIGHT_FOOT, HEAD
  targetPositionMm: Vector3D;
  targetOrientationEulerDeg?: Vector3D;
  weight?: number; // Relative priority weighting (default: 1.0)
  positionToleranceMm?: number; // Target precision tolerance (default: 1.0 mm)
  orientationToleranceDeg?: number; // Target orientation tolerance (default: 2.0 deg)
}

export interface HumanIKOptions {
  maxIterations?: number; // Default: 120
  dampingFactor?: number; // Damped Least Squares damping factor lambda^2 (default: 0.05)
  stepSize?: number; // Line-search step factor (default: 0.4)
  enforceJointLimits?: boolean; // Hard clamping to ROM limits (default: true)
  postureRegularizationWeight?: number; // Weight to prefer neutral joint angles (default: 0.01)
  positionToleranceMm?: number; // Global convergence tolerance (default: 1.0 mm)
}

export interface JointLimitSaturation {
  jointId: string;
  flexExtSaturated: boolean;
  abdAddSaturated?: boolean;
  intExtSaturated?: boolean;
}

export type IKConvergenceStatus =
  | 'CONVERGED'
  | 'PARTIAL_CONVERGENCE'
  | 'TARGET_UNREACHABLE'
  | 'SINGULAR_CONFIGURATION'
  | 'FAILED';

export interface HumanIKResult {
  success: boolean;
  convergenceStatus: IKConvergenceStatus;
  solvedPose: HumanPoseState;
  fkResult: HumanFKResult;
  iterations: number;
  positionResidualsMm: Record<string, number>;
  orientationResidualsDeg?: Record<string, number>;
  jointLimitSaturations: Record<string, JointLimitSaturation>;
  diagnostics: string[];
}

export interface JointConstraintValidationResult {
  isValid: boolean;
  clampedAngles: HumanJointAngles;
  isSaturated: boolean;
  violations: string[];
}
