/**
 * SECP — ADSE-P4 Digital Thread & Engineering Truth Chain Types & Contracts
 * Advanced Aerospace & Defense Systems Engineering (ADSE)
 * 
 * Governing Principle:
 * «The Digital Thread does not create Engineering Truth; it proves, connects,
 * and reconstructs the lineage of Engineering Truth.»
 */

import { CoreBindingState } from '../p2/types';
import { ArchitecturalLayer } from '../p3/types';

export type ThreadAuthoritySource = 
  | 'P1_REQUIREMENT_AUTHORITY'
  | 'P1_SYSTEM_MODEL_AUTHORITY'
  | 'P1_VERIFICATION_INTENT_AUTHORITY'
  | 'P2_MBSE_SEMANTIC_AUTHORITY'
  | 'P3_ARCHITECTURE_AUTHORITY'
  | 'SECP_CORE_REVISION_AUTHORITY'
  | 'SECP_CORE_EXECUTION_AUTHORITY'
  | 'SECP_VERIFICATION_AUTHORITY'
  | 'SECP_EVIDENCE_AUTHORITY'
  | 'SECP_PROVENANCE_AUTHORITY'
  | 'SECP_PERSISTENCE_AUTHORITY'
  | 'SECP_PUBLICATION_AUTHORITY';

export type ThreadNodeType = 
  | 'Requirement'
  | 'SystemNeed'
  | 'SystemModel'
  | 'MBSEElement'
  | 'Architecture'
  | 'ArchitectureElement'
  | 'Interface'
  | 'Dependency'
  | 'Allocation'
  | 'Constraint'
  | 'Configuration'
  | 'Revision'
  | 'Execution'
  | 'VerificationIntent'
  | 'VerificationResult'
  | 'Evidence'
  | 'Provenance'
  | 'PersistenceSnapshot'
  | 'Publication';

export type ThreadEdgeType = 
  | 'DERIVED_FROM'
  | 'SATISFIES'
  | 'ALLOCATED_TO'
  | 'IMPLEMENTED_BY'
  | 'CONNECTED_TO'
  | 'DEPENDS_ON'
  | 'CONSTRAINED_BY'
  | 'CONFIGURED_BY'
  | 'REVISED_BY'
  | 'EXECUTED_BY'
  | 'VERIFIED_BY'
  | 'SUPPORTED_BY'
  | 'PROVENANCE_OF'
  | 'PERSISTED_AS'
  | 'PUBLISHED_AS'
  | 'IMPACTS'
  | 'SUPERSEDES';

