import { LifecycleState, LifecycleEntityType } from '../lifecycle/types';

export type EvidenceType = 
  | 'DESIGN_EVIDENCE' 
  | 'REVISION_EVIDENCE' 
  | 'CHANGE_EVIDENCE' 
  | 'VARIANT_EVIDENCE' 
  | 'CONFIGURATION_EVIDENCE' 
  | 'BOM_EVIDENCE' 
  | 'ASSEMBLY_EVIDENCE' 
  | 'MANUFACTURING_EVIDENCE' 
  | 'MATERIAL_EVIDENCE' 
  | 'SIMULATION_EVIDENCE' 
  | 'VERIFICATION_EVIDENCE' 
  | 'VALIDATION_EVIDENCE' 
  | 'SERVICE_EVIDENCE' 
  | 'COMPLIANCE_EVIDENCE' 
  | 'APPROVAL_EVIDENCE' 
  | 'LIFECYCLE_EVIDENCE';

export type EvidenceStatus = 
  | 'DRAFT' 
  | 'GENERATED' 
  | 'VERIFIED' 
  | 'REJECTED' 
  | 'SUPERSEDED' 
  | 'EXPIRED' 
  | 'REVOKED' 
  | 'ARCHIVED';

export type EvidenceScope = 
  | 'ENTITY' 
  | 'REVISION' 
  | 'VARIANT' 
  | 'CONFIGURATION' 
  | 'ASSEMBLY' 
  | 'BOM' 
  | 'MANUFACTURING_INSTANCE' 
  | 'LIFECYCLE' 
  | 'PROJECT' 
  | 'PRODUCT_FAMILY' 
  | 'ENTERPRISE';

export type EvidenceLinkType = 
  | 'DERIVED_FROM' 
  | 'SUPPORTS' 
  | 'VERIFIES' 
  | 'VALIDATES' 
  | 'AFFECTS' 
  | 'SUPERSEDES' 
  | 'REPLACES' 
  | 'GENERATED_BY' 
  | 'APPROVED_BY' 
  | 'CONSUMED_BY';

export type EvidenceVerdict = 
  | 'VALID' 
  | 'INVALID' 
  | 'INCOMPLETE' 
  | 'CORRUPTED' 
  | 'STALE' 
  | 'SUPERSEDED' 
  | 'UNVERIFIED' 
  | 'DEPENDENCY_FAILURE' 
  | 'PROVENANCE_FAILURE';

export interface EnterpriseEvidence {
  evidenceId: string;
  evidenceType: EvidenceType;
  subjectId: string;
  subjectType: string;
  subjectVersion: string;
  subjectHash: string;
  scope: EvidenceScope;
  status: EvidenceStatus;
  createdAt: string;
  createdBy: string;
  sourceSystem: string;
  sourceVersion: string;
  contentHash: string;
  evidenceHash: string;
  metadata: Record<string, any>;
}

export interface EvidenceProvenance {
  source: string;
  sourceType: string;
  sourceVersion: string;
  generator: string;
  generatorVersion: string;
  actor: string;
  timestamp: string;
  inputHashes: string[];
  outputHash: string;
  method: string;
  algorithm: string;
  environment: {
    os: string;
    runtime: string;
    compiler?: string;
    solverVersion?: string;
    configHash?: string;
  };
}

export interface EvidenceLink {
  linkId: string;
  sourceEvidenceId: string;
  targetEvidenceId: string;
  relationship: EvidenceLinkType;
  reason: string;
  actor: string;
  timestamp: string;
  linkHash: string;
}

export interface EvidenceManifest {
  manifestId: string;
  subject: { id: string; type: string; version: string; hash: string };
  evidenceItems: string[]; // Evidence IDs
  dependencies: string[]; // Manifest IDs or Evidence IDs
  sourceVersions: Record<string, string>;
  generatedAt: string;
  manifestHash: string;
}

export interface EnterpriseEvidenceBundle {
  bundleId: string;
  bundleVersion: string;
  bundleHash: string;
  subjectHash: string;
  evidenceItems: EnterpriseEvidence[];
  links: EvidenceLink[];
  provenance: EvidenceProvenance;
  generatedAt: string;
}

export interface EvidenceSnapshot {
  rootHash: string;
  manifestHash: string;
  timestamp: string;
  hashes: Record<string, string>; // subjectType -> hash
}
