/**
 * SECP — ADSE-P5 Structural Integration & Engineering Assembly Truth Types
 * Advanced Aerospace & Defense Systems Engineering (ADSE)
 * 
 * Governing Architectural Principle:
 * «Structural Integration does not create a second representation of the engineered system;
 * it establishes the authoritative, verifiable relationships that define how canonical engineering
 * elements form a coherent integrated system.»
 */

import { CoreBindingState } from '../p2/types';

export type StructuralLayer = 
  | 'SYSTEM'
  | 'SUBSYSTEM'
  | 'ASSEMBLY'
  | 'SUBASSEMBLY'
  | 'COMPONENT'
  | 'PART'
  | 'STRUCTURAL_ELEMENT';

export type StructuralElementType = 
  | 'System'
  | 'Subsystem'
  | 'AssemblyDefinition'
  | 'AssemblyInstance'
  | 'ComponentDefinition'
  | 'ComponentInstance'
  | 'PartDefinition'
  | 'PartInstance'
  | 'StructuralElement'
  | 'StructuralInterface'
  | 'StructuralBoundary';

export type StructuralRelationshipType = 
  | 'CONTAINS'
  | 'INSTANCE_OF'
  | 'CONNECTED_TO'
  | 'MATED_TO'
  | 'CONSTRAINED_BY'
  | 'LOCATED_AT'
  | 'ALIGNED_WITH'
  | 'SUPPORTED_BY'
  | 'DEPENDS_ON'
  | 'INTERFACES_WITH'
  | 'ATTACHED_TO'
  | 'TRANSFERRED_TO'
  | 'BOUNDED_BY'
  | 'VERIFIED_BY'
  | 'SUPPORTED_BY_EVIDENCE';

export type StructuralConstraintType = 
  | 'Coincident'
  | 'Concentric'
  | 'Parallel'
  | 'Perpendicular'
  | 'Distance'
  | 'Angle'
  | 'Tangent'
  | 'Fixed'
  | 'Rigid'
  | 'Reference';

export interface StructuralTransform {
  translation: { x: number; y: number; z: number };
  rotation: { rx: number; ry: number; rz: number };
  coordinateFrame: string;
  referenceFrame: string;
  transformRevision: string;
  configurationId: string;
  provenanceId: string;
  isCanonical: boolean;
}

export interface StructuralPlacement {
  instanceId: string;
  transform: StructuralTransform;
  referenceFrameId: string;
  configurationId: string;
  revisionId: string;
  provenanceId: string;
}

export interface StructuralElement {
  elementId: string; // e.g. 'struct:part:inst:BOLT-001-INST-1'
  elementType: StructuralElementType;
  displayName: string;
  layer: StructuralLayer;
  configurationId: string;
  revisionId: string;
  revisionHash: string;
  provenanceId: string;
  coreBindingState: CoreBindingState;
  definitionId?: string; // Links instance to authoritative definition
  engineeringObjectId?: string; // SECP Core identity
  p3ArchId?: string; // Upstream P3 Architecture link
  p2MbseId?: string; // Upstream P2 MBSE link
  p1ReqId?: string;  // Upstream P1 Requirement link
  p4NodeId?: string; // P4 Digital Thread Node link
  metadata: Record<string, any>;
  createdAt: string;
}

