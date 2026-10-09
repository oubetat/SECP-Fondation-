import { CanonicalCollisionInput, CanonicalCollisionResult, CollisionStatus } from '../types';

export type VerificationStatus = 'AUTHORITATIVE' | 'STALE_RESULT' | 'INTEGRITY_FAILURE' | 'NOT_AUTHORITATIVE';

export interface RevisionBindingMetadata {
  documentId: string;
  revisionId: string;
  geometryId: string;
  geometryRevision: number;
  snapshotId: string;
  topologyIdentity: string;
  geometryHash: string;
  transformRevision: string;
  motionRevision: string;
}

export interface CollisionEvidencePackage {
  evidenceId: string;
  resultId: string;
  executionId: string;
  inputHash: string;
  resultHash: string;
  geometryHash: string;
  snapshotId: string;
  revisionBinding: RevisionBindingMetadata;
  providerId: string;
  algorithmVersion: string;
  exactness: string;
  status: CollisionStatus;
  provenSafe: boolean;
  timestampIso: string;
  evidenceHash: string;
}

export interface EngineeringEvent {
  eventId: string;
  eventType: 'COLLISION_EVALUATED' | 'COLLISION_PERSISTED' | 'COLLISION_RECONSTRUCTED' | 'COLLISION_REEXECUTED';
  executionId: string;
  resultId: string;
  evidenceId: string;
  inputHash: string;
  resultHash: string;
  evidenceHash: string;
  revisionBinding: RevisionBindingMetadata;
  timestampIso: string;
  providerId: string;
  algorithmVersion: string;
  previousEventId: string | null;
  eventHash: string;
}

export interface CollisionPersistedRecord {
  recordId: string;
  executionId: string;
  resultId: string;
  evidenceId: string;
  eventId: string;
  input: CanonicalCollisionInput;
  result: CanonicalCollisionResult;
  evidence: CollisionEvidencePackage;
  event: EngineeringEvent;
  revisionBinding: RevisionBindingMetadata;
  persistedAtIso: string;
  canonicalHash: string;
}

export interface ProvenanceTraceNode {
  level: string;
  id: string;
  hash: string;
  verified: boolean;
}

export interface ProvenanceGraph {
  documentId: string;
  revisionId: string;
  geometryId: string;
  snapshotId: string;
  executionId: string;
  resultId: string;
  evidenceId: string;
  eventId: string;
  nodes: ProvenanceTraceNode[];
  isUnbrokenChain: boolean;
}

export interface CanonicalResultEquivalenceResult {
  isEquivalent: boolean;
  mismatches: string[];
  operationalDiffs: string[];
}

export interface ReconstructionParityResult {
  originalResult: CanonicalCollisionResult;
  persistedResult: CanonicalCollisionResult;
  reloadedResult: CanonicalCollisionResult;
  reconstructedResult: CanonicalCollisionResult;
  reexecutedResult: CanonicalCollisionResult;
  R0_vs_R1: CanonicalResultEquivalenceResult;
  R1_vs_R2: CanonicalResultEquivalenceResult;
  R2_vs_R3: CanonicalResultEquivalenceResult;
  R0_vs_R4: CanonicalResultEquivalenceResult;
  isParityVerified: boolean;
  verificationStatus: VerificationStatus;
}

export type ReExecutionVerdict =
  | 'REEXECUTION_MATCH'
  | 'REEXECUTION_DIVERGED'
  | 'REEXECUTION_CONTEXT_MISMATCH'
  | 'REEXECUTION_INTEGRITY_FAILURE'
  | 'REEXECUTION_EXECUTION_FAILURE'
  | 'REEXECUTION_UNAVAILABLE';

export type DivergenceCategory =
  | 'DIVERGENCE_NONE'
  | 'DIVERGENCE_GEOMETRY_MISMATCH'
  | 'DIVERGENCE_REVISION_MISMATCH'
  | 'DIVERGENCE_SNAPSHOT_MISMATCH'
  | 'DIVERGENCE_TRANSFORM_MISMATCH'
  | 'DIVERGENCE_MOTION_MISMATCH'
  | 'DIVERGENCE_PROVIDER_DRIFT'
  | 'DIVERGENCE_ALGORITHM_DRIFT'
  | 'DIVERGENCE_RESULT_STATUS_MISMATCH'
  | 'DIVERGENCE_RESULT_METRICS_MISMATCH'
  | 'DIVERGENCE_MANIFOLD_MISMATCH'
  | 'DIVERGENCE_CONTEXT_CORRUPTED'
  | 'DIVERGENCE_UNKNOWN';

export interface CollisionReExecutionContract {
  contractId: string;
  executionId: string;
  documentId: string;
  revisionId: string;
  geometryId: string;
  geometryRevision: number;
  snapshotId: string;
  topologyIdentity: string;
  geometryHash: string;
  transformRevision: string;
  motionRevision: string;
  coordinateFrame: string;
  domain: string;
  providerId: string;
  algorithmVersion: string;
  inputHash: string;
  resultHash: string;
  evidenceHash: string;
  evidenceId: string;
  eventId: string;
  canonicalInput: CanonicalCollisionInput;
  canonicalResult: CanonicalCollisionResult;
  contractHash: string;
}

export interface CollisionReExecutionEvidence {
  evidenceId: string;
  reExecutionId: string;
  historicalExecutionId: string;
  historicalResultHash: string;
  replayResultHash: string;
  historicalEngineeringHash: string;
  replayEngineeringHash: string;
  historicalInputHash: string;
  replayInputHash: string;
  verdict: ReExecutionVerdict;
  divergenceCategory: DivergenceCategory;
  divergenceDetails: string[];
  contextIdentity: string;
  truthThreadEventId: string;
  providerId: string;
  algorithmVersion: string;
  timestampIso: string;
  evidenceHash: string;
}

export interface CollisionReExecutionReport {
  reExecutionId: string;
  historicalExecutionId: string;
  verdict: ReExecutionVerdict;
  divergenceCategory: DivergenceCategory;
  divergenceDetails: string[];
  isMatch: boolean;
  historicalResult: CanonicalCollisionResult | null;
  replayResult: CanonicalCollisionResult | null;
  historicalInput: CanonicalCollisionInput | null;
  contract: CollisionReExecutionContract | null;
  equivalence: CanonicalResultEquivalenceResult | null;
  evidence: CollisionReExecutionEvidence | null;
  truthThreadEvent: EngineeringEvent | null;
  verificationStatus: VerificationStatus;
}
