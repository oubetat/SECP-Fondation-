/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-165: Manufacturing Certificate Types & Manifest Definitions
 */

import { CryptographicAttestation } from '../attestation/types';

export type ManufacturingCertificationStatus =
  | 'DRAFT'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'CERTIFIED'
  | 'UNPROVEN'
  | 'INVALID'
  | 'REVOKED'
  | 'SUPERSEDED'
  | 'EXPIRED';

export type ManufacturingCertificationLevel =
  | 0 // LEVEL 0 — UNPROVEN
  | 1 // LEVEL 1 — MANUFACTURING DEFINITION VERIFIED
  | 2 // LEVEL 2 — TOOLPATH VERIFIED
  | 3 // LEVEL 3 — G-CODE VERIFIED
  | 4 // LEVEL 4 — MACHINE EXECUTION VERIFIED
  | 5 // LEVEL 5 — INSPECTED
  | 6; // LEVEL 6 — MANUFACTURING CERTIFIED

export type ManufacturingCollisionStatus =
  | 'NO_COLLISION_DETECTED'
  | 'COLLISION_DETECTED'
  | 'INCOMPLETE'
  | 'UNPROVEN';

export type GCodeStatus =
  | 'GCODE_VALID'
  | 'MACHINE_EXECUTION_VERIFIED'
  | 'INVALID'
  | 'UNPROVEN';

export type ToolpathStatus =
  | 'VERIFIED'
  | 'MUTATED'
  | 'UNPROVEN';

export type MachineExecutionStatus =
  | 'VERIFIED'
  | 'FAILED'
  | 'UNPROVEN';

export type InspectionStatus =
  | 'VERIFIED'
  | 'OUT_OF_TOLERANCE'
  | 'FAILED'
  | 'UNPROVEN';

export interface ManufacturingInputManifest {
  readonly manufacturingId: string;
  readonly projectId: string;
  
  readonly design: {
    readonly engineeringObjectId: string;
    readonly objectRevision: string;
    readonly geometryHash: string;
    readonly pmiMetadata: Record<string, any>;
  };
  
  readonly material: {
    readonly materialId: string;
    readonly materialRevision: string;
    readonly materialState: string;
    readonly materialHash: string;
  };
  
  readonly cam: {
    readonly operations: readonly Record<string, any>[];
    readonly strategies: readonly string[];
    readonly cuttingParameters: {
      readonly feeds: readonly number[];
      readonly speeds: readonly number[];
      readonly stepdown: number;
      readonly stepover: number;
      readonly tolerances: Record<string, number>;
    };
    readonly camOperationHash: string;
  };
  
  readonly tooling: {
    readonly toolId: string;
    readonly toolGeometry: Record<string, any>;
    readonly holder: string;
    readonly toolLength: number;
    readonly toolDiameter: number;
    readonly toolLibraryHash: string;
  };
  
  readonly machine: {
    readonly machineId: string;
    readonly machineConfiguration: Record<string, any>;
    readonly axisConfiguration: string;
    readonly kinematicModel: string;
    readonly limits: Record<string, any>;
    readonly machineDefinitionHash: string;
    readonly kinematicsHash: string;
  };
  
  readonly postProcessor: {
    readonly postProcessorId: string;
    readonly version: string;
    readonly configuration: Record<string, any>;
    readonly postProcessorHash: string;
  };
  
  readonly manufacturingDefinitionHash: string;
  readonly inputHash: string;
}

export interface ManufacturingToolpathManifest {
  readonly toolpathId: string;
  readonly manufacturingId: string;
  readonly operations: readonly {
    readonly operationId: string;
    readonly toolId: string;
    readonly machineId: string;
    readonly kinematicsId: string;
    readonly pathSegments: readonly Record<string, any>[];
    readonly toolpathHash: string;
  }[];
  readonly numberOperations: number;
  readonly toolChanges: number;
  readonly rapidMoves: number;
  readonly cuttingMoves: number;
  readonly feedRates: readonly number[];
  readonly spindleSpeeds: readonly number[];
  readonly totalPathLength: number;
  readonly estimatedCycleTime: number; // estimated from CAM, not actual
  readonly manifestHash: string;
}

export interface ManufacturingCollisionVerification {
  readonly collisionVerificationId: string;
  readonly manufacturingId: string;
  readonly status: ManufacturingCollisionStatus;
  readonly checkedItems: {
    readonly toolWorkpiece: boolean;
    readonly holderWorkpiece: boolean;
    readonly toolFixture: boolean;
    readonly machineWorkpiece: boolean;
    readonly machineFixture: boolean;
    readonly axisLimitViolations: boolean;
    readonly kinematicSingularities: boolean;
  };
  readonly evidenceId?: string;
  readonly evidenceHash?: string;
}

