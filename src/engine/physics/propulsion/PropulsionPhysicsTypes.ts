/**
 * SECP Core Physics Engine — Propulsion System Types
 * Pure domain-neutral physics and mathematics type declarations for Motor,
 * Propeller, Operating Point, Environment, Thrust, Torque, Power, Efficiency,
 * 3D Propulsion Vectors, Moments, Curves, Limits, and Analytical Fixtures.
 */

import { Vector3D, Transform3D } from '../mass/MassPropertiesTypes';

export type RotationDirection = 'CW' | 'CCW';

export interface MotorDimensions {
  diameter?: number; // m
  length?: number; // m
  dx?: number; // m
  dy?: number; // m
  dz?: number; // m
  shaftDiameter?: number; // m
}

export interface MotorThermalLimits {
  maxOperatingTempC: number;
  thermalResistanceKw?: number;
}

export interface MotorUnits {
  mass: 'kg' | 'g';
  voltage: 'V';
  current: 'A';
  torque: 'N·m' | 'N·cm';
  speed: 'RPM' | 'rad/s';
  power: 'W' | 'kW';
}

export interface Motor {
  motorId: string;
  manufacturerReference: string;
  model: string;
  revision: string;
  mass: number; // kg
  dimensions: MotorDimensions;
  Kv: number; // RPM / V
  Kt: number | 'UNKNOWN'; // N·m / A
  resistance: number; // Ohms (phase-to-phase)
  noLoadCurrent: number; // A
  voltageRange: { min: number; max: number }; // V
  currentLimit: number; // A (continuous peak)
  powerLimit: number; // W
  efficiencyModel: string;
  thermalLimits: MotorThermalLimits;
  units: MotorUnits;
  provenance: {
    source: string;
    version: string;
    computedAt: string;
  };
}

export interface PropellerOperatingRange {
  minRpm: number;
  maxRpm: number;
  maxTipSpeedMps: number;
}

export interface PropellerUnits {
  mass: 'kg' | 'g';
  length: 'm' | 'mm' | 'in';
  speed: 'RPM' | 'rad/s';
  force: 'N';
  torque: 'N·m';
}

export interface Propeller {
  propellerId: string;
  revision: string;
  diameter: number; // m
  pitch: number; // m
  bladeCount: number;
  airfoilReference: string;
  rotationDirection: RotationDirection;
  mass: number; // kg
  material: string;
  geometryReference: {
    artifactId: string;
    artifactHash: string;
    revision: string;
    source: string;
  };
  operatingRange: PropellerOperatingRange;
  Ct: number; // Thrust coefficient (non-dimensional)
  Cq: number; // Torque coefficient (non-dimensional)
  Cp?: number; // Power coefficient (Cp = 2 * PI * Cq)
  units: PropellerUnits;
  provenance: {
    source: string;
    version: string;
    computedAt: string;
  };
}

export interface MotorController {
  controllerId: string;
  maxCurrent: number; // A
  minVoltage: number; // V
  maxVoltage: number; // V
  efficiency: number; // e.g. 0.98
}

export interface PropulsionEnvironment {
  airDensity: number; // kg/m³ (e.g. 1.225 at sea level)
  temperatureC: number; // °C (e.g. 15)
  pressurePa: number; // Pa (e.g. 101325)
  altitudeM: number; // m
}

export interface PropulsionOperatingPoint {
  voltage: number; // V
  current: number; // A
  rpm: number; // RPM
  vClimbMps?: number; // m/s (climb or forward axial velocity)
  environment: PropulsionEnvironment;
}

export interface ThrustResult {
  thrustN: number; // N
  thrustKgf: number; // kgf
  Ct: number; // Thrust coefficient used
  airDensity: number; // kg/m³
  rotationalSpeedRps: number; // rps (n = RPM/60)
  diameter: number; // m
  formulaUsed: string;
  isValid: boolean;
  validationMessage?: string;
}

