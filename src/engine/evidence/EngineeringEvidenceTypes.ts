/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-011: Unified Engineering Evidence Object Model Types
 */

import { EngineeringIdentity } from '../identity/CanonicalEngineeringIdentity';

export interface EvidenceSignature {
  readonly signature: string;
  readonly algorithm: string;
  readonly publicKeyId: string;
  readonly signedAt: string;
}

export type EngineeringEvidenceType =
  | 'DESIGN'
  | 'GEOMETRY'
  | 'SIMULATION'
  | 'RESULT'
  | 'VERIFICATION'
  | 'VALIDATION'
  | 'MANUFACTURING'
  | 'INSPECTION'
  | 'PROVENANCE'
  | 'OTHER';

export const VALID_EVIDENCE_TYPES: readonly EngineeringEvidenceType[] = Object.freeze([
  'DESIGN',
  'GEOMETRY',
  'SIMULATION',
  'RESULT',
  'VERIFICATION',
  'VALIDATION',
  'MANUFACTURING',
  'INSPECTION',
  'PROVENANCE',
  'OTHER'
]);

export interface EvidenceSubject {
  readonly identityId: string;
  readonly identityType: string;
  readonly revision?: string;
  readonly name?: string;
  readonly description?: string;
}

export interface EvidenceArtifactReference {
  readonly artifactId: string;
  readonly artifactType: string;
  readonly canonicalHash: string;
  readonly identityHash?: string;
  readonly version?: string;
}

export type EvidenceProducerType =
  | 'ENGINE'
  | 'SOLVER'
  | 'VERIFIER'
  | 'HUMAN'
  | 'EXTERNAL_SYSTEM'
  | 'UNKNOWN';

export interface EvidenceProvenance {
  readonly producer: {
    readonly type: EvidenceProducerType;
    readonly id: string;
    readonly version?: string;
  };
  readonly runtime?: {
    readonly environment?: string;
    readonly runtimeVersion?: string;
    readonly platform?: string;
  };
  readonly source?: {
    readonly system?: string;
    readonly organization?: string;
  };
}

export interface EvidenceComputation {
  readonly computationId: string;
  readonly engineId: string;
  readonly engineVersion?: string;
  readonly executionId?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly parametersHash?: string;
  readonly inputHash?: string;
  readonly outputHash?: string;
  readonly deterministic?: boolean;
}

export interface EvidenceDependency {
  readonly dependencyId: string;
  readonly artifactId: string;
  readonly artifactType: string;
  readonly canonicalHash: string;
  readonly required: boolean;
}

export interface EvidenceCanonicalization {
  readonly serializer: string;
  readonly version: string;
  readonly canonicalHash: string;
}

export type EvidenceIntegrityStatus = 'INTACT' | 'TAMPERED' | 'UNPROVEN';

export interface EvidenceIntegrity {
  readonly hashAlgorithm: string;
  readonly canonicalHash: string;
  readonly chainHash?: string;
  readonly previousChainHash?: string | null;
  readonly integrityStatus: EvidenceIntegrityStatus;
}

export type EvidenceVerificationVerdict =
  | 'PASS'
  | 'FAIL'
  | 'UNPROVEN'
  | 'INCONCLUSIVE'
  | 'INVALID'
  | 'NOT_CONVERGED';

export interface EvidenceCheck {
  readonly checkId: string;
  readonly name: string;
  readonly status: 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE' | 'INVALID';
  readonly details?: string;
}

export interface EvidenceVerificationStatus {
  readonly verdict: EvidenceVerificationVerdict;
  readonly verifierId?: string;
  readonly verifierVersion?: string;
  readonly verifiedAt?: string;
  readonly verificationEvidenceId?: string;
  readonly reason?: string;
  readonly checks?: readonly EvidenceCheck[];
}

export type EvidenceClaimType =
  | 'INTEGRITY'
  | 'IDENTITY'
  | 'NUMERICAL'
  | 'PHYSICAL'
  | 'GEOMETRIC'
  | 'MANUFACTURING'
  | 'PROVENANCE'
  | 'VALIDATION';

export interface EvidenceClaim {
  readonly claimId: string;
  readonly statement: string;
  readonly claimType: EvidenceClaimType;
  readonly supportedBy: readonly string[];
  readonly confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
}

export interface EvidenceLineage {
  readonly chainId: string;
  readonly stage:
    | 'DESIGN'
    | 'GEOMETRY'
    | 'SIMULATION'
    | 'RESULT'
    | 'VERIFICATION'
    | 'MANUFACTURING';
  readonly nodeHash: string;
  readonly previousNodeHash?: string | null;
  readonly upstreamEvidenceIds?: readonly string[];
  readonly downstreamEvidenceIds?: readonly string[];
}

/**
 * Unified Engineering Evidence Object.
 * Represents historical proof of an engineering event or state.
 */
export interface EngineeringEvidence {
  readonly evidenceId: string;
  readonly evidenceType: EngineeringEvidenceType;
  readonly schemaVersion: string;
  readonly subject: EvidenceSubject;
  readonly artifact: EvidenceArtifactReference;
  readonly provenance: EvidenceProvenance;
  readonly computation?: EvidenceComputation;
  readonly inputs?: readonly EvidenceDependency[];
  readonly canonicalization: EvidenceCanonicalization;
  readonly integrity: EvidenceIntegrity;
  readonly verification: EvidenceVerificationStatus;
  readonly claims: readonly EvidenceClaim[];
  readonly lineage?: EvidenceLineage;
  readonly signature?: EvidenceSignature;
  readonly createdAt: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export const ENGINEERING_EVIDENCE_SCHEMA_VERSION = '1.0.0';

export interface EvidenceValidationResult {
  readonly valid: boolean;
  readonly errors: readonly EvidenceValidationError[];
  readonly warnings: readonly EvidenceValidationWarning[];
}

export interface EvidenceValidationError {
  readonly code:
    | 'INVALID_SCHEMA'
    | 'MISSING_IDENTITY'
    | 'MISSING_ARTIFACT'
    | 'INVALID_HASH'
    | 'INVALID_LINEAGE'
    | 'INVALID_VERDICT'
    | 'MISSING_PROVENANCE'
    | 'CANONICALIZATION_MISMATCH'
    | 'CHAIN_REFERENCE_INVALID'
    | 'MISSING_FIELD'
    | 'INVALID_TYPE';
  readonly message: string;
  readonly path?: string;
}

export interface EvidenceValidationWarning {
  readonly code: string;
  readonly message: string;
}

export interface EngineeringEvidenceVerificationResult {
  readonly valid: boolean;
  readonly verdict: EvidenceVerificationVerdict;
  readonly evidenceId: string;
  readonly checks: readonly EvidenceCheck[];
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}
