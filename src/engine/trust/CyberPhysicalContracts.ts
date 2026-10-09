/**
 * SECP Cyber-Physical Integration Specification (CPIS-v1)
 * Authoritative Type Definitions & Hardware Envelope Contracts
 */

export type CyberPhysicalVerificationStatus = 
  | 'PROVEN'
  | 'UNPROVEN'
  | 'NOT_PROVISIONED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REPLAYED'
  | 'TAMPERED';

export type CyberPhysicalProvenance = 
  | 'PRODUCTION_PHYSICAL'
  | 'TEST_EMULATED';

export interface EnvelopeHeader {
  readonly identity: string;
  readonly revision: string;
  readonly timestamp: string;
  readonly parentArtifact: string;
  readonly contentHash: string;
  readonly signature: string;
  readonly authority: string;
  readonly provenance: CyberPhysicalProvenance;
  readonly verificationStatus: CyberPhysicalVerificationStatus;
  readonly testOnlyFlag: boolean;
}

export interface MachineIdentity extends EnvelopeHeader {
  readonly machineId: string;
  readonly manufacturer: string;
  readonly model: string;
  readonly serialNumber: string;
  readonly kinematicConfiguration: '3-AXIS' | '5-AXIS-CONTINUOUS' | 'MILL-TURN';
  readonly controllerType: string;
  readonly enrollmentTimestamp: string;
  readonly securityHardwareId: string;
}

export interface MachineCapability extends EnvelopeHeader {
  readonly capabilityId: string;
  readonly machineId: string;
  readonly maxAxisLimits: { xMm: number; yMm: number; zMm: number; aDeg?: number; cDeg?: number };
  readonly spindleMaxRpm: number;
  readonly positionalAccuracyMm: number;
  readonly repeatabilityMm: number;
  readonly supportedGCodeDialects: readonly string[];
  readonly coolingCapabilities: readonly string[];
}

export interface ManufacturingExecutionEnvelope extends EnvelopeHeader {
  readonly executionId: string;
  readonly machineIdentity: MachineIdentity;
  readonly verifiedGCodeHash: string;
  readonly verifiedToolpathHash: string;
  readonly cncControllerStatus: 'EXECUTED_SUCCESSFULLY' | 'ABORTED' | 'FAULT';
  readonly spindleHoursTotal: number;
  readonly executionStartTime: string;
  readonly executionEndTime: string;
  readonly telemetryFeedDigest: string;
  readonly operatorId: string;
}

export interface PhysicalPartIdentity extends EnvelopeHeader {
  readonly partSerial: string;
  readonly canonicalCadRevision: string;
  readonly bRepHash: string;
  readonly rawMaterialBatchId: string;
  readonly physicalMarkingType: 'LASER_ETCHED_DATAMATRIX' | 'ENGRAVED' | 'RFID';
  readonly markingDigest: string;
}

export interface MeasurementInstrumentIdentity extends EnvelopeHeader {
  readonly instrumentId: string;
  readonly instrumentType: 'CMM_TACTILE' | 'LASER_SCANNER' | 'OPTICAL_COMPARATOR';
  readonly model: string;
  readonly serialNumber: string;
  readonly probeType: string;
  readonly calibrationCertificateId: string;
}

export interface CalibrationIdentity extends EnvelopeHeader {
  readonly calibrationId: string;
  readonly instrumentId: string;
  readonly calibrationAuthority: string;
  readonly calibratedAt: string;
  readonly expiresAt: string;
  readonly uncertaintyBudgetMicrons: number;
  readonly standardReferenceUsed: string;
}

export interface FeatureMeasurementRecord {
  readonly featureId: string;
  readonly featureName: string;
  readonly nominalValueMm: number;
  readonly measuredValueMm: number;
  readonly toleranceUpperMm: number;
  readonly toleranceLowerMm: number;
  readonly deviationMm: number;
  readonly passed: boolean;
}

export interface MeasurementAcquisitionEnvelope extends EnvelopeHeader {
  readonly acquisitionId: string;
  readonly instrumentIdentity: MeasurementInstrumentIdentity;
  readonly calibrationIdentity: CalibrationIdentity;
  readonly physicalPartIdentity: PhysicalPartIdentity;
  readonly featureMeasurements: readonly FeatureMeasurementRecord[];
  readonly rawCloudDigest: string;
  readonly acquiredAt: string;
}

export interface CertificationAuthority extends EnvelopeHeader {
  readonly authorityId: string;
  readonly authorityName: string;
  readonly accreditationStandard: 'ISO_17025' | 'AS9100' | 'NADCAP';
  readonly publicKeyPem: string;
  readonly validUntil: string;
}

export interface ProductionReleaseEnvelope extends EnvelopeHeader {
  readonly releaseId: string;
  readonly physicalPartIdentity: PhysicalPartIdentity;
  readonly manufacturingEnvelope: ManufacturingExecutionEnvelope;
  readonly measurementEnvelope: MeasurementAcquisitionEnvelope;
  readonly certificationAuthorityId: string;
  readonly qualityGateSignature: string;
  readonly releaseStatus: CyberPhysicalVerificationStatus;
}

export interface PhysicalProof extends EnvelopeHeader {
  readonly proofId: string;
  readonly digitalTruthRevision: string;
  readonly physicalSerial: string;
  readonly chainDigest: string;
  readonly cyberPhysicalVerdict: 'PASS' | 'PARTIAL' | 'REJECTED' | 'NOT_PROVISIONED';
  readonly failReason?: string;
}

export * from './CyberPhysicalCanonicalAdapter';