export interface TorqueResult {
  torqueNm: number; // N·m
  Cq: number; // Torque coefficient used
  airDensity: number; // kg/m³
  rotationalSpeedRps: number; // rps
  diameter: number; // m
  motorElectromechanicalTorqueNm: number; // Kt * I
  formulaUsed: string;
  isValid: boolean;
}

export interface PowerResult {
  electricalPowerW: number; // P_elec = V * I
  mechanicalPowerW: number; // P_mech = Q * omega
  thrustPowerW: number; // P_thrust = T * V_climb
  formulaUsed: string;
  isValid: boolean;
}

export interface EfficiencyResult {
  motorElectricalEfficiency: number; // P_mech / P_elec
  overallPropulsionEfficiency: number;
  isValid: boolean;
  nonphysicalError?: string;
}

export interface PropulsionUnits {
  force: 'N';
  torque: 'N·m';
  power: 'W' | 'kW';
  speed: 'RPM' | 'rad/s';
  voltage: 'V';
  current: 'A';
  density: 'kg/m³';
}

export interface SinglePropulsionUnitResult {
  unitId: string;
  position: Vector3D;
  transform: Transform3D;
  rotationDirection: RotationDirection;
  operatingPoint: PropulsionOperatingPoint;
  thrust: ThrustResult;
  torque: TorqueResult;
  power: PowerResult;
  efficiency: EfficiencyResult;
  thrustVectorGlobal: Vector3D;
  reactionTorqueVectorGlobal: Vector3D;
  positionMomentGlobal: Vector3D;
  totalMomentContributionGlobal: Vector3D;
  limitStatus: {
    isVoltageValid: boolean;
    isCurrentValid: boolean;
    isRpmValid: boolean;
    isPowerValid: boolean;
    isTipSpeedValid: boolean;
    warnings: string[];
  };
}

export interface PropulsionSystemResult {
  propulsionSystemId: string;
  revision: string;
  configurationId: string;
  unitCount: number;
  unitsResults: SinglePropulsionUnitResult[];
  totalThrustN: number; // Sum of scalar thrust magnitudes
  totalThrustVectorGlobal: Vector3D; // Sum of 3D thrust vectors
  totalPropulsionMomentGlobal: Vector3D; // Sum of (r x F + reaction torque)
  totalElectricalPowerW: number; // Sum of P_elec
  totalMechanicalPowerW: number; // Sum of P_mech
  totalThrustPowerW: number; // Sum of P_thrust
  systemEfficiency: number;
  referenceFrame: 'ASSEMBLY' | 'GLOBAL';
  units: PropulsionUnits;
  modelVersion: string;
  calculationMethod: string;
  provenance: {
    inputHash: string;
    outputHash: string;
    calculationMethod: string;
    modelVersion: string;
    computedAt: string;
  };
  evidenceReference: string;
  isValid: boolean;
  validationMessages: string[];
}

export interface SweepPointResult {
  rpm: number;
  voltage: number;
  current: number;
  thrustN: number;
  torqueNm: number;
  electricalPowerW: number;
  mechanicalPowerW: number;
  efficiency: number;
  tipSpeedMps: number;
  isValid: boolean;
}

export interface OperatingPointSweepResults {
  sweepId: string;
  environment: PropulsionEnvironment;
  points: SweepPointResult[];
  maxThrustN: number;
  maxPowerW: number;
  peakEfficiency: number;
  provenanceHash: string;
}

export interface AnalyticalPropulsionValidationReport {
  fixtureName: string;
  expectedThrustN: number;
  secpThrustN: number;
  thrustErrorAbs: number;
  thrustErrorRel: number;
  expectedTorqueNm: number;
  secpTorqueNm: number;
  torqueErrorAbs: number;
  torqueErrorRel: number;
  expectedMechanicalPowerW: number;
  secpMechanicalPowerW: number;
  powerErrorAbs: number;
  powerErrorRel: number;
  tolerance: number;
  passed: boolean;
}
