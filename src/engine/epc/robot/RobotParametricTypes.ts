/**
 * SECP Industrial OS — EPC-038: Robot Parametric Links Types
 * Strongly-typed parameter definitions, dependency graph schemas,
 * derived properties, revision tracking, and validation records for
 * the 6-DOF Industrial Robotic Arm.
 */

import { ParametricDependencyGraphSnapshot } from '../../parametric-cad/ParametricDependencyGraph';
import { CADAssembly, CADPart } from '../../parametric-cad/ParametricCADTypes';

export type RobotParameterCategory = 'GEOMETRY' | 'MECHANICAL' | 'MATERIAL' | 'PERFORMANCE';

export interface RobotParameterDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: RobotParameterCategory;
  readonly value: number | string;
  readonly unit: string;
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly allowedValues?: string[];
  readonly description: string;
  readonly isDerived?: boolean;
  readonly expression?: string;
}

export interface RobotGeometryParameters {
  baseRadius: number; // mm
  baseHeight: number; // mm
  link1Length: number; // mm
  link1Radius: number; // mm
  link2Length: number; // mm
  link2Radius: number; // mm
  link3Length: number; // mm
  link3Radius: number; // mm
  jointHousingDimensions: number; // mm
  endEffectorOffset: number; // mm
}

export interface RobotMechanicalParameters {
  joint1Range: number; // deg
  joint2Range: number; // deg
  joint3Range: number; // deg
  joint4Range: number; // deg
  joint5Range: number; // deg
  joint6Range: number; // deg
  payloadCapacity: number; // kg
}

export interface RobotMaterialParameters {
  link1Material: string;
  link2Material: string;
  link3Material: string;
  jointHousingMaterial: string;
  baseMaterial: string;
}

export interface RobotPerformanceParameters {
  maximumPayload: number; // kg
  maximumReach: number; // mm
  maximumJointVelocity: number; // deg/s
  maximumJointAcceleration: number; // deg/s^2
}

export interface DerivedRobotParameters {
  reachMm: number;
  totalMassKg: number;
  payloadMarginKg: number;
  centerOfMassMm: { x: number; y: number; z: number };
  maxInertiaKgM2: number;
}

export interface ParametricRobotConfig {
  geometry: RobotGeometryParameters;
  mechanical: RobotMechanicalParameters;
  materials: RobotMaterialParameters;
  performance: RobotPerformanceParameters;
}

export interface ParameterValidationIssue {
  readonly parameterId: string;
  readonly severity: 'ERROR' | 'WARNING';
  readonly message: string;
  readonly value: any;
  readonly limit?: number;
}

export interface ParameterValidationReport {
  readonly valid: boolean;
  readonly issues: ParameterValidationIssue[];
  readonly timestamp: string;
}

export type AnalysisStatus = 'VALID' | 'STALE' | 'INVALIDATED' | 'REQUIRES_RECOMPUTATION';

export interface EngineeringAnalysisRecord {
  readonly id: string;
  readonly name: string;
  readonly category: 'FEA' | 'KINEMATICS' | 'DYNAMICS' | 'MOTOR_DRIVE' | 'PAYLOAD_CHECK';
  status: AnalysisStatus;
  readonly drivingParameters: string[];
  invalidatedByParameter?: string;
  lastComputedAt: string;
  resultSummary?: Record<string, any>;
}

export interface ParameterRevisionRecord {
  readonly revision: string;
  readonly changedAt: string;
  readonly changedBy: string;
  readonly parameterId: string;
  readonly previousValue: any;
  readonly newValue: any;
  readonly affectedFeatures: string[];
  readonly affectedModels: string[];
  readonly staleAnalysisList: string[];
}

export interface RobotRegenerationResult {
  readonly robotId: string;
  readonly revision: string;
  readonly timestamp: string;
  readonly config: ParametricRobotConfig;
  readonly graphSnapshot: ParametricDependencyGraphSnapshot;
  readonly parts: CADPart[];
  readonly assembly: CADAssembly;
  readonly derived: DerivedRobotParameters;
  readonly validation: ParameterValidationReport;
  readonly analyses: EngineeringAnalysisRecord[];
  readonly staleAnalysisIds: string[];
  readonly brokenDependencies: string[];
  readonly evidenceHash: string;
}

export interface EPC038GateReport {
  readonly epc: 'EPC-038';
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
