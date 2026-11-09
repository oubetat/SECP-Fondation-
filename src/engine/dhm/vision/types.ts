/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 005
 * Human Vision & Line-of-Sight Analysis Types & Interface Contracts
 */

import { Vector3D } from '../../assembly/graph/types';
import { HumanPoseState } from '../kinematics/types';

export type HumanVisionStatus =
  | 'VISIBLE_BINOCULAR'
  | 'VISIBLE_LEFT_EYE_ONLY'
  | 'VISIBLE_RIGHT_EYE_ONLY'
  | 'PARTIALLY_OCCLUDED'
  | 'FULLY_OCCLUDED'
  | 'OUTSIDE_VISUAL_FIELD'
  | 'LINE_OF_SIGHT_FAILED'
  | 'INVALID_INPUT'
  | 'INDETERMINATE';

export interface HumanEyeConfiguration {
  interpupillaryDistanceMm: number; // Default: 64 mm for ANSUR II Male P50
  eyeHeightOffsetMm: number;        // Vertical offset above head joint origin (e.g. 110 mm)
  forwardEyeOffsetMm: number;       // Anterior offset from head joint origin to cornea (e.g. 90 mm)
  leftEyeOriginWCS: Vector3D;
  rightEyeOriginWCS: Vector3D;
  cyclopeanEyeOriginWCS: Vector3D;
}

export interface HumanGazeConfiguration {
  headRotationEulerDeg?: Vector3D; // Head/neck orientation Euler angles (x: flex/ext, y: lat bend, z: axial rot)
  eyeGazeYawDeg?: number;          // Eye rotation left (-)/right (+) relative to head forward vector (e.g. ±35°)
  eyeGazePitchDeg?: number;        // Eye rotation down (-)/up (+) relative to head forward vector (e.g. ±25°)
  primaryGazeVectorWCS?: Vector3D; // Calculated 3D unit vector
}

export interface HumanVisualFieldLimits {
  /** Monocular horizontal field of view relative to gaze vector [deg] */
  monocularHorizontalDeg: { nasal: number; temporal: number }; // e.g. 60° nasal, 95° temporal
  /** Monocular vertical field of view relative to gaze vector [deg] */
  monocularVerticalDeg: { superior: number; inferior: number }; // e.g. 60° superior, 75° inferior
  /** Binocular overlap total angle [deg] */
  binocularOverlapDeg: number; // e.g. 120°
  /** Foveal central vision cone half-angle [deg] */
  fovealConeHalfAngleDeg: number; // e.g. 2.5° (5° total cone)
}

export interface LineOfSightQueryInput {
  documentId: string;
  revision: string | number;
  dhmProfileId: string;
  poseState?: HumanPoseState;
  eyeConfig?: Partial<HumanEyeConfiguration>;
  gazeConfig?: HumanGazeConfiguration;
  targetPositionMm: Vector3D;
  targetRegion?: {
    bounds?: { min: Vector3D; max: Vector3D };
    samplePoints?: Vector3D[];
  };
  obstacleGeometry?: {
    documentId?: string;
    revisionId?: string;
    bounds?: { min: Vector3D; max: Vector3D };
    triangles?: Vector3D[][];
  };
  coordinateFrame?: 'WCS' | 'MCS';
}

export interface FirstHitObstacle {
  obstacleId: string;
  intersectionPointWCS: Vector3D;
  distanceMm: number;
}

export interface LineOfSightQueryResult {
  queryId: string;
  documentId: string;
  revision: string | number;
  dhmProfileId: string;
  status: HumanVisionStatus;
  isLeftEyeUnobstructed: boolean;
  isRightEyeUnobstructed: boolean;
  isInsideVisualField: boolean;
  isInsideFovealCone: boolean;
  leftEyeRayDistanceMm: number;
  rightEyeRayDistanceMm: number;
  firstHitObstacle?: FirstHitObstacle;
  occlusionPercentage: number; // 0.0 (fully visible) to 100.0 (fully occluded)
  limitations: string[];
  provenanceHash: string;
  createdAtIso: string;
}
