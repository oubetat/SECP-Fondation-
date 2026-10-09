import { ADSEAuthorityState, ADSELifecycleState } from '../p0/types';

export enum SensorDiagnosticState {
  VALID = 'VALID',
  INVALID = 'INVALID',
  STALE = 'STALE',
  MISSING = 'MISSING',
  OUT_OF_RANGE = 'OUT_OF_RANGE',
  SATURATED = 'SATURATED',
  NOISY = 'NOISY',
  CALIBRATION_EXPIRED = 'CALIBRATION_EXPIRED',
  COMMUNICATION_LOSS = 'COMMUNICATION_LOSS',
  SUSPECT = 'SUSPECT'
}

export interface CalibrationCertificate {
  id: string;
  sensorId: string;
  calibratedAt: string;
  expiresAt: string;
  technicianId: string;
  calibrationRevision: number;
  offset: number;
  gain: number;
  accuracyClass: string;
  authoritySignature: string;
}

export interface Sensor {
  sensorId: string;
  type: string;
  manufacturer: string;
  model: string;
  revision: number;
  configurationId: string;
  physicalLocation: string;
  measurementDomain: 'THERMAL' | 'POWER' | 'CONTROL' | 'COMMUNICATIONS' | 'STRUCTURAL';
  measurementRange: { min: number; max: number };
  resolution: number;
  accuracy: number;
  samplingRateHz: number;
  latencyMs: number;
  calibrationState: 'VALID' | 'EXPIRED' | 'UNINITIALIZED';
  calibrationEvidence?: string;
  uncertaintyModel: { type: 'GAUSSIAN' | 'UNIFORM'; value: number };
  interfaceType: string;
  provenance: {
    originHash: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface Measurement {
  measurementId: string;
  value: number; // Processed Engineering Value
  rawValue: number; // Raw Voltages / Readings
  unit: string;
  timestamp: string;
  uncertainty: number;
  sensorId: string;
  calibrationId: string;
  configurationId: string;
  acquisitionContext: string; // T-44, CRUISE_NOMINAL, etc.
  evidenceHash: string;
  diagnosticState: SensorDiagnosticState;
}

export interface PhysicalFinding {
  findingId: string;
  sensorId: string;
  measurementId: string;
  engineeringFindingText: string;
  affectedAssumptionId: string;
  associatedModelId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: string;
  status: 'OPEN' | 'RESOLVED' | 'INVALIDATED';
}

export interface P10Snapshot {
  id: string;
  sensors: Sensor[];
  calibrations: CalibrationCertificate[];
  measurements: Measurement[];
  findings: PhysicalFinding[];
  merkleRootHash: string;
  persistedAt: string;
  persistedByAuthority: string;
}
