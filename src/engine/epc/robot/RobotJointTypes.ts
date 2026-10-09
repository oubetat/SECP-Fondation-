/**
 * SECP Industrial OS — EPC-039: Robot Joint Design Types
 * Reusable engineering model for robotic joints using SECP Core:
 * CAD kernel, parametric geometry, assembly system, kinematics,
 * materials, mass properties, constraints, evidence, and traceability.
 */

import { Vector3D } from '../../cadKernel';
import { CADPart, CADAssembly } from '../../parametric-cad/ParametricCADTypes';

export type RobotJointType = 'REVOLUTE' | 'PRISMATIC' | 'FIXED' | string;

export interface JointLimits {
  minimumPosition: number; // deg for Revolute, mm for Prismatic
  maximumPosition: number; // deg for Revolute, mm for Prismatic
  maxVelocity: number;     // deg/s or mm/s
  maxAcceleration: number; // deg/s^2 or mm/s^2
  maxTorque: number;       // N*m or N
  ratedTorque: number;     // N*m or N
}

export interface JointGeometryParameters {
  jointDiameter: number;       // mm
  shaftDiameter: number;       // mm
  housingDiameter: number;     // mm
  housingLength: number;       // mm
  shaftLength: number;         // mm
  bearingSeatDiameter: number; // mm
  bearingSeatWidth: number;    // mm
  boltCircleDiameter: number;  // mm
  holeCount: number;
  holeDiameter: number;        // mm
  flangeDiameter: number;      // mm
  flangeThickness: number;     // mm
  bearingClearance: number;    // mm
  wallThickness: number;       // mm
}

export interface JointInertiaTensor {
  Ixx: number; // kg*m^2
  Iyy: number; // kg*m^2
  Izz: number; // kg*m^2
  Ixy: number; // kg*m^2
  Ixz: number; // kg*m^2
  Iyz: number; // kg*m^2
}

export interface JointEngineeringProperties {
  massKg: number;
  centerOfMassMm: Vector3D;
  inertiaTensorKgM2: JointInertiaTensor;
  torqueCapacityNm: number;
  geometricVolumeMm3: number;
  jointRange: {
    minimum: number;
    maximum: number;
    span: number;
    unit: string;
  };
  kinematicState: {
    position: number;
    velocity: number;
    acceleration: number;
    transform4x4: number[];
  };
}

export interface RobotJointDefinition {
  jointId: string;
  jointType: RobotJointType;
  parentLinkId: string;
  childLinkId: string;
  axis: Vector3D;
  origin: Vector3D;
  position: number;           // current angle (deg) or translation (mm)
  orientation: Vector3D;      // Euler angles (deg): roll, pitch, yaw
  limits: JointLimits;
  maxVelocity: number;
  maxAcceleration: number;
  maxTorque: number;
  ratedTorque: number;
  material: string;
  mass: number;
  inertia: { Ixx: number; Iyy: number; Izz: number };
  revision: string;
  geometryParams: JointGeometryParameters;
  properties?: JointEngineeringProperties;
}

export interface JointValidationIssue {
  readonly field: string;
  readonly severity: 'ERROR' | 'WARNING';
  readonly message: string;
  readonly value: any;
  readonly limit?: number;
}

export interface JointValidationReport {
  readonly valid: boolean;
  readonly issues: JointValidationIssue[];
  readonly timestamp: string;
}

export interface JointRequirementTraceability {
  readonly robotRequirementId: string;
  readonly jointRequirementId: string;
  readonly jointDesignId: string;
  readonly parametricGeometryId: string;
  readonly assemblyId: string;
  readonly kinematicChainId: string;
  readonly verificationId: string;
  readonly evidenceHash: string;
}

export interface JointEvidencePackage {
  readonly jointId: string;
  readonly revision: string;
  readonly geometryParameters: JointGeometryParameters;
  readonly material: string;
  readonly parentLinkId: string;
  readonly childLinkId: string;
  readonly axis: Vector3D;
  readonly limits: JointLimits;
  readonly kinematicState: {
    position: number;
    transform4x4: number[];
  };
  readonly computedProperties: JointEngineeringProperties;
  readonly verificationResults: JointValidationReport;
  readonly timestamp: string;
  readonly provenance: string;
  readonly evidenceHash: string;
}

export interface RobotJointGenerationResult {
  readonly joint: RobotJointDefinition;
  readonly parts: CADPart[];
  readonly assembly: CADAssembly;
  readonly validation: JointValidationReport;
  readonly properties: JointEngineeringProperties;
  readonly childWorldTransform: number[];
  readonly traceability: JointRequirementTraceability;
  readonly evidencePackage: JointEvidencePackage;
  readonly evidenceHash: string;
}

export interface EPC039GateReport {
  readonly epc: 'EPC-039';
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
