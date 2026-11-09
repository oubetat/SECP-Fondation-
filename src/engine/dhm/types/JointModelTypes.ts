/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 002
 * Anatomical Joint Model & Range of Motion (ROM) Types
 */

import { AnatomicalRegion } from './SkeletalTopologyTypes';

export enum AnatomicalJointType {
  REVOLUTE_1DOF = 'REVOLUTE_1DOF',   // e.g. Interphalangeal joints
  HINGE_1DOF = 'HINGE_1DOF',          // e.g. Humeroulnar Elbow Joint
  PIVOT_1DOF = 'PIVOT_1DOF',          // e.g. Radioulnar Pronation/Supination
  UNIVERSAL_2DOF = 'UNIVERSAL_2DOF',  // e.g. Wrist Joint (Radiocarpal)
  SPHERICAL_3DOF = 'SPHERICAL_3DOF',  // e.g. Shoulder (Glenohumeral) & Hip (Acetabulofemoral)
  COMPOUND_SPINE = 'COMPOUND_SPINE'   // Multi-segment spinal articulation
}

export interface AngleIntervalDeg {
  minDeg: number;
  maxDeg: number;
  neutralDeg: number;
}

export interface JointRangeOfMotion {
  /** Flexion (+) / Extension (-) angle limits in degrees */
  flexionExtension?: AngleIntervalDeg;
  
  /** Abduction (+) / Adduction (-) angle limits in degrees */
  abductionAdduction?: AngleIntervalDeg;
  
  /** Internal (+ Pronation/Medial) / External (- Supination/Lateral) rotation angle limits in degrees */
  internalExternalRotation?: AngleIntervalDeg;
  
  /** Lateral Bending (+ Right / - Left) for spine/neck joints */
  lateralBending?: AngleIntervalDeg;
  
  /** Axial Rotation (+ Right / - Left) for spine/neck joints */
  axialRotation?: AngleIntervalDeg;
}

export interface AnatomicalJoint {
  jointId: string;
  name: string;
  type: AnatomicalJointType;
  parentSegmentId: AnatomicalRegion;
  childSegmentId: AnatomicalRegion;
  
  /** Degrees of Freedom for this anatomical joint (1, 2, or 3) */
  degreesOfFreedom: number;
  
  /** Range of Motion (ROM) boundaries with traceable reference */
  rangeOfMotion: JointRangeOfMotion;
  
  /** Current joint angles in degrees */
  currentAnglesDeg: {
    flexionExtension: number;
    abductionAdduction?: number;
    internalExternalRotation?: number;
    lateralBending?: number;
    axialRotation?: number;
  };
  
  /** Anatomical standard reference source for ROM boundaries */
  romReferenceSource: string;
}

export interface JointValidationResult {
  isValid: boolean;
  violations: string[];
}
