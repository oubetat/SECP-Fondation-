/**
 * SECP Industrial OS — EPC-042: Degrees of Freedom (DOF) Types
 * Domain model and validation interfaces for robotic degrees of freedom,
 * joint-to-DOF mappings, state tracking, limits, transmission binding,
 * assembly constraint integration, evidence generation, and traceability.
 */

import { Vector3D } from '../../cadKernel';

export type DOFType = 'REVOLUTE' | 'PRISMATIC' | 'FIXED' | 'CYLINDRICAL' | 'SPHERICAL' | 'PLANAR' | string;
export type DOFReferenceFrame = 'GLOBAL' | 'PARENT_LINK' | 'JOINT';

export interface DOFLimits {
  minPosition: number;      // deg for Revolute, mm for Prismatic
  maxPosition: number;      // deg for Revolute, mm for Prismatic
  maxVelocity: number;      // deg/s or mm/s
  maxAcceleration: number;  // deg/s^2 or mm/s^2
  maxTorque?: number;       // N*m or N
  ratedTorque?: number;     // N*m or N
}

export interface DOFState {
  position: number;     // deg (Revolute) or mm (Prismatic)
  velocity: number;     // deg/s (Revolute) or mm/s (Prismatic)
  acceleration: number; // deg/s^2 (Revolute) or mm/s^2 (Prismatic)
}

export interface DOFDefinition {
  dofId: string;
  robotId: string;
  assemblyId: string;
  jointId: string;
  jointType: string;
  dofType: DOFType;
  axis: Vector3D;
  referenceFrame: DOFReferenceFrame;
  parentLinkId: string;
  childLinkId: string;
  state: DOFState;
  limits: DOFLimits;
  enabled: boolean;
  locked: boolean;
  suppressed?: boolean;
}

export interface JointDOFMapping {
  jointId: string;
  jointType: string;
  declaredDOF: number;
  activeDOF: number;
  lockedDOF: number;
  suppressedDOF: number;
  dofIds: string[];
}

export interface TransmissionDOFBinding {
  jointId: string;
  motorSpeedRpm: number;
  transmissionRatio: number;
  jointSpeedRpm: number;
  dofVelocity: number; // deg/s or mm/s
  motorTorqueNm: number;
  transmissionEfficiency: number;
  jointTorqueNm: number;
  isConsistent: boolean;
}

export interface ConstraintDOFImpact {
  constraintId: string;
  constraintType: string;
  affectedComponents: string[];
  restrictedDOFCount: number;
  description: string;
}

export interface RobotDOFSummary {
  totalDeclaredDOF: number;   // Sum of DOFs declared by all joints
  totalActiveDOF: number;     // Active, un-locked, un-suppressed DOFs
  totalLockedDOF: number;     // Locked DOFs count
  totalSuppressedDOF: number; // Suppressed/disabled DOFs count
  independentDOF: number;    // Computed independent DOFs
  taskDOF?: number;           // Task DOFs (e.g. 6 for 3D pose)
  redundantDOF?: number;      // Redundant DOFs count
  isRedundant: boolean;
  constraintIndependenceCapability: 'SUPPORTED' | 'PARTIAL' | 'NOT_SUPPORTED';
  singularityCapability: 'IMPLEMENTED' | 'NOT_IMPLEMENTED';
  singularityStatus?: {
    isSingular: boolean;
    conditionNumber: number;
    diagnosticMessage: string;
  };
}

export interface DOFValidationIssue {
  readonly field: string;
  readonly severity: 'ERROR' | 'WARNING';
  readonly message: string;
  readonly value: any;
  readonly limit?: number;
}

export interface DOFValidationReport {
  readonly valid: boolean;
  readonly issues: DOFValidationIssue[];
  readonly timestamp: string;
}

export interface RobotDOFProvenanceRecord {
  who: string;
  what: string;
  when: string;
  source: string;
  version: string;
  input: {
    robotId: string;
    assemblyId: string;
    jointCount: number;
    dofCount: number;
  };
  process: string;
  output: {
    totalDeclaredDOF: number;
    totalActiveDOF: number;
    totalLockedDOF: number;
    independentDOF: number;
  };
}

export interface RobotDOFEvidencePackage {
  robotId: string;
  assemblyId: string;
  jointList: string[];
  dofList: DOFDefinition[];
  totalDeclaredDOF: number;
  totalActiveDOF: number;
  totalLockedDOF: number;
  totalSuppressedDOF: number;
  independentDOF: number;
  constraintsCount: number;
  axes: { dofId: string; axis: Vector3D; valid: boolean }[];
  limitsSummary: { dofId: string; min: number; max: number; valid: boolean }[];
  configurationHash: string;
  validationReport: DOFValidationReport;
  provenance: RobotDOFProvenanceRecord;
  timestamp: string;
  evidenceHash: string;
  verdict: 'PASS' | 'FAIL';
}

export interface RobotDOFTraceability {
  robotRequirementId: string;
  jointRequirementId: string;
  jointDesignId: string;
  assemblyId: string;
  dofDefinitionId: string;
  dofCalculationId: string;
  verificationId: string;
  evidenceHash: string;
}

export interface EPC042GateReport {
  readonly epc: 'EPC-042';
  readonly name: string;
  readonly verdict: 'PASS' | 'FAIL';
  readonly checks: Record<string, { passed: boolean; message: string }>;
  readonly summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
  };
  readonly evidenceHash: string;
  readonly timestamp: string;
}
