/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 006
 * Shared Types for Ergonomic Assessment Engines (RULA, REBA, OWAS, NIOSH)
 */

import { Vector3D } from '../../assembly/graph/types';
import { HumanPoseState } from '../kinematics/types';

export enum ErgonomicMethodology {
  RULA = 'RULA',
  REBA = 'REBA',
  OWAS = 'OWAS',
  NIOSH = 'NIOSH'
}

export interface ErgonomicEvidence {
  methodology: ErgonomicMethodology;
  version: string;
  documentId: string;
  revision: string | number;
  dhmProfileId: string;
  timestampIso: string;
  provenanceHash: string;
  scores: Record<string, number>;
  actionLevel: number;
  interpretation: string;
  limitations: string[];
  references?: {
    source: string;
    tables: string[];
    pages?: string[];
  };
}

/**
 * RULA Specific Types
 */
export interface RULAInput {
  pose: HumanPoseState;
  muscleUse: boolean; // Repeated action > 4x/min or static > 1min
  loadKg: number;
  armSupported: boolean;
  shoulderAbducted: boolean;
  shoulderRaised: boolean;
  neckTwisted: boolean;
  neckSideBending: boolean;
  trunkTwisted: boolean;
  trunkSideBending: boolean;
  wristTwist: number; // 1: mainly mid-range, 2: at or near end of range
  legsSupported: boolean; // 1: well supported, 2: not
}

/**
 * REBA Specific Types
 */
export interface REBAInput {
  pose: HumanPoseState;
  loadKg: number;
  coupling: number; // 0: Good, 1: Fair, 2: Poor, 3: Unacceptable
  legSupport: 1 | 2; // 1: bilateral weight bearing, 2: unilateral
  kneeFlexionDeg: number; // For leg adjustments
  activity: {
    staticPosture: boolean; // Held > 1min
    repeatedAction: boolean; // > 4x/min
    rapidChange: boolean; // Unstable base
  };
}

/**
 * OWAS Specific Types
 */
export enum OWASLegPosture {
  SITTING = 1,
  STANDING_BOTH_STRAIGHT = 2,
  STANDING_ONE_STRAIGHT = 3,
  STANDING_BOTH_BENT = 4,
  STANDING_ONE_BENT = 5,
  KNEELING = 6,
  WALKING = 7
}

export interface OWASInput {
  pose: HumanPoseState;
  loadKg: number;
  legPosture: OWASLegPosture;
}

/**
 * NIOSH Specific Types
 */
export enum NIOSHStatus {
  VALID_RESULT = 'VALID_RESULT',
  INVALID_INPUT = 'INVALID_INPUT',
  OUT_OF_DOMAIN = 'OUT_OF_DOMAIN',
  UNSUPPORTED_SCENARIO = 'UNSUPPORTED_SCENARIO',
  RWL_ZERO = 'RWL_ZERO'
}

export interface NIOSHInput {
  originMm: Vector3D;
  destinationMm: Vector3D;
  loadKg: number;
  frequency: number; // Lifts/min
  durationHours: number;
  coupling: 'Good' | 'Fair' | 'Poor';
  asymmetryAngleDeg: number;
  isSignificantControlRequired: boolean;
}

export interface NIOSHResult {
  status: NIOSHStatus;
  rwl: number; // Recommended Weight Limit
  li: number;  // Lifting Index
  multipliers: {
    hm: number;
    vm: number;
    dm: number;
    am: number;
    fm: number;
    cm: number;
  };
}
