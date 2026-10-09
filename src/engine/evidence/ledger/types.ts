/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-161: Engineering Evidence Ledger Types
 */

export type EvidenceLedgerVerdict =
  | 'VALID'
  | 'INVALID'
  | 'CHAIN_BROKEN'
  | 'REVISION_MISMATCH'
  | 'OBJECT_MISMATCH'
  | 'IDENTITY_MISMATCH'
  | 'UNPROVEN'
  | 'MISSING_PARENT'
  | 'MISSING_EVIDENCE'
  | 'POLICY_VIOLATION';

export type EvidenceState =
  | 'CREATED'
  | 'REGISTERED'
  | 'VERIFIED'
  | 'INVALID'
  | 'SUPERSEDED'
  | 'REVOKED'
  | 'UNPROVEN';

export type ForensicEvidenceType =
  | 'CAD'
  | 'BREP'
  | 'NURBS'
  | 'ASSEMBLY'
  | 'MATERIALS'
  | 'MESH'
  | 'CFD'
  | 'FEM'
  | 'CAM'
  | 'MANUFACTURING'
  | 'DIGITAL_TWIN'
  | 'AI_ENGINEERING'
  | 'VERIFICATION'
  | 'VALIDATION'
  | 'GOVERNANCE'
  | 'CERTIFICATE';

export type EvidenceProducerType =
  | 'HUMAN'
  | 'SERVICE'
  | 'SYSTEM'
  | 'SOLVER'
  | 'VERIFICATION_ENGINE'
  | 'AI_AGENT'
  | 'EXTERNAL_SYSTEM';

export interface PolicyContext {
  readonly policyId?: string;
  readonly policyVersion?: string;
  readonly evaluationVerdict?: string;
  readonly governanceDecisionId?: string;
  readonly evaluatedAt?: string;
}

export interface EngineeringEvidenceRecord {
  readonly evidenceId: string;
  readonly evidenceType: ForensicEvidenceType | string;
  readonly engineeringObjectId: string;
  readonly objectRevision: string;
  readonly projectId: string;
  readonly organizationId: string;
  readonly producerIdentity: string;
  readonly producerType: EvidenceProducerType;
  readonly sourceSystem: string;
  readonly sourceVersion: string;
  readonly inputReferences: readonly string[];
  readonly outputReferences: readonly string[];
  readonly parentEvidence?: string;
  readonly dependencyEvidence: readonly string[];
  readonly payload: Record<string, any>;
  readonly resultHash: string;
  readonly payloadHash: string;
  readonly metadataHash: string;
  readonly timestamp: string;
  readonly eventId?: string;
  readonly correlationId?: string;
  readonly policyContext?: PolicyContext;
  readonly verificationStatus: EvidenceState;
  readonly supersedes?: string;
  readonly supersededBy?: string;
  readonly revocationReason?: string;
}

export interface EvidenceLedgerEntry {
  readonly sequenceNumber: number;
  readonly entryId: string;
  readonly evidenceId: string;
  readonly record: EngineeringEvidenceRecord;
  readonly canonicalRecordHash: string;
  readonly previousEntryHash: string;
  readonly entryHash: string;
  readonly registeredAt: string;
}

export interface EvidenceLineageInfo {
  readonly evidenceId: string;
  readonly parentEvidence?: string;
  readonly childEvidence: readonly string[];
  readonly inputEvidence: readonly string[];
  readonly derivedFrom: readonly string[];
  readonly verifiedBy: readonly string[];
  readonly supersedes?: string;
  readonly supersededBy?: string;
  readonly depth: number;
}

export interface CustodyTransitionRecord {
  readonly custodyId: string;
  readonly who: string;
  readonly what: string;
  readonly when: string;
  readonly whichObject: string;
  readonly whichRevision: string;
  readonly whichEvidence: string;
  readonly whichPolicy?: string;
  readonly whichPreviousState: EvidenceState;
  readonly whichNewState: EvidenceState;
  readonly transitionHash: string;
}

export interface EntryVerificationDetail {
  readonly entryIndex: number;
  readonly evidenceId: string;
  readonly status: EvidenceLedgerVerdict;
  readonly calculatedHash: string;
  readonly expectedHash: string;
  readonly reason?: string;
}

export interface LedgerVerificationReport {
  readonly status: EvidenceLedgerVerdict;
  readonly totalEntries: number;
  readonly verifiedEntries: number;
  readonly genesisValid: boolean;
  readonly chainContinuous: boolean;
  readonly brokenEntryIndex?: number;
  readonly violations: readonly string[];
  readonly entryDetails: readonly EntryVerificationDetail[];
  readonly verifiedAt: string;
}

export interface EvidenceRegistrationParams {
  readonly evidenceType: ForensicEvidenceType | string;
  readonly engineeringObjectId: string;
  readonly objectRevision: string;
  readonly projectId: string;
  readonly organizationId: string;
  readonly producerIdentity: string;
  readonly producerType: EvidenceProducerType;
  readonly sourceSystem: string;
  readonly sourceVersion: string;
  readonly payload: Record<string, any>;
  readonly inputReferences?: readonly string[];
  readonly outputReferences?: readonly string[];
  readonly parentEvidence?: string;
  readonly dependencyEvidence?: readonly string[];
  readonly eventId?: string;
  readonly correlationId?: string;
  readonly policyContext?: PolicyContext;
  readonly supersedes?: string;
}
