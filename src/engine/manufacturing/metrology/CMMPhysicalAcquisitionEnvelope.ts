/**
 * SECP-POST-007 PHASE 3 — WP-PHY-01
 * Canonical Physical Telemetry Envelope for CMM Dimensional Metrology
 * 
 * CORE CONTRACT:
 * Represents the forensic boundary between dimensional measurement equipment
 * and the digital thread. Captures device identity, calibration binding,
 * coordinate frames, raw payload digests, and execution mode (PHYSICAL vs SIMULATOR).
 */

export type HardwareSourceType =
  | "PHYSICAL_CMM_DEVICE"
  | "SIMULATOR_STAND_IN"
  | "OFFLINE_PLAYBACK_FILE";

export type HardwareAcquisitionExecutionStatus =
  | "CAPABILITY_READY_FOR_REAL_HARDWARE"
  | "PHYSICAL_ACQUISITION_EXECUTED";

export interface RawHardwareMeasurementArtifact {
  hardware_manufacturer: string;
  hardware_model: string;
  hardware_serial: string;
  probe_serial: string;
  calibration_certificate_id: string;
  calibration_artifact: {
    laboratory: string;
    certificateHash: string;
    validUntilIso: string;
    uncertaintyK2Mm: number;
  };
  acquisition_timestamp: string;
  hardware_clock: number;
  raw_measurement_payload: string; // Base64 or binary text stream of raw coordinate hits
  payload_sha256: string;
  session_id: string;
  protocol: "I++_DME_V2.1" | "RENISHAW_MODUS" | "ZEISS_UMESS";
  machine_identity: string;
  coordinate_frame: "MACHINE_COORDINATE_SYSTEM_MCS" | "PART_COORDINATE_SYSTEM_PCS";
  units: "MILLIMETERS_CELSIUS_NEWTONS";
  acquisition_log: string[];
  independent_oracle_result?: string;
}

export interface CMMCoordinateTransform {
  sourceFrame: "MACHINE_COORDINATE_SYSTEM_MCS";
  targetFrame: "PART_COORDINATE_SYSTEM_PCS";
  translationMm: { x: number; y: number; z: number };
  rotationMatrix3x3: number[][]; // 3x3 orthogonal rotation matrix
  alignmentDatumFeatureIds: string[]; // e.g. ["DATUM_A", "DATUM_B", "DATUM_C"]
}

export interface CMMDeviceIdentityRecord {
  manufacturer: string;
  model: string;
  deviceSerialNumber: string;
  controllerFirmwareVersion: string;
  hardwareMacOrBusAddress: string;
  cryptographicDeviceCertificate: string; // SIG_HW_<MODEL>_<SERIAL>_<HASH>
}

export interface CMMProbeBindingRecord {
  probeHeadId: string;
  stylusId: string;
  calibratedTipDiameterMm: number;
  qualificationCertificateId: string;
  qualificationTimestampUtc: string;
  qualifiedForDeviceSerial: string; // Must strictly match deviceSerialNumber
}

export interface CMMCalibrationBindingRecord {
  certificateId: string;
  accreditedLaboratory: "DAkkS" | "NIST_ACCREDITED" | "PTB_CAL_SERVICE" | "ISO17025_ACCREDITED";
  boundDeviceSerialNumber: string; // Must strictly match deviceSerialNumber
  issueDateIso: string;
  expirationDateIso: string;
  volumetricAccuracyMpeE_Mm: number; // e.g. 0.0018 mm (1.8 um)
  uncertaintyK2Mm: number;
}

export interface RawCMMTouchPoint {
  sequenceIndex: number;
  clockTickNs: number;
  rawMcsX: number;
  rawMcsY: number;
  rawMcsZ: number;
  approachI: number;
  approachJ: number;
  approachK: number;
  temperatureDegC: number;
  triggerForceMillinewtons: number;
}

export interface CanonicalCMMTelemetryEnvelope {
  envelopeVersion: "1.0-WP-PHY-01";
  hardwareSource: HardwareSourceType;
  readinessStatus: "CAPABILITY_READY_FOR_REAL_HARDWARE";
  executionStatus: HardwareAcquisitionExecutionStatus;
  acquisitionSessionId: string;
  sessionNonce: string;
  deviceIdentity: CMMDeviceIdentityRecord;
  probeBinding: CMMProbeBindingRecord;
  calibrationBinding: CMMCalibrationBindingRecord;
  coordinateTransform: CMMCoordinateTransform;
  acquisitionStartUtc: string;
  acquisitionEndUtc: string;
  rawTouchPoints: RawCMMTouchPoint[];
  rawPayloadSha256Digest: string;
  hardwareSessionSignature: string;
  rawHardwareArtifact?: RawHardwareMeasurementArtifact;
}

export interface CMMEnvelopeValidationResult {
  isValid: boolean;
  sourceClassification: HardwareSourceType;
  eligibleForPhysicalTelemetryTier: boolean;
  rejectionReason?:
    | "SIMULATOR_SOURCE_RESTRICTED"
    | "STALE_REPLAY_DETECTED"
    | "HARDWARE_IDENTITY_MISMATCH"
    | "CALIBRATION_IDENTITY_MISMATCH"
    | "CALIBRATION_EXPIRED"
    | "PROBE_QUALIFICATION_MISMATCH"
    | "ZERO_VARIANCE_FLATLINE"
    | "TAMPERED_PAYLOAD_DIGEST"
    | "UNAUTHENTICATED_HARDWARE_SIGNATURE";
  violations: string[];
  auditDigest: string;
}