export interface GCodeVerificationResult {
  readonly gcodeVerificationId: string;
  readonly manufacturingId: string;
  readonly gcodeHash: string;
  readonly postProcessorId: string;
  readonly isSyntaxValid: boolean;
  readonly checkedItems: {
    readonly syntax: boolean;
    readonly toolCalls: boolean;
    readonly toolNumbers: boolean;
    readonly coordinates: boolean;
    readonly feedRates: boolean;
    readonly spindleCommands: boolean;
    readonly machineLimits: boolean;
    readonly unsupportedCommands: boolean;
    readonly modalState: boolean;
    readonly programStructure: boolean;
    readonly postProcessorMatch: boolean;
  };
  readonly status: GCodeStatus;
  readonly evidenceId?: string;
  readonly evidenceHash?: string;
}

export interface MachineExecutionEvidence {
  readonly executionId: string;
  readonly manufacturingId: string;
  readonly machineId: string;
  readonly machineConfigurationHash: string;
  readonly programHash: string;
  readonly controllerId: string;
  readonly executionStart: string;
  readonly executionEnd: string;
  readonly executionStatus: 'SUCCESS' | 'FAILED' | 'ABORTED';
  readonly telemetry: Record<string, any>;
  readonly alarmEvents: readonly string[];
  readonly toolChanges: number;
  readonly cycleData: {
    readonly actualCycleTime: number; // MUST be measured from real machine
  };
  readonly evidenceHash: string;
}

export interface InspectionMeasurement {
  readonly measurementId: string;
  readonly instrumentId: string;
  readonly measurementValue: number;
  readonly unit: string;
  readonly tolerance: number;
  readonly measuredAt: string;
  readonly measurementHash: string;
  readonly pass: boolean;
}

export interface ManufacturingInspectionEvidence {
  readonly inspectionId: string;
  readonly manufacturingId: string;
  readonly measurements: readonly InspectionMeasurement[];
  readonly inspectionType: 'CMM' | 'LASER_SCAN' | 'PROBE' | 'DIMENSIONAL' | 'GDT' | 'SURFACE' | 'MASS' | 'VISUAL';
  readonly evidenceHash: string;
}

export interface ManufacturingVerificationClaim {
  readonly claimId: string;
  readonly claimType: string;
  readonly description: string;
  readonly passed: boolean;
  readonly evidenceId: string;
}

export interface ManufacturingVerificationMatrix {
  readonly verificationId: string;
  readonly manufacturingId: string;
  readonly claims: readonly ManufacturingVerificationClaim[];
}

export interface ManufacturingCertificate {
  readonly certificateId: string;
  readonly manufacturingId: string;
  readonly projectId: string;

  readonly engineeringObjectId: string;
  readonly designRevisionId: string;
  readonly manufacturingRevisionId: string;

  readonly geometryHash: string;
  readonly designHash: string;
  readonly materialHash: string;
  readonly manufacturingDefinitionHash: string;

  readonly camOperationHash: string;
  readonly toolLibraryHash: string;
  readonly machineDefinitionHash: string;
  readonly kinematicsHash: string;
  readonly toolpathHash: string;
  readonly postProcessorHash: string;
  readonly gcodeHash: string;

  readonly simulationId: string;
  readonly toolpathVerificationId: string;
  readonly gcodeVerificationId: string;
  readonly collisionVerificationId: string;
  readonly inspectionId: string;

  readonly executionId: string;
  readonly evidenceId: string;
  readonly attestationId: string;
  readonly policyId: string;

  readonly toolpathStatus: ToolpathStatus;
  readonly collisionStatus: ManufacturingCollisionStatus;
  readonly gcodeStatus: GCodeStatus;
  readonly machineExecutionStatus: MachineExecutionStatus;
  readonly inspectionStatus: InspectionStatus;

  readonly verificationStatus: boolean;
  readonly validationStatus: boolean;
  readonly certificationStatus: ManufacturingCertificationStatus;

  readonly certificateLevel: ManufacturingCertificationLevel;

  readonly certificateVersion: string;
  readonly issuedAt: string;
  readonly issuer: string;
  readonly signingKeyId: string;
  readonly signature: string;

  // Revocation fields
  readonly revocationReason?: string;
  readonly revokedAt?: string;
  readonly revokedBy?: string;
}

export interface ManufacturingCertificationPolicy {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly minCertificationLevel: ManufacturingCertificationLevel;
  readonly requiredClaims: readonly string[];
  readonly requirePostProcessorMatch?: boolean;
  readonly requireNoCollision?: boolean;
  readonly requireGCodeValidity?: boolean;
  readonly requireRealMachineExecution?: boolean;
  readonly requireInspectionPassed?: boolean;
}

export interface ManufacturingCertificateVerificationResult {
  readonly certificateId: string;
  readonly verdict: ManufacturingCertificationStatus;
  readonly certificateLevel: ManufacturingCertificationLevel;
  readonly integrityVerified: boolean;
  readonly identityVerified: boolean;
  readonly inputVerified: boolean;
  readonly toolpathVerified: boolean;
  readonly gcodeVerified: boolean;
  readonly collisionVerified: boolean;
  readonly executionVerified: boolean;
  readonly inspectionVerified: boolean;
  readonly attestationVerified: boolean;
  readonly provenanceVerified: boolean;
  readonly policyVerified: boolean;
  readonly signatureVerified: boolean | 'UNPROVEN';
  readonly details: readonly string[];
  readonly verifiedAt: string;
}
