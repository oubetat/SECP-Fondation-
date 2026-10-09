/**
 * SECP Industrial OS v2 — PATCH-112 Manufacturing Evidence Chain Types
 * Engineering Truth & Forensically Verifiable Evidence Chain
 */

export enum EvidenceType {
  DESIGN_EVIDENCE = "DESIGN_EVIDENCE",
  CAD_REVISION_EVIDENCE = "CAD_REVISION_EVIDENCE",
  FEATURE_EVIDENCE = "FEATURE_EVIDENCE",
  MATERIAL_EVIDENCE = "MATERIAL_EVIDENCE",
  TOOL_EVIDENCE = "TOOL_EVIDENCE",
  MACHINE_EVIDENCE = "MACHINE_EVIDENCE",
  KINEMATIC_EVIDENCE = "KINEMATIC_EVIDENCE",
  CAM_OPERATION_EVIDENCE = "CAM_OPERATION_EVIDENCE",
  TOOLPATH_EVIDENCE = "TOOLPATH_EVIDENCE",
  SIMULATION_EVIDENCE = "SIMULATION_EVIDENCE",
  POST_PROCESSOR_EVIDENCE = "POST_PROCESSOR_EVIDENCE",
  NC_PROGRAM_EVIDENCE = "NC_PROGRAM_EVIDENCE",
  GCODE_VERIFICATION_EVIDENCE = "GCODE_VERIFICATION_EVIDENCE",
  DIGITAL_TWIN_EVIDENCE = "DIGITAL_TWIN_EVIDENCE",
  EXECUTION_EVIDENCE = "EXECUTION_EVIDENCE",
  TELEMETRY_EVIDENCE = "TELEMETRY_EVIDENCE",
  INSPECTION_EVIDENCE = "INSPECTION_EVIDENCE",
  MEASUREMENT_EVIDENCE = "MEASUREMENT_EVIDENCE",
  OPERATOR_EVIDENCE = "OPERATOR_EVIDENCE",
  ENVIRONMENT_EVIDENCE = "ENVIRONMENT_EVIDENCE",
  APPROVAL_EVIDENCE = "APPROVAL_EVIDENCE",
  EXCEPTION_EVIDENCE = "EXCEPTION_EVIDENCE",
  FAILURE_EVIDENCE = "FAILURE_EVIDENCE"
}

export enum EvidenceSourceType {
  CAD = "CAD",
  CAM = "CAM",
  SIMULATOR = "SIMULATOR",
  VERIFIER = "VERIFIER",
  MACHINE = "MACHINE",
  PLC = "PLC",
  CNC = "CNC",
  SENSOR = "SENSOR",
  MES = "MES",
  OPERATOR = "OPERATOR",
  INSPECTION_SYSTEM = "INSPECTION_SYSTEM",
  DIGITAL_TWIN = "DIGITAL_TWIN",
  EXTERNAL_SYSTEM = "EXTERNAL_SYSTEM"
}

export enum EventType {
  JOB_CREATED = "JOB_CREATED",
  JOB_RELEASED = "JOB_RELEASED",
  MATERIAL_LOADED = "MATERIAL_LOADED",
  TOOL_LOADED = "TOOL_LOADED",
  TOOL_INSTALLED = "TOOL_INSTALLED",
  FIXTURE_INSTALLED = "FIXTURE_INSTALLED",
  MACHINE_CONFIGURED = "MACHINE_CONFIGURED",
  PROGRAM_LOADED = "PROGRAM_LOADED",
  PROGRAM_VERIFIED = "PROGRAM_VERIFIED",
  MACHINE_STARTED = "MACHINE_STARTED",
  EXECUTION_STARTED = "EXECUTION_STARTED",
  MACHINE_STOPPED = "MACHINE_STOPPED",
  EXECUTION_COMPLETED = "EXECUTION_COMPLETED",
  EXECUTION_ABORTED = "EXECUTION_ABORTED",
  TOOL_CHANGED = "TOOL_CHANGED",
  OPERATION_STARTED = "OPERATION_STARTED",
  OPERATION_COMPLETED = "OPERATION_COMPLETED",
  ALARM_RAISED = "ALARM_RAISED",
  COLLISION_EVENT = "COLLISION_EVENT",
  PAUSE_EVENT = "PAUSE_EVENT",
  RESUME_EVENT = "RESUME_EVENT",
  PROGRAM_ABORTED = "PROGRAM_ABORTED",
  PROGRAM_COMPLETED = "PROGRAM_COMPLETED",
  INSPECTION_STARTED = "INSPECTION_STARTED",
  INSPECTION_COMPLETED = "INSPECTION_COMPLETED",
  MEASUREMENT_CAPTURED = "MEASUREMENT_CAPTURED",
  REWORK_STARTED = "REWORK_STARTED",
  REWORK_COMPLETED = "REWORK_COMPLETED",
  SCRAPPED = "SCRAPPED",
  SENSOR_FAILURE = "SENSOR_FAILURE",
  JOB_CLOSED = "JOB_CLOSED"
}

