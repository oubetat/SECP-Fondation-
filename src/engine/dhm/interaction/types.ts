/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 007
 * Human-Environment Interaction & Task Assessment Types
 */

import { Vector3D } from '../../assembly/graph/types';
import { HumanEffectorRegion } from '../kinematics/types';
import { PoseState } from '../kinematics/types';
import { LineOfSightQueryResult } from '../vision/types';
import { ReachabilityEvaluationResult } from '../reachability/types';
import { ErgonomicsEvaluationResult } from '../ergonomics/types';

/**
 * Defines a specific object in the engineering environment that a human interacts with
 */
export interface InteractionObject {
  objectId: string;
  name: string;
  type: 'CONTROL' | 'DISPLAY' | 'TOOL' | 'SURFACE' | 'ENVIRONMENT';
  documentId: string;
  geometryTriangles?: Vector3D[][];
  interactionPoints: Record<string, {
    positionWCS: Vector3D;
    orientationWCS?: Vector3D; // Euler angles
    label: string;
  }>;
}

/**
 * Defines a task state - a single snapshot of interaction
 */
export interface TaskStateDefinition {
  stateId: string;
  description: string;
  
  // Interaction Targets
  targetObjectId?: string;
  targetPointKey?: string; // Key in InteractionObject.interactionPoints
  targetPositionWCS?: Vector3D; // Fallback if no object/point
  
  // Required Effector
  effectorRegion: HumanEffectorRegion;
  
  // Task Constraints
  requiresVisibility: boolean;
  requiresReachability: boolean;
  requiredGazePoint?: Vector3D;
  
  // External Load (for NIOSH/REBA)
  externalLoadKg?: number;
  isLoadSymmetric?: boolean;
}

/**
 * Defines a complete task sequence
 */
export interface HumanTaskDefinition {
  taskId: string;
  name: string;
  dhmProfileId: string;
  states: TaskStateDefinition[];
}

export enum InteractionStatus {
  FEASIBLE = 'FEASIBLE',
  INFEASIBLE_REACH = 'INFEASIBLE_REACH',
  INFEASIBLE_VISIBILITY = 'INFEASIBLE_VISIBILITY',
  INFEASIBLE_COLLISION = 'INFEASIBLE_COLLISION',
  ERGONOMIC_LIMIT_EXCEEDED = 'ERGONOMIC_LIMIT_EXCEEDED',
  IK_UNSOLVED = 'IK_UNSOLVED',
  INVALID_INPUT = 'INVALID_INPUT',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
  SUBSYSTEM_FAILURE = 'SUBSYSTEM_FAILURE',
  NOT_EVALUATED = 'NOT_EVALUATED'
}

/**
 * Analysis result for a single task state
 */
export interface TaskStateAnalysis {
  stateId: string;
  status: InteractionStatus;
  isFeasible: boolean;
  feasibilityIssues: string[];
  
  // Component Results
  reachability?: ReachabilityEvaluationResult;
  visibility?: LineOfSightQueryResult;
  ergonomics?: ErgonomicEvidence;
  
  // Timing / Sequence
  estimatedDurationSeconds?: number;
}

/**
 * Comprehensive analysis for a complete task
 */
export interface HumanTaskAnalysis {
  analysisId: string;
  taskId: string;
  documentId: string;
  revision: number;
  
  // Aggregated Results
  states: TaskStateAnalysis[];
  
  // Overall Metrics
  overallFeasibility: boolean;
  maxErgonomicRiskScore: number;
  criticalIssues: string[];
  
  // Evidence
  limitations: string[];
  provenanceHash: string;
  createdAtIso: string;
}
