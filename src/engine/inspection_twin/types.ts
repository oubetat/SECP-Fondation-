// SECP Industrial OS v2 — Inspection Twin Core Types & Data Definitions

export type InspectionVerdict = 
  | 'PASS'
  | 'FAIL'
  | 'INDETERMINATE'
  | 'MEASUREMENT_INVALID'
  | 'CALIBRATION_FAILURE'
  | 'OUT_OF_TOLERANCE'
  | 'INCOMPLETE'
  | 'INVALID';

export type InspectionStateStatus =
  | 'PLANNED'
  | 'READY'
  | 'IN_PROGRESS'
  | 'MEASURED'
  | 'EVALUATED'
  | 'PASSED'
  | 'FAILED'
  | 'INCOMPLETE'
  | 'INVALID'
  | 'SUPERSEDED';

export type CalibrationStatus =
  | 'VALID'
  | 'EXPIRED'
  | 'REVOKED'
  | 'MISSING'
  | 'INVALID'
  | 'UNKNOWN';

export type RequirementType =
  | 'SIZE'
  | 'FLATNESS'
  | 'STRAIGHTNESS'
  | 'CIRCULARITY'
  | 'CYLINDRICITY'
  | 'PARALLELISM'
  | 'PERPENDICULARITY'
  | 'ANGULARITY'
  | 'POSITION'
  | 'CONCENTRICITY'
  | 'SYMMETRY'
  | 'PROFILE_OF_LINE'
  | 'PROFILE_OF_SURFACE'
  | 'CIRCULAR_RUNOUT'
  | 'TOTAL_RUNOUT'
  | 'SURFACE_ROUGHNESS'
  | 'CUSTOM';

export interface InspectionRequirement {
  requirementId: string;
  requirementType: RequirementType;
  sourceReference: string;
  featureId: string;
  datumReference: string[];
  nominal: number;
  upperLimit: number;
  lowerLimit: number;
  toleranceType: 'BILATERAL' | 'UNILATERAL' | 'LIMITS';
  measurementMethod: string;
  requiredAccuracy: number;
  uncertaintyLimit: number;
  criticality: 'CRITICAL' | 'MAJOR' | 'MINOR';
  requirementHash: string;
}

export interface InspectionPlan {
  inspectionPlanId: string;
  revision: string;
  partDefinition: string;
  requirements: InspectionRequirement[];
  measurementMethods: string[];
  measurementDevices: string[];
  samplingPolicy: string;
  inspectionPlanHash: string;
}

export interface MeasurementDevice {
  deviceId: string;
  deviceType: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  softwareVersion: string;
  firmwareVersion: string;
  accuracy: number;
  resolution: number;
  deviceHash: string;
}

export interface CalibrationRecord {
  calibrationId: string;
  deviceId: string;
  certificateId: string;
  calibrationDate: string;
  expiryDate: string;
  calibrationStandard: string;
  uncertainty: number;
  status: CalibrationStatus;
  certificateHash: string;
}

export interface MeasurementRecord {
  measurementId: string;
  inspectionTwinId: string;
  requirementId: string;
  featureId: string;
  deviceId: string;
  calibrationId: string;
  timestamp: string;
  operatorId: string;
  methodId: string;
  rawDataHash: string;
  processedDataHash: string;
  nominalValue: number;
  measuredValue: number;
  unit: string;
  uncertainty: number;
  measurementHash: string;
}

export interface ToleranceEvaluation {
  requirementId: string;
  nominal: number;
  lowerLimit: number;
  upperLimit: number;
  measured: number;
  deviation: number;
  uncertainty: number;
  acceptanceMargin: number;
  verdict: InspectionVerdict;
}

export interface InspectionState {
  partIdentityHash: string;
  designRevision: string;
  geometryRevision: string;
  requirementRevision: string;
  inspectionPlan: InspectionPlan;
  measurementDevice: MeasurementDevice;
  calibrationRecord: CalibrationRecord;
  measurements: MeasurementRecord[];
  evaluations: ToleranceEvaluation[];
  evidenceId: string;
}

export interface InspectionEvent {
  eventId: string;
  inspectionTwinId: string;
  eventType: string;
  timestamp: string;
  actor: string;
  source: string;
  previousStateHash: string;
  newStateHash: string;
  evidenceId: string;
  eventHash: string;
}

export interface InspectionEvidence {
  evidenceId: string;
  inspectionTwinId: string;
  evidenceType: string;
  source: string;
  timestamp: string;
  payloadHash: string;
  parentEvidenceHash: string;
  signature: string;
}

export interface InspectionTwin {
  inspectionTwinId: string;
  partSerial: string;
  manufacturingTwinId: string;
  designRevision: string;
  geometryRevision: string;
  inspectionRevision: string;
  inspectionPlanId: string;
  measurementDeviceId: string;
  calibrationId: string;
  measurementExecutionId: string;
  inspectionState: InspectionState;
  state: InspectionStateStatus;
  verdict: InspectionVerdict;
  createdAt: string;
  updatedAt: string;
  inputHash: string;
  rootHash: string;
}
