export enum ConfigurationStatus {
  DRAFT = 'DRAFT',
  PROPOSED = 'PROPOSED',
  ANALYZED = 'ANALYZED',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  SUPERSEDED = 'SUPERSEDED',
  DEPRECATED = 'DEPRECATED',
  INVALIDATED = 'INVALIDATED',
  REASSESSMENT_REQUIRED = 'REASSESSMENT_REQUIRED'
}

export enum ConfigurationChangeType {
  CRITICAL = 'CRITICAL',
  MAJOR = 'MAJOR',
  MINOR = 'MINOR'
}

export interface Provenance {
  originHash: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigurationItem {
  id: string; // CI ID
  identity: string; // Part number or logical identity
  type: string; // e.g., 'HARDWARE', 'SOFTWARE', 'INTERFACE', 'MECHANICAL'
  canonicalEntityRef: string; // The underlying component/element ID in P3, P10, etc.
  revisionRef: string; // Bound to Revision ID in RevisionEngine
  configurationRef: string; // Parent Configuration ID
  lifecycleState: ConfigurationStatus;
  applicability: string; // Serial range, mission profile, or condition
  dependencies: string[]; // List of other ConfigurationItem IDs
  supersession?: string; // ID of the ConfigurationItem superseding this one
  provenance: Provenance;
  verificationState: 'UNPROVEN' | 'VERIFIED' | 'FAILED' | 'REASSESSMENT_REQUIRED';
  evidenceRefs: string[]; // Linked physical measurements/findings/reports
}

export interface Configuration {
  configurationId: string;
  name: string;
  variantId: string;
  status: ConfigurationStatus;
  items: ConfigurationItem[];
  provenance: Provenance;
  revisionId: string; // Bound to RevisionEngine state
}

export interface ConfigurationRelationship {
  id: string;
  sourceItemId: string;
  targetItemId: string;
  relationshipType: 'CONFIGURES' | 'CONTAINS' | 'DEPENDS_ON' | 'APPLIES_TO' | 'SUPERSEDES' | 'DERIVED_FROM' | 'AFFECTS' | 'VERIFIED_BY' | 'SUPPORTED_BY' | 'INVALIDATES';
  configurationId: string;
}

export interface ConfigurationBaseline {
  baselineId: string;
  title: string;
  configurationId: string;
  configurationItems: ConfigurationItem[];
  relationships: ConfigurationRelationship[];
  dependencies: ConfigurationDependency[];
  applicability: ConfigurationApplicability;
  status: ConfigurationStatus;
  evidenceRootHash: string; // Merkle hash of all evidence references
  provenance: Provenance;
  revisionId: string;
}

export interface ConfigurationApplicability {
  applicabilityId: string;
  targetId: string; // Configuration or Item ID
  serialNumberMin?: number;
  serialNumberMax?: number;
  missionProfile?: string; // e.g. 'MILITARY_TACTICAL', 'COMMERCIAL_PASSENGER'
  environmentalBounds?: { minTemp: number; maxTemp: number };
  provenance: Provenance;
}

export interface ConfigurationVariant {
  variantId: string;
  familyId: string;
  name: string;
  allowedConfigurations: string[]; // List of configurationIds
  constraints: string[]; // Constraint rules
  provenance: Provenance;
}

export interface ConfigurationChangeRequest {
  requestId: string;
  title: string;
  description: string;
  changeType: ConfigurationChangeType;
  proposedBy: string;
  affectedItemIds: string[];
  status: 'DRAFT' | 'SUBMITTED' | 'ANALYZED' | 'APPROVED' | 'REJECTED' | 'IMPLEMENTED';
  provenance: Provenance;
}

export interface ConfigurationChange {
  changeId: string;
  requestId: string;
  affectedItemIds: string[];
  dependencyImpactCount: number;
  revisionImpactCount: number;
  verificationImpactCount: number;
  evidenceImpactCount: number;
  status: 'PROPOSED' | 'IMPLEMENTED' | 'REVERIFIED';
  baselineBeforeId?: string;
  baselineAfterId?: string;
  provenance: Provenance;
}

export interface ConfigurationRelease {
  releaseId: string;
  baselineId: string;
  releaseVersion: string;
  status: 'PROPOSED' | 'RELEASED' | 'WITHDRAWN';
  governanceSignature?: string;
  releasedBy?: string;
  releasedAt?: string;
  provenance: Provenance;
}

export interface ConfigurationAudit {
  auditId: string;
  baselineId: string;
  auditorId: string;
  timestamp: string;
  findings: string[];
  isPassed: boolean;
  provenance: Provenance;
}

export interface ConfigurationDependency {
  dependencyId: string;
  sourceId: string; // Item or Config ID
  targetId: string; // Item or Config ID
  dependencyType: 'MECHANICAL' | 'SYSTEM' | 'REQUIREMENT' | 'INTERFACE' | 'SIMULATION' | 'MANUFACTURING' | 'METROLOGY' | 'SAFETY';
  isCritical: boolean;
  provenance: Provenance;
}

export interface ConfigurationManifest {
  manifestId: string;
  baselineId: string;
  merkleRootHash: string;
  itemsCount: number;
  relationshipsCount: number;
  dependenciesCount: number;
  provenance: Provenance;
}

export interface ConfigurationSnapshot {
  timestamp: string;
  merkleRootHash: string;
  authority: string;
  configurations: Configuration[];
  baselines: ConfigurationBaseline[];
  applicabilities: ConfigurationApplicability[];
  variants: ConfigurationVariant[];
  relationships: ConfigurationRelationship[];
  dependencies: ConfigurationDependency[];
  releases: ConfigurationRelease[];
  audits: ConfigurationAudit[];
  changeRequests: ConfigurationChangeRequest[];
  changes: ConfigurationChange[];
  manifests: ConfigurationManifest[];
}
