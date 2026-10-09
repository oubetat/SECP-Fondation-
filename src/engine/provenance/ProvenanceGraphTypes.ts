/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-013: Provenance Graph Types
 */

import { EngineeringIdentity } from '../identity/CanonicalEngineeringIdentity';

export type ProvenanceNodeType =
  | 'DESIGN'
  | 'GEOMETRY'
  | 'MATERIAL'
  | 'MESH'
  | 'SIMULATION'
  | 'RESULT'
  | 'VERIFICATION'
  | 'MANUFACTURING'
  | 'TOOLPATH'
  | 'INSPECTION'
  | 'EVIDENCE'
  | 'REVISION';

export type ProvenanceEdgeType =
  | 'DERIVED_FROM'
  | 'GENERATED_FROM'
  | 'VERIFIED_BY'
  | 'PRODUCED_BY'
  | 'USES'
  | 'DEPENDS_ON'
  | 'SUPERSEDES'
  | 'REVISION_OF'
  | 'VALIDATES'
  | 'CERTIFIES';

export interface ProvenanceNode {
  readonly id: string;
  readonly type: ProvenanceNodeType;
  readonly engineeringIdentityId: string;
  readonly canonicalHash: string;
  readonly version: string;
  readonly createdAt: string;
  readonly source?: string;
  readonly metadataHash?: string;
  readonly evidenceRefs: readonly string[];
  readonly attributes?: Readonly<Record<string, unknown>>;
}

export interface ProvenanceEdge {
  readonly id: string;
  readonly type: ProvenanceEdgeType;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly createdAt: string;
  readonly evidenceRefs: readonly string[];
  readonly relationHash: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type ProvenanceVerificationStatus =
  | 'PASS'
  | 'FAIL'
  | 'UNPROVEN'
  | 'INCONCLUSIVE';

export interface ProvenanceVerificationResult {
  readonly status: ProvenanceVerificationStatus;
  readonly graphHash: string;
  readonly verifiedNodes: number;
  readonly invalidNodes: number;
  readonly verifiedEdges: number;
  readonly invalidEdges: number;
  readonly missingEvidence: readonly string[];
  readonly brokenReferences: readonly string[];
  readonly cyclesDetected: readonly string[];
  readonly violations: readonly string[];
  readonly checkedAt: string;
  readonly structureStatus: 'PASS' | 'FAIL' | 'INVALID';
  readonly lineageStatus: 'PASS' | 'FAIL' | 'UNPROVEN';
}

export interface ProvenanceImpactResult {
  readonly rootNodeId: string;
  readonly affectedNodeIds: readonly string[];
  readonly affectedEdgeIds: readonly string[];
  readonly staleCandidates: readonly string[];
  readonly status: ProvenanceVerificationStatus;
}

export interface ProvenanceGraphEvidenceReport {
  readonly patchId: 'PATCH-013';
  readonly artifactType: 'PROVENANCE_GRAPH';
  readonly graphHash: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly verifiedNodeCount: number;
  readonly verifiedEdgeCount: number;
  readonly verificationStatus: ProvenanceVerificationStatus;
  readonly violations: readonly string[];
  readonly missingEvidence: readonly string[];
  readonly brokenReferences: readonly string[];
  readonly generatedAt: string;
  readonly engineeringClockSource: string;
  readonly testSummary?: Readonly<Record<string, unknown>>;
}