export interface DigitalThreadNode {
  nodeId: string; // e.g. 'thread:node:REQ-AV-001'
  nodeType: ThreadNodeType;
  canonicalId: string; // Real authoritative artifact ID (e.g., 'REQ-AV-001' or 'arch:sys:AVIONICS')
  authoritySource: ThreadAuthoritySource;
  displayName: string;
  configurationId: string;
  revisionId: string;
  revisionHash: string;
  provenanceId: string;
  coreBindingState: CoreBindingState;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface DigitalThreadEdge {
  edgeId: string; // e.g. 'thread:edge:SATISFIES-ARCH01->REQ01'
  edgeType: ThreadEdgeType;
  sourceNodeId: string;
  targetNodeId: string;
  authoritySource: ThreadAuthoritySource;
  configurationId: string;
  revisionId: string;
  provenanceId: string;
  isVerified: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface EngineeringLineage {
  rootNodeId: string;
  rootCanonicalId: string;
  rootType: ThreadNodeType;
  forwardTrace: DigitalThreadNode[];
  backwardTrace: DigitalThreadNode[];
  edges: DigitalThreadEdge[];
  authoritiesInvolved: ThreadAuthoritySource[];
  isComplete: boolean;
  isVerified: boolean;
}

export interface ImpactPath {
  changedNodeId: string;
  affectedNodes: DigitalThreadNode[];
  affectedEdges: DigitalThreadEdge[];
  affectedRequirements: string[];
  affectedArchitecture: string[];
  affectedExecutions: string[];
  affectedVerifications: string[];
  affectedEvidences: string[];
  affectedPublications: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface ThreadQuery {
  canonicalId?: string;
  nodeType?: ThreadNodeType;
  configurationId?: string;
  revisionId?: string;
  authoritySource?: ThreadAuthoritySource;
  minConfidence?: number;
}

export interface ThreadTraversalResult {
  nodes: DigitalThreadNode[];
  edges: DigitalThreadEdge[];
  hopCount: number;
  depthReached: number;
  visitedNodeIds: string[];
}

export interface CompleteTruthChainLineage {
  canonicalId: string;
  requirement?: DigitalThreadNode;
  systemModel?: DigitalThreadNode;
  mbseElement?: DigitalThreadNode;
  architectureElement?: DigitalThreadNode;
  configuration?: DigitalThreadNode;
  revision?: DigitalThreadNode;
  execution?: DigitalThreadNode;
  verificationIntent?: DigitalThreadNode;
  verificationResult?: DigitalThreadNode;
  evidence?: DigitalThreadNode;
  provenance?: DigitalThreadNode;
  persistence?: DigitalThreadNode;
  publication?: DigitalThreadNode;
  chainIntegrity: 'COMPLETE' | 'PARTIAL' | 'BROKEN';
  missingLinks: string[];
  verified: boolean;
  provenanceRoot: string;
}

export type ThreadFindingSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type ThreadFindingCategory = 
  | 'ORPHAN_NODE'
  | 'BROKEN_LINK'
  | 'DANGLING_REFERENCE'
  | 'INVALID_AUTHORITY'
  | 'REVISION_MISMATCH'
  | 'CONFIGURATION_MISMATCH'
  | 'MISSING_PROVENANCE'
  | 'MISSING_VERIFICATION'
  | 'UNSUPPORTED_EVIDENCE'
  | 'CIRCULAR_LINEAGE'
  | 'IMPOSSIBLE_LINEAGE'
  | 'DUPLICATE_CANONICAL_IDENTITY'
  | 'CROSS_SCENARIO_CONTAMINATION'
  | 'UNPUBLISHED_REFERENCED_STATE'
  | 'EVIDENCE_NON_AUTHORITATIVE';

export interface ThreadConsistencyFinding {
  findingId: string;
  severity: ThreadFindingSeverity;
  category: ThreadFindingCategory;
  nodeId?: string;
  edgeId?: string;
  reason: string;
  authority: ThreadAuthoritySource;
  revisionId: string;
  configurationId: string;
  provenanceId: string;
}

export interface ThreadIntegrityReport {
  timestamp: string;
  configurationId: string;
  revisionId: string;
  totalNodes: number;
  totalEdges: number;
  totalFindings: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  findings: ThreadConsistencyFinding[];
  isConsistent: boolean;
  merkleRoot: string;
}

export interface ThreadSnapshot {
  snapshotId: string;
  configurationId: string;
  revisionId: string;
  timestamp: string;
  nodes: DigitalThreadNode[];
  edges: DigitalThreadEdge[];
  merkleHash: string;
  provenanceId: string;
  persistedByAuthority: string;
}

export type ADSEP4Action = 
  | 'PUBLISH_THREAD'
  | 'CREATE_CANONICAL_LINK'
  | 'AUTHORIZE_LINEAGE'
  | 'PROMOTE_AI_PROPOSAL'
  | 'DELETE_THREAD_NODE';

export interface ADSEP4GovernanceProposal {
  actor: string;
  action: ADSEP4Action;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType?: ThreadEdgeType;
  configurationId: string;
  justification?: string;
}

export interface ADSEP4ForensicGateResult {
  gateId: string;
  status: 'PASS' | 'FAIL';
  implementation: string;
  artifact: string;
  adversarialTest?: string;
  authoritySource: string;
  evidence?: Record<string, any>;
}

export interface ADSEP4ForensicAuditResult {
  timestamp: string;
  auditPassed: boolean;
  merkleRoot: string;
  gates: ADSEP4ForensicGateResult[];
  capabilities: Record<string, any>;
  findings: string[];
}
