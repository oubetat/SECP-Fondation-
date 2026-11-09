/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 004
 * Human Reachability Engine Types & Interface Contracts
 */

import { Vector3D } from '../../assembly/graph/types';
import { AnatomicalRegion } from '../types/SkeletalTopologyTypes';
import { HumanIKOptions, HumanIKResult } from '../kinematics/types';

export type HumanReachabilityStatus =
  | 'REACHABLE_COLLISION_FREE'
  | 'REACHABLE_WITH_COLLISION'
  | 'KINEMATICALLY_UNREACHABLE'
  | 'ANATOMICALLY_INADMISSIBLE'
  | 'COLLISION_EVALUATION_FAILED'
  | 'SOLVER_FAILED'
  | 'INVALID_INPUT'
  | 'INDETERMINATE';

export interface ReachabilityEvaluationInput {
  documentId: string;
  revision: string | number;
  dhmProfileId: string;
  effectorRegion: AnatomicalRegion; // e.g. LEFT_HAND, RIGHT_HAND, LEFT_FOOT, RIGHT_FOOT, HEAD
  targetPositionMm: Vector3D;
  targetOrientationEulerDeg?: Vector3D;
  coordinateFrame?: 'WCS' | 'MCS' | 'LOCAL';
  obstacleGeometry?: {
    documentId?: string;
    revisionId?: string;
    bounds?: { min: Vector3D; max: Vector3D };
    triangles?: Vector3D[][];
  };
  solverOptions?: HumanIKOptions;
}

export interface ReachabilityEvaluationResult {
  evaluationId: string;
  effector: AnatomicalRegion;
  targetPositionMm: Vector3D;
  coordinateFrame: string;
  dhmProfileId: string;
  documentId: string;
  revision: string | number;
  status: HumanReachabilityStatus;
  isKinematicallyReachable: boolean;
  isAnatomicallyAdmissible: boolean;
  isCollisionFree: boolean;
  positionResidualMm: number;
  ikResult: HumanIKResult;
  jointLimitViolations: string[];
  collisionResult?: {
    status: string;
    minClearanceMm: number;
    hasPenetration: boolean;
    reason?: string;
  };
  limitations: string[];
  provenanceHash: string;
  createdAtIso: string;
}

export interface ReachEnvelopeSamplingConfig {
  resolutionMm: number; // Step size for spatial sampling (e.g. 100mm)
  samplingBounds?: { min: Vector3D; max: Vector3D };
  samplingPattern?: 'SPHERICAL_GRID' | 'CARTESIAN_BOX';
  maxSamples?: number;
}

export interface SampledReachPoint {
  positionMm: Vector3D;
  status: HumanReachabilityStatus;
  isKinematicallyReachable: boolean;
  isCollisionFree: boolean;
  residualMm: number;
}

export interface ReachEnvelopeResult {
  envelopeId: string;
  effector: AnatomicalRegion;
  dhmProfileId: string;
  samplingConfig: ReachEnvelopeSamplingConfig;
  totalSamplesEvaluated: number;
  reachablePointCount: number;
  collisionFreePointCount: number;
  coverageRatio: number; // reachablePoints / totalSamples
  sampledReachPoints: SampledReachPoint[];
  envelopeBounds: { min: Vector3D; max: Vector3D };
  limitations: string[];
  provenanceHash: string;
  createdAtIso: string;
}