export enum SignatureStatus {
  VALID = "VALID",
  INVALID = "INVALID",
  MISSING = "MISSING",
  UNKNOWN_KEY = "UNKNOWN_KEY",
  EXPIRED_KEY = "EXPIRED_KEY",
  UNSUPPORTED = "UNSUPPORTED"
}

export enum CorroborationVerdict {
  CORROBORATED = "CORROBORATED",
  PARTIALLY_CORROBORATED = "PARTIALLY_CORROBORATED",
  CONFLICTING = "CONFLICTING",
  INSUFFICIENT = "INSUFFICIENT",
  UNDETERMINED = "UNDETERMINED"
}

export enum ConflictResolutionStatus {
  UNRESOLVED = "UNRESOLVED",
  RESOLVED = "RESOLVED",
  DISMISSED_WITH_EVIDENCE = "DISMISSED_WITH_EVIDENCE",
  ESCALATED = "ESCALATED"
}

export enum InspectionVerdict {
  PASS = "PASS",
  FAIL = "FAIL",
  OUT_OF_TOLERANCE = "OUT_OF_TOLERANCE",
  INVALID = "INVALID",
  INCOMPLETE = "INCOMPLETE",
  UNDETERMINED = "UNDETERMINED"
}

export enum CollisionSeverity {
  SIMULATED_COLLISION = "SIMULATED_COLLISION",
  ACTUAL_COLLISION = "ACTUAL_COLLISION",
  SUSPECTED_COLLISION = "SUSPECTED_COLLISION"
}

export enum ManufacturingEvidenceStatus {
  COMPLETE = "COMPLETE",
  INCOMPLETE = "INCOMPLETE",
  CORROBORATED = "CORROBORATED",
  CONFLICTING = "CONFLICTING",
  CHAIN_BROKEN = "CHAIN_BROKEN",
  INTEGRITY_FAILURE = "INTEGRITY_FAILURE",
  AUTHENTICITY_FAILURE = "AUTHENTICITY_FAILURE",
  PHYSICAL_DIGITAL_MISMATCH = "PHYSICAL_DIGITAL_MISMATCH",
  INSUFFICIENT = "INSUFFICIENT",
  UNDETERMINED = "UNDETERMINED",
  INVALID = "INVALID",
  MANUFACTURING_VERIFIED = "MANUFACTURING_VERIFIED"
}

export interface SourceIdentity {
  sourceType: EvidenceSourceType;
  sourceId: string;
  sourceRevision: string;
  sourceFingerprint: string;
}

export interface EventIdentity {
  eventId: string;
  eventType: EventType;
  eventSequence: number;
  eventTimestamp: number;
  sourceTimestamp: number;
  recordedTimestamp: number;
  clockSource?: string;
  clockOffset?: number;
  clockAccuracy?: number;
}

export interface ManufacturingEvidenceContract {
  evidenceId: string;
  evidenceType: EvidenceType;
  evidenceVersion: string;
  sourceArtifactId: string;
  sourceRevision: string;
  eventId: string;
  eventType: EventType;
  eventTimestamp: number;
  recordedTimestamp: number;
  producerId: string;
  producerType: EvidenceSourceType;
  contentHash: string;
  canonicalHash: string;
  previousEvidenceHash: string;
  chainSequence: number;
  signature?: string;
  signingIdentity?: string;
  verificationStatus: ManufacturingEvidenceStatus;
  recordingMode?: "ORIGINAL" | "RETROSPECTIVE";
}

