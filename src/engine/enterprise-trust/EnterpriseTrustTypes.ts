/**
 * PATCH-SECP-070: Enterprise Trust & Immutable System Provenance Types
 * Defines the core models for industrial trust governance and evidence-based decision making.
 */

export type TrustStatus = 'TRUSTED' | 'CONDITIONALLY_TRUSTED' | 'REVIEW_REQUIRED' | 'UNTRUSTED' | 'REVOKED';

export type TrustSubjectType = 'ENGINEER' | 'ASSET' | 'MACHINE' | 'CAD_MODEL' | 'ASSEMBLY' | 'SIMULATION' | 'JOB' | 'ARTIFACT' | 'MAINTENANCE_RECORD' | 'PRODUCTION_RECORD';

export interface TrustIdentity {
  id: string;
  type: TrustSubjectType;
  displayName: string;
  publicKey?: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface TrustArtifact {
  id: string;
  identityId: string;
  version: string;
  hash: string;
  type: string;
  timestamp: string;
}

export interface TrustAssertion {
  id: string;
  subjectId: string;
  assertionType: string;
  issuerId: string;
  evidenceId: string;
  timestamp: string;
}

export interface TrustEvidence {
  id: string;
  type: string;
  source: string;
  contentHash: string;
  metadata: Record<string, any>;
  timestamp: string;
}

export interface TrustDecision {
  decisionId: string;
  subjectId: string;
  status: TrustStatus;
  reason: string;
  policyVersion: string;
  evidenceIds: string[];
  systemVersion: string;
  timestamp: string;
}

export interface ProvenanceChain {
  chainId: string;
  rootArtifactId: string;
  nodes: {
    artifactId: string;
    transformation: string;
    timestamp: string;
  }[];
}

export interface IntegrityProof {
  proofId: string;
  artifactId: string;
  hash: string;
  signature: string;
  algorithm: string;
  timestamp: string;
}

export interface TrustPackage {
  packageId: string;
  identity: TrustIdentity;
  artifact: TrustArtifact;
  assertions: TrustAssertion[];
  evidence: TrustEvidence[];
  decision: TrustDecision;
  provenance: ProvenanceChain;
  integrityProof: IntegrityProof;
  systemManifest: {
    engineVersion: string;
    policyVersion: string;
    baseline: string;
  };
}
