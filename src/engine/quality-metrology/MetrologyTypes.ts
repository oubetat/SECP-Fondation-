/**
 * PATCH-SECP-061 — Quality & Metrology Core
 * Typings for measurement plans, specifications, nominal tolerances, evaluation bands,
 * instruments, calibration records, uncertainty parameters, and cryptographical quality certificates.
 */

export type ToleranceCharacteristicType = 
  | 'FLATNESS' 
  | 'CYLINDRICITY' 
  | 'CONCENTRICITY' 
  | 'POSITION' 
  | 'DIAMETER' 
  | 'LINE_PROFILE';

export type QualityResultStatus = 'PASS' | 'FAIL' | 'INCONCLUSIVE';

export type QualityDispositionStatus = 
  | 'ACCEPTED' 
  | 'REJECTED' 
  | 'REWORK_REQUIRED' 
  | 'HOLD_FOR_REVIEW';

export interface CalibrationRecord {
  calibrationId: string;
  instrumentId: string;
  calibratedAt: string;
  nextCalibrationDue: string;
  standardBlockCertificateId: string;
  verifiedAccuracyMm: number;
}

export interface InstrumentDefinition {
  instrumentId: string;
  displayName: string;
  type: 'ZEISS_CMM_PROBE' | 'LASER_TRACKER' | 'DIGITAL_MICROMETER' | 'OPTICAL_COMPARATOR';
  resolutionMm: number;
  inherentUncertaintyMm: number; // e.g. 0.0012 mm
  calibration: CalibrationRecord;
}

export interface ToleranceSpecification {
  specId: string;
  featureId: string; // References SECP-056 Features
  topologyId: string; // References SECP-052 Topology
  characteristicType: ToleranceCharacteristicType;
  nominalMm: number;
  toleranceUpperMm: number;
  toleranceLowerMm: number;
}

export interface MeasurementPoint {
  pointId: string;
  nominalCoordinates: { x: number; y: number; z: number };
  measuredCoordinates: { x: number; y: number; z: number };
  deviationMm: number;
}

export interface MeasuredFeatureResult {
  specId: string;
  featureId: string;
  topologyId: string;
  characteristicType: ToleranceCharacteristicType;
  points: MeasurementPoint[];
  calculatedDeviationMm: number;
  uncertaintyMm: number; // Calculated total uncertainty (instrument + environmental)
  confidenceIntervalMinMm: number; // calculated deviation min
  confidenceIntervalMaxMm: number; // calculated deviation max
  status: QualityResultStatus;
  decisionRuleApplied: 'SIMPLE_ACCEPTANCE' | 'GUARD_BANDED_95_CONFIDENCE';
}

export interface MeasurementPlan {
  planId: string;
  partId: string;
  partRevision: string;
  specifications: ToleranceSpecification[];
  pointsPerFeature: Record<string, number>; // Maps featureId -> count of inspection touch-points
  timestampCreated: string;
  planHash: string;
}

export interface MeasurementSession {
  sessionId: string;
  planId: string;
  partInstanceSerialNumber: string; // References SECP-060 ManufacturedPartInstance
  instrumentId: string;
  operatorId: string;
  measuredFeatures: MeasuredFeatureResult[];
  overallStatus: QualityResultStatus;
  disposition: QualityDispositionStatus;
  reworkNotes?: string;
  timestampStart: string;
  timestampEnd?: string;
}

export interface QualityVerificationCertificate {
  certificateId: string;
  measurementSessionId: string;
  partInstanceSerialNumber: string;
  jobId: string;
  overallStatus: QualityResultStatus;
  disposition: QualityDispositionStatus;
  evaluationTimestamp: string;
  rawMeasurementHash: string;
  evaluationHash: string;
  provenanceHash: string;
}

export interface ClosedLoopRecommendation {
  recommendationId: string;
  failedSpecId: string;
  featureId: string;
  detectedDeviationMm: number;
  proposedAction: 'ADJUST_TOOL_OFFSET_Z' | 'REDUCE_FEED_RATE' | 'INCREASE_DWELL_TIME' | 'CAD_REGENERATION';
  parameterAdjustmentValue: number;
  notes: string;
  // PATCH-SECP-061: Strict Governance & Engineering Approval Fields
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: string;
  changeImpactAnalyzed: boolean;
  governanceGateValidated: boolean;
}

export type MeasurementDriverType = 'SIMULATED' | 'LIVE';

export interface MeasurementDriverConnection {
  driverId: string;
  type: MeasurementDriverType;
  protocol: 'MTCONNECT' | 'ZEISS_I_PLUS_PLUS_DME' | 'MODBUS_TCP' | 'SIMULATION_SANDBOX';
  connectionStatus: 'CONNECTED' | 'DISCONNECTED';
  vendorDriverVersion: string;
  ipAddress: string;
  lastHeartbeat: string;
}
