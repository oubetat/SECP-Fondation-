/**
 * SECP Industrial OS — EPC-040: Transmission & Gear Model Types
 * Reusable engineering model for mechanical transmissions and gears in robotic applications.
 * Uses SECP Core: CAD kernel, parametric geometry, materials, mass properties,
 * power conservation, evidence, provenance, and validation.
 */

import { Vector3D } from '../../cadKernel';

export type TransmissionType = 'SPUR' | 'HELICAL' | 'BEVEL' | 'PLANETARY' | 'HARMONIC' | 'MULTI_STAGE';

export type GearType = 'SPUR' | 'HELICAL' | 'BEVEL' | 'PLANETARY';

export type GearSupportStatus = 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED';

export interface ShaftInterface {
  shaftId: string;
  diameterMm: number;
  lengthMm: number;
  speedRpm: number;
  torqueNm: number;
  material: string;
}

export interface BearingInterface {
  bearingId: string;
  modelNumber: string;
  boreDiameterMm: number;
  outerDiameterMm: number;
  loadCapacityN: number;
}

export interface GearInertiaTensor {
  Ixx: number; // kg*m^2
  Iyy: number; // kg*m^2
  Izz: number; // kg*m^2
  Ixy?: number;
  Ixz?: number;
  Iyz?: number;
}

export interface GearModelDefinition {
  gearId: string;
  name: string;
  teethCount: number;
  module: number;          // mm
  pitchDiameter: number;   // mm
  outsideDiameter: number; // mm (tip diameter)
  rootDiameter: number;    // mm
  pressureAngle: number;   // deg
  faceWidth: number;       // mm
  helixAngle: number;      // deg
  gearType: GearType;
  material: string;        // e.g. 'CASE_HARDENED_16MNCR5'
  mass: number;            // kg
  inertia: GearInertiaTensor;
  revision: string;
  supportStatus: GearSupportStatus;
}

export interface TransmissionStageDefinition {
  stageId: string;
  stageIndex: number;
  stageType: GearType;
  driverGear: GearModelDefinition;
  drivenGear: GearModelDefinition;
  bearingInterface?: BearingInterface;
  stageRatio: number;
  stageEfficiency: number;
  inputSpeed: number;  // RPM
  outputSpeed: number; // RPM
  inputTorque: number; // Nm
  outputTorque: number; // Nm
  inputPower: number;  // Watts
  outputPower: number; // Watts
  direction: number;   // 1 (same) or -1 (reversed)
}

export interface TransmissionDefinition {
  transmissionId: string;
  name: string;
  type: TransmissionType;
  jointId?: string;          // Associated robotic joint ID
  inputShaft: ShaftInterface;
  outputShaft: ShaftInterface;
  inputSpeed: number;        // RPM
  outputSpeed: number;       // RPM
  inputTorque: number;       // Nm
  outputTorque: number;      // Nm
  ratio: number;             // Total gear ratio
  efficiency: number;        // Total mechanical efficiency (0 to 1)
  power: number;             // Input power in Watts
  inputPower: number;        // Watts
  outputPower: number;       // Watts
  direction: number;         // 1 or -1
  stageCount: number;
  gearStages: TransmissionStageDefinition[];
  material: string;
  revision: string;
  totalMassKg: number;
  overallInertiaKgM2: GearInertiaTensor;
}

export interface TransmissionJointOutput {
  jointId: string;
  jointOutputSpeedRpm: number;
  jointOutputTorqueNm: number;
  jointOutputPowerW: number;
  transmissionRatio: number;
  transmissionEfficiency: number;
  direction: number;
}

export interface TransmissionValidationIssue {
  readonly field: string;
  readonly severity: 'ERROR' | 'WARNING';
  readonly message: string;
  readonly value: any;
  readonly limit?: number;
}

export interface TransmissionValidationReport {
  readonly valid: boolean;
  readonly issues: TransmissionValidationIssue[];
  readonly timestamp: string;
}

export interface TransmissionProvenanceRecord {
  readonly who: string;
  readonly what: string;
  readonly when: string;
  readonly source: string;
  readonly version: string;
  readonly input: any;
  readonly process: string;
  readonly output: any;
}

export interface TransmissionEvidencePackage {
  readonly transmissionId: string;
  readonly jointId?: string;
  readonly revision: string;
  readonly gearParameters: {
    stageCount: number;
    gearStages: Array<{
      stageId: string;
      driverTeeth: number;
      drivenTeeth: number;
      module: number;
      stageRatio: number;
      stageEfficiency: number;
    }>;
  };
  readonly material: string;
  readonly inputSpeed: number;
  readonly inputTorque: number;
  readonly inputPower: number;
  readonly gearRatio: number;
  readonly efficiency: number;
  readonly outputSpeed: number;
  readonly outputTorque: number;
  readonly outputPower: number;
  readonly validationResults: TransmissionValidationReport;
  readonly testResults: {
    ratioCheck: boolean;
    speedCheck: boolean;
    torqueCheck: boolean;
    powerConservationCheck: boolean;
  };
  readonly provenance: TransmissionProvenanceRecord;
  readonly timestamp: string;
  readonly evidenceHash: string;
  readonly verdict: 'PASS' | 'FAIL';
}

export interface TransmissionGenerationResult {
  readonly transmission: TransmissionDefinition;
  readonly jointOutput: TransmissionJointOutput;
  readonly validation: TransmissionValidationReport;
  readonly provenance: TransmissionProvenanceRecord;
  readonly evidencePackage: TransmissionEvidencePackage;
  readonly evidenceHash: string;
  readonly verdict: 'PASS' | 'FAIL';
}

export interface EPC040GateReport {
  readonly epc: 'EPC-040';
  readonly name: string;
  readonly verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  readonly checks: Record<string, { passed: boolean; message: string }>;
  readonly summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
  };
  readonly evidenceHash: string;
  readonly timestamp: string;
}
