/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 002
 * Skeletal Topology & Anatomical Frame Definitions
 */

import { Matrix4x4, Vector3D } from '../../assembly/graph/types';

export enum AnatomicalRegion {
  PELVIS = 'PELVIS',
  LUMBAR_SPINE = 'LUMBAR_SPINE',
  THORACIC_SPINE = 'THORACIC_SPINE',
  NECK = 'NECK',
  HEAD = 'HEAD',
  LEFT_CLAVICLE = 'LEFT_CLAVICLE',
  RIGHT_CLAVICLE = 'RIGHT_CLAVICLE',
  LEFT_UPPER_ARM = 'LEFT_UPPER_ARM',
  RIGHT_UPPER_ARM = 'RIGHT_UPPER_ARM',
  LEFT_FOREARM = 'LEFT_FOREARM',
  RIGHT_FOREARM = 'RIGHT_FOREARM',
  LEFT_HAND = 'LEFT_HAND',
  RIGHT_HAND = 'RIGHT_HAND',
  LEFT_THIGH = 'LEFT_THIGH',
  RIGHT_THIGH = 'RIGHT_THIGH',
  LEFT_LOWER_LEG = 'LEFT_LOWER_LEG',
  RIGHT_LOWER_LEG = 'RIGHT_LOWER_LEG',
  LEFT_FOOT = 'LEFT_FOOT',
  RIGHT_FOOT = 'RIGHT_FOOT'
}

export interface SkeletalSegment {
  segmentId: AnatomicalRegion;
  name: string;
  parentSegmentId: AnatomicalRegion | null;
  childSegmentIds: AnatomicalRegion[];
  anatomicalRegion: AnatomicalRegion;
  
  /** Vector offset from parent joint origin to segment child joint origin [mm] */
  localOffsetMm: Vector3D;
  
  /** Segment length along principal anatomical axis [mm] */
  lengthMm: number;
  
  /** Calculated segment mass [kg] */
  massKg: number;
  
  /** Segment center of mass relative to proximal joint origin [mm] */
  centerOfMassMm: Vector3D;
  
  /** Local 4x4 Transformation Matrix relative to parent frame */
  localTransform: Matrix4x4;
  
  /** Global 4x4 Transformation Matrix relative to Root (Pelvis) frame */
  globalTransform: Matrix4x4;
}

export interface SkeletalTopology {
  skeletonId: string;
  name: string;
  rootSegmentId: AnatomicalRegion;
  segments: Map<AnatomicalRegion, SkeletalSegment> | Record<AnatomicalRegion, SkeletalSegment>;
  isValid: boolean;
  validationErrors: string[];
  serializationHash: string;
}

export interface SkeletalValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