export interface ManufacturingEvidenceRecord {
  contract: ManufacturingEvidenceContract;
  sourceIdentity: SourceIdentity;
  eventIdentity: EventIdentity;
  payload: any;
  context: any;
  attestations: EvidenceAttestation[];
}

export interface EvidenceAttestation {
  attestationId: string;
  evidenceId: string;
  attestorId: string;
  attestorRole: string;
  attestationType: string;
  timestamp: number;
  statement: string;
  signature: string;
}

export interface EvidenceConflictRecord {
  conflictId: string;
  evidenceAId: string;
  evidenceBId: string;
  sourceA: EvidenceSourceType;
  sourceB: EvidenceSourceType;
  conflictType: string;
  detectedAt: number;
  resolutionStatus: ConflictResolutionStatus;
  resolutionEvidenceId?: string;
  details: string;
}

export interface MachineStateSnapshot {
  axes: { x: number; y: number; z: number; a?: number; b?: number; c?: number };
  spindleSpeedRPM: number;
  feedRateMMMin: number;
  activeToolId: string;
  activeProgramId: string;
  mode: string;
  activeAlarms: string[];
  offsets: { g54?: { x: number; y: number; z: number } };
  timestamp: number;
}

export interface MeasurementEvidence {
  measurementId: string;
  featureId: string;
  nominalValue: number;
  measuredValue: number;
  unit: string;
  tolerance: { upper: number; lower: number };
  instrumentId: string;
  instrumentRevision: string;
  calibrationId?: string;
  calibrationStatus?: "VALID" | "EXPIRED" | "CALIBRATION_INVALID";
  timestamp: number;
}

export interface ManufacturingInspectionEvidence {
  inspectionId: string;
  partId: string;
  partRevision: string;
  inspectionPlanId: string;
  inspectionPlanRevision: string;
  instrumentId: string;
  instrumentRevision: string;
  operatorId: string;
  timestamp: number;
  measurements: MeasurementEvidence[];
  verdict: InspectionVerdict;
  resultHash: string;
}

export interface ManufacturingNonconformanceEvidence {
  nonconformanceId: string;
  partId: string;
  featureId: string;
  measurementEvidenceId: string;
  severity: "MINOR" | "MAJOR" | "CRITICAL";
  disposition: "REWORK" | "SCRAP" | "USE_AS_IS";
  dispositionApproval: string;
  timestamp: number;
}

export interface PhysicalDigitalBinding {
  bindingId: string;
  partInstanceId: string;
  serialNumber: string;
  lotNumber: string;
  batchNumber: string;
  digitalJobRootId: string;
  bindingTimestamp: number;
  bindingMethod: "BARCODE" | "RFID" | "DIRECT_PART_MARKING" | "OPERATOR_BINDING";
}

export interface TelemetryEvidence {
  telemetryId: string;
  sensorId: string;
  sensorRevision: string;
  timestamp: number;
  value: number;
  unit: string;
  quality: "GOOD" | "BAD" | "UNCERTAIN" | "INTERPOLATED_DATA" | "TELEMETRY_GAP";
  isInterpolated?: boolean;
}

export interface ManufacturingEvidenceBundle {
  bundleId: string;
  jobId: string;
  bundleRevision: number;
  rootEvidenceId: string;
  evidenceIds: string[];
  manifest: BundleManifest;
  bundleHash: string;
  bundleSignature: string;
  createdAt: number;
}

export interface BundleManifest {
  jobId: string;
  evidenceItems: {
    evidenceId: string;
    type: EvidenceType;
    hash: string;
    source: EvidenceSourceType;
    timestamp: number;
    chainSequence: number;
    signatureStatus: SignatureStatus;
    verificationStatus: ManufacturingEvidenceStatus;
  }[];
  manifestHash: string;
}

export interface HardAcceptanceResult112 {
  passed: boolean;
  scorePercentage: number;
  totalChecks: number;
  passedChecks: number;
  verdict: ManufacturingEvidenceStatus;
  timestamp: string;
  details: { checkName: string; status: "PASS" | "FAIL"; evidence: string }[];
}
