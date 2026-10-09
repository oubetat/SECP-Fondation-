import { DerivedArtifactBindingResult } from '../topology/CanonicalDerivedArtifactBinding';
import { EvidenceLeafRecord } from '../certification/truth/types';

export type CoreExecutionState = 
  | 'DECLARED'
  | 'REQUESTED'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'VERIFIED'
  | 'EVIDENCE_BACKED'
  | 'SEALED'
  | 'REGISTERED'
  | 'REJECTED'
  | 'INVALID'
  | 'UNPROVEN';

export interface CoreExecutionRequest {
  requestId: string;
  engineeringObjectId: string;
  revisionId?: string;
  targetRevisionHash?: string;
  targetGeometryHash?: string;
  pluginId: string;
  pluginVersion: string;
  executionKind: string;
  parameters: Record<string, any>;
  environmentalSeed?: string;
  consumedHandoffIds?: string[];
}

export interface DomainSolverResult {
  status: 'SUCCESS' | 'SOLVER_ERROR';
  rawResults: Record<string, any>;
  artifactContentHash: string;
  scalarOutputs?: Record<string, number>;
  executionDurationMs: number;
  solvedAt?: string;
}

export interface ExecutionOccurrenceRecord {
  readonly occurrenceId: string;
  readonly executionId: string;
  readonly timestamp: string;
  readonly solvedAt?: string;
  readonly durationMs: number;
}

export interface DomainSolver {
  solverId: string;
  solverVersion: string;
  pluginId: string;
  executionKind: string;
  execute(
    request: CoreExecutionRequest,
    canonicalSnapshot: Readonly<Record<string, any>>
  ): Promise<DomainSolverResult> | DomainSolverResult;
}

export interface CoreVerificationResult {
  overallVerdict: 'PASS' | 'REJECTED' | 'UNPROVEN';
  evaluatedGates: Array<{
    gateId: string;
    status: 'PASS' | 'FAIL';
    details?: string;
  }>;
  reasons: string[];
}

export interface GenericExecutionEnvelope {
  readonly executionId: string;
  readonly engineeringObjectId: string;
  readonly revisionHash: string;
  readonly geometryHash: string;
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly executionKind: string;
  readonly inputDigest: string;
  readonly resultDigest: string;
  readonly solverIdentity: string;
  readonly derivationBinding: DerivedArtifactBindingResult;
  readonly verificationResult: CoreVerificationResult;
  readonly evidenceLeaf: EvidenceLeafRecord;
  readonly state: CoreExecutionState;
  readonly timestamp: string;
  readonly occurrenceId?: string;
  readonly occurrences?: readonly ExecutionOccurrenceRecord[];
  readonly solverResult: DomainSolverResult;
  readonly consumedHandoffIds?: readonly string[];
}
