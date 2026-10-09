/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-164: Simulation Certificate Types & Manifest Definitions
 */

import { CryptographicAttestation, SigningKeyPair } from '../attestation/types';

export type SimulationCertificationStatus =
  | 'DRAFT'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'CERTIFIED'
  | 'UNPROVEN'
  | 'INVALID'
  | 'REJECTED'
  | 'SUPERSEDED'
  | 'OUTDATED';

export type SimulationCertificationLevel =
  | 0 // LEVEL 0 — UNPROVEN
  | 1 // LEVEL 1 — EXECUTION VERIFIED
  | 2 // LEVEL 2 — NUMERICALLY VERIFIED
  | 3 // LEVEL 3 — ENGINEERING VERIFIED
  | 4 // LEVEL 4 — VALIDATED
  | 5; // LEVEL 5 — CERTIFIED

export type SimulationConvergenceStatus =
  | 'CONVERGED'
  | 'NOT_CONVERGED'
  | 'FAILED'
  | 'ABORTED'
  | 'INVALID'
  | 'UNKNOWN';

export type SimulationConservationStatus =
  | 'CONSERVED'
  | 'NOT_CONSERVED'
  | 'UNPROVEN';

export type SimulationStabilityStatus =
  | 'STABLE'
  | 'UNSTABLE'
  | 'UNPROVEN';

export type SimulationVerificationStatus =
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'UNPROVEN';

export type SimulationValidationStatus =
  | 'VALIDATED'
  | 'VALIDATION_UNPROVEN';

export interface SimulationInputManifest {
  readonly simulationId: string;
  readonly simulationType: 'CFD' | 'FEM';
  readonly projectId: string;
  readonly engineeringObjectId: string;
  readonly objectRevision: string;
  
  readonly modelHash: string;
  readonly geometryHash: string;
  readonly meshHash: string;
  readonly materialHash: string;
  readonly boundaryConditionHash: string;
  readonly initialConditionHash: string;
  readonly solverConfigurationHash: string;
  
  // Custom inputs according to type (Section 4)
  readonly cfdParameters?: {
    readonly fluid: string;
    readonly density: number;
    readonly viscosity: number;
    readonly boundaryConditions: Record<string, any>;
    readonly initialConditions: Record<string, any>;
    readonly solverSettings: Record<string, any>;
    readonly timeStep: number;
    readonly convergenceCriteria: Record<string, any>;
    readonly turbulenceModel: string;
    readonly numericalSchemes: Record<string, any>;
  };
  
  readonly femParameters?: {
    readonly material: string;
    readonly youngsModulus: number;
    readonly poissonRatio: number;
    readonly density: number;
    readonly loads: Record<string, any>;
    readonly boundaryConditions: Record<string, any>;
    readonly constraints: Record<string, any>;
    readonly solverConfiguration: Record<string, any>;
    readonly convergenceCriteria: Record<string, any>;
  };
  
  readonly inputHash: string;
}

export interface SimulationExecutionManifest {
  readonly executionId: string;
  readonly simulationId: string;
  readonly solverIdentity: string;
  readonly solverVersion: string;
  readonly runtime: string;
  readonly platform: string;
  readonly configuration: Record<string, any>;
  readonly startTime: string;
  readonly endTime: string;
  readonly iterationCount: number;
  readonly terminationReason: SimulationConvergenceStatus;
}

export interface SimulationResultManifest {
  readonly resultId: string;
  readonly resultHash: string;
  readonly fieldHashes: Record<string, string>;
  readonly scalarResults: Record<string, number>;
  readonly vectorResults?: Record<string, readonly number[]>;
  readonly iterationData?: readonly Record<string, any>[];
  readonly residualHistory?: readonly Record<string, number>[];
  readonly conservationMetrics?: {
    readonly massError?: number;
    readonly momentumError?: number;
    readonly energyError?: number;
    readonly isConserved: boolean;
  };
  readonly convergenceMetrics?: {
    readonly isConverged: boolean;
    readonly residualTolerance: number;
    readonly finalResiduals: Record<string, number>;
  };
  readonly solverTerminationState: string;
}

export interface VerificationClaim {
  readonly claimId: string;
  readonly claimType: string;
  readonly description: string;
  readonly passed: boolean;
  readonly evidenceReference: string; // must point to a specific evidence component (Section 10)
}

export interface SimulationVerificationMatrix {
  readonly verificationId: string;
  readonly simulationId: string;
  readonly resultId: string;
  readonly claims: readonly VerificationClaim[];
}

export interface SimulationCertificate {
  readonly certificateId: string;
  readonly simulationId: string;
  readonly simulationType: 'CFD' | 'FEM';
  readonly projectId: string;
  readonly engineeringObjectId: string;
  readonly objectRevision: string;

  readonly modelHash: string;
  readonly geometryHash: string;
  readonly meshHash: string;
  readonly materialHash: string;
  readonly boundaryConditionHash: string;
  readonly initialConditionHash: string;
  readonly solverConfigurationHash: string;
  readonly inputHash: string;

  readonly solverIdentity: string;
  readonly solverVersion: string;
  readonly executionId: string;
  readonly runtimeEnvironment: {
    readonly platform: string;
    readonly runtime: string;
    readonly configuration: Record<string, any>;
  };

  readonly resultId: string;
  readonly resultHash: string;
  readonly verificationId: string;
  readonly evidenceId: string;
  readonly attestationId: string;
  readonly policyId: string;

  readonly convergenceStatus: SimulationConvergenceStatus;
  readonly conservationStatus: SimulationConservationStatus;
  readonly stabilityStatus: SimulationStabilityStatus;
  readonly verificationStatus: SimulationVerificationStatus;
  readonly validationStatus: SimulationValidationStatus;

  readonly certificationStatus: SimulationCertificationStatus;
  readonly certificationLevel: SimulationCertificationLevel;

  readonly issuedAt: string;
  readonly certificateVersion: string;
  readonly issuer: string;
  readonly signature: string;
  readonly signingKeyId: string;
  
  // Revocation fields
  readonly revocationReason?: string;
  readonly revokedAt?: string;
  readonly revokedBy?: string;
}

export interface SimulationCertificationPolicy {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly requiredClaims: readonly string[];
  readonly minCertificationLevel: SimulationCertificationLevel;
  readonly requiredSolverIdentity?: string;
  readonly requiredSolverVersion?: string;
  readonly requireConvergence?: boolean;
  readonly requireConservation?: boolean;
  readonly requireStability?: boolean;
}

export interface SimulationCertificateVerificationResult {
  readonly certificateId: string;
  readonly verdict: SimulationCertificationStatus;
  readonly certificationLevel: SimulationCertificationLevel;
  readonly integrityVerified: boolean;
  readonly identityVerified: boolean;
  readonly inputVerified: boolean;
  readonly executionVerified: boolean;
  readonly resultVerified: boolean;
  readonly evidenceVerified: boolean;
  readonly attestationVerified: boolean;
  readonly policyVerified?: boolean;
  readonly signatureVerified: boolean | 'UNPROVEN';
  readonly details: readonly string[];
  readonly verifiedAt: string;
}
