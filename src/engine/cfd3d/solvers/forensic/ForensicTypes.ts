/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-073: Forensic CFD Evidence Types & Data Models
 */

export type ArtifactStatus = 'ORIGINAL' | 'DERIVED' | 'RECOMPUTED' | 'INTERPRETED' | 'STALE' | 'TAMPERED';

export interface ArtifactRecord {
  readonly artifactId: string;
  readonly type: string;
  readonly pathOrRef: string;
  readonly sizeBytes: number;
  readonly hash: string;
  readonly hashAlgorithm: 'SHA-256' | 'SHA-512';
  readonly createdAt: string;
  readonly modifiedAt: string;
  readonly capturedAt: string;
  readonly producer: string;
  readonly producerVersion: string;
  readonly parentArtifactIds: readonly string[];
  readonly status: ArtifactStatus;
  readonly payload?: unknown;
}

export type CustodyAction =
  | 'CAPTURED'
  | 'COPIED'
  | 'IMPORTED'
  | 'EXPORTED'
  | 'ANALYZED'
  | 'VERIFIED'
  | 'ARCHIVED'
  | 'RELEASED'
  | 'SUPERSEDED';

export interface EvidenceCustodyRecord {
  readonly evidenceId: string;
  readonly custodyEventId: string;
  readonly actor: string;
  readonly action: CustodyAction;
  readonly timestamp: string;
  readonly source: string;
  readonly destination: string;
  readonly previousHash: string;
  readonly newHash: string;
  readonly reason: string;
  readonly authorization: string;
  readonly signature: string;
  readonly resultingArtifactId: string;
}

export interface EvidenceSnapshot {
  readonly snapshotId: string;
  readonly timestamp: string;
  readonly artifactHashes: Readonly<Record<string, string>>;
  readonly environmentHash: string;
  readonly configurationHash: string;
  readonly processIdentity: string;
  readonly runIdentity: string;
  readonly parentSnapshotHash?: string;
  readonly snapshotRootHash: string;
}

export interface ForensicCaseManifest {
  readonly forensicCaseId: string;
  readonly cfdCaseId: string;
  readonly runId: string;
  readonly solverRunId: string;
  readonly verificationRunId: string;
  readonly validationRunId: string;
  readonly geometryId: string;
  readonly meshId: string;
  readonly physicsId: string;
  readonly resultId: string;
  readonly evidenceVersion: string;
  readonly schemaVersion: string;
  readonly softwareVersion: string;
  readonly platform: string;
  readonly timestamp: string;
  readonly parentEvidenceId?: string;
  readonly rootEvidenceHash: string;
}

export interface ForensicProvenanceNode {
  readonly id: string;
  readonly type: 'Artifact' | 'Run' | 'Process' | 'Tool' | 'Configuration' | 'Evidence' | 'Transformation' | 'Verification' | 'Validation' | 'Actor' | 'Environment';
  readonly label: string;
  readonly hash?: string;
}

export interface ForensicProvenanceEdge {
  readonly fromId: string;
  readonly toId: string;
  readonly relation: 'PRODUCED' | 'DERIVED_FROM' | 'USED_BY' | 'VERIFIED_BY' | 'VALIDATED_BY' | 'COPIED_FROM' | 'TRANSFORMED_BY' | 'SUPERSEDES' | 'REFERENCES' | 'CAPTURED_DURING';
}

export interface ForensicProvenanceGraph {
  readonly nodes: readonly ForensicProvenanceNode[];
  readonly edges: readonly ForensicProvenanceEdge[];
}

export interface TimelineEvent {
  readonly eventId: string;
  readonly runId: string;
  readonly artifactId?: string;
  readonly eventName: string;
  readonly timestamp: string;
  readonly epochMs: number;
}

export type ForensicSeverity = 'INFO' | 'MINOR' | 'WARNING' | 'MATERIAL' | 'CRITICAL' | 'TAMPER';

export interface ForensicIncident {
  readonly incidentId: string;
  readonly caseId: string;
  readonly evidenceId: string;
  readonly category: string;
  readonly severity: ForensicSeverity;
  readonly detectedAt: string;
  readonly expected: string;
  readonly observed: string;
  readonly affectedArtifacts: readonly string[];
  readonly hashes: Readonly<Record<string, string>>;
  readonly provenanceChain: readonly string[];
  readonly reproductionNotes: string;
  readonly status: 'DETECTED' | 'PRESERVED' | 'ANALYZED' | 'CORRELATED' | 'REPRODUCED' | 'CLASSIFIED' | 'RESOLVED' | 'UNRESOLVED';
}

export interface MerkleInclusionProof {
  readonly leafHash: string;
  readonly index: number;
  readonly auditPath: readonly { position: 'left' | 'right'; hash: string }[];
  readonly rootHash: string;
}

export interface ForensicEvidenceSignature {
  readonly evidenceRootHash: string;
  readonly signerId: string;
  readonly algorithm: 'ECDSA-SHA256' | 'RSA-PSS-SHA256' | 'ED25519';
  readonly signature: string;
  readonly timestamp: string;
  readonly keyId: string;
}

export type ForensicVerdict = 'FORENSIC_VERIFIED' | 'FORENSIC_FAILED' | 'FORENSIC_INCONCLUSIVE';

export interface ForensicCFDReport {
  readonly caseIdentity: ForensicCaseManifest;
  readonly rootHash: string;
  readonly artifactCount: number;
  readonly custodyChainIntact: boolean;
  readonly timelineConsistent: boolean;
  readonly incidents: readonly ForensicIncident[];
  readonly crossChecksConsistent: boolean;
  readonly replayMatch: boolean;
  readonly signatureValid: boolean;
  readonly verdict: ForensicVerdict;
}