export interface StructuralRelationship {
  relationshipId: string;
  relationshipType: StructuralRelationshipType;
  sourceElementId: string;
  targetElementId: string;
  configurationId: string;
  revisionId: string;
  provenanceId: string;
  isVerified: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface StructuralConstraint {
  constraintId: string;
  constraintType: StructuralConstraintType;
  displayName: string;
  sourceElementId: string;
  targetElementId: string;
  parameters: Record<string, any>;
  configurationId: string;
  revisionId: string;
  provenanceId: string;
  status: 'VALID' | 'CONTRADICTORY' | 'UNDER_CONSTRAINED' | 'OVER_CONSTRAINED' | 'DANGLING' | 'STALE';
  verifiedByIntentId?: string;
  evidenceId?: string;
}

export interface StructuralInterface {
  interfaceId: string;
  displayName: string;
  p3InterfaceId?: string;
  providerElementId: string;
  consumerElementId: string;
  requiredInterfaceType: string;
  providedInterfaceType: string;
  isConnected: boolean;
  connectionId?: string;
  configurationId: string;
  revisionId: string;
  provenanceId: string;
  isCompatible: boolean;
}

export interface StructuralConnection {
  connectionId: string;
  displayName: string;
  structuralInterfaceId: string;
  sourcePartId: string;
  targetPartId: string;
  connectionMethod: string; // e.g., 'BOLTED_JOINT', 'WELD', 'CONNECTOR'
  configurationId: string;
  revisionId: string;
  provenanceId: string;
  verifiedByIntentId?: string;
  evidenceId?: string;
}

export type StructuralFindingCategory = 
  | 'ORPHAN_STRUCTURAL_ELEMENT'
  | 'DUPLICATE_STRUCTURAL_IDENTITY'
  | 'INVALID_CONTAINMENT'
  | 'CYCLIC_CONTAINMENT'
  | 'BROKEN_STRUCTURAL_LINK'
  | 'CROSS_REVISION_CONTAMINATION'
  | 'CROSS_CONFIGURATION_CONTAMINATION'
  | 'INVALID_TRANSFORM'
  | 'CONSTRAINT_CONFLICT'
  | 'DANGLING_CONSTRAINT'
  | 'INTERFACE_WITHOUT_CONNECTION'
  | 'CONNECTION_WITHOUT_INTERFACE'
  | 'MISSING_TRACEABILITY'
  | 'MISSING_VERIFICATION'
  | 'MISSING_EVIDENCE'
  | 'INVALID_PROVENANCE'
  | 'UNAUTHORIZED_CANONICAL_BINDING';

export interface StructuralIntegrationFinding {
  findingId: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  category: StructuralFindingCategory;
  elementId?: string;
  relationshipId?: string;
  constraintId?: string;
  interfaceId?: string;
  reason: string;
  revisionId: string;
  configurationId: string;
  provenanceId: string;
}

export interface StructuralConsistencyReport {
  timestamp: string;
  configurationId: string;
  revisionId: string;
  totalElements: number;
  totalRelationships: number;
  totalConstraints: number;
  totalInterfaces: number;
  totalFindings: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  findings: StructuralIntegrationFinding[];
  isConsistent: boolean;
  merkleRoot: string;
}

export interface StructuralImpactReport {
  changedElementId: string;
  affectedRequirements: string[];
  affectedMbseElements: string[];
  affectedArchitecture: string[];
  affectedStructuralElements: string[];
  affectedInterfaces: string[];
  affectedConstraints: string[];
  affectedPlacements: string[];
  affectedVerifications: string[];
  affectedEvidences: string[];
  affectedPublications: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface StructuralSnapshot {
  snapshotId: string;
  configurationId: string;
  revisionId: string;
  timestamp: string;
  elements: StructuralElement[];
  relationships: StructuralRelationship[];
  constraints: StructuralConstraint[];
  interfaces: StructuralInterface[];
  connections: StructuralConnection[];
  placements: StructuralPlacement[];
  merkleHash: string;
  provenanceId: string;
  persistedByAuthority: string;
}

export type ADSEP5Action = 
  | 'PUBLISH_STRUCTURAL_BASELINE'
  | 'AUTHORIZE_STRUCTURAL_TRUTH'
  | 'CREATE_CANONICAL_ASSEMBLY'
  | 'OVERRIDE_REVISION_AUTHORITY'
  | 'PROMOTE_STRUCTURAL_AI_PROPOSAL';

export interface ADSEP5GovernanceProposal {
  actor: string;
  action: ADSEP5Action;
  elementId?: string;
  configurationId: string;
  justification?: string;
}

export interface ADSEP5ForensicGateResult {
  gateId: string;
  status: 'PASS' | 'FAIL';
  implementation: string;
  artifact: string;
  adversarialTest?: string;
  authoritySource: string;
  evidence?: Record<string, any>;
}

export interface ADSEP5ForensicAuditResult {
  timestamp: string;
  auditPassed: boolean;
  merkleRoot: string;
  gates: ADSEP5ForensicGateResult[];
  capabilities: Record<string, any>;
  findings: string[];
}
