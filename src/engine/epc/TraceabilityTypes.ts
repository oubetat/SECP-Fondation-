/**
 * SECP Industrial OS — EPC-003: Requirement Traceability Types
 * Domain-Agnostic Engineering Traceability Schema and Types.
 */

import { EngineeringRequirement, RequirementPriority } from './EngineeringRequirementTypes';
import { ProofCaseProject } from './ProofCaseTypes';

export type TraceabilityArtifactType =
  | 'REQUIREMENT'
  | 'DESIGN_FEATURE'
  | 'ANALYSIS'
  | 'TEST'
  | 'EVIDENCE';

export type TraceabilityRelationshipType =
  | 'REQUIREMENT_TO_DESIGN_FEATURE'
  | 'DESIGN_FEATURE_TO_ANALYSIS'
  | 'ANALYSIS_TO_TEST'
  | 'TEST_TO_EVIDENCE';

export type TraceabilityStage =
  | 'REQUIREMENT'
  | 'DESIGN_FEATURE'
  | 'ANALYSIS'
  | 'TEST'
  | 'EVIDENCE';

export type TraceabilityStatus =
  | 'FULLY_TRACEABLE'
  | 'PARTIALLY_TRACEABLE'
  | 'UNTRACEABLE';

export interface TraceabilityArtifact {
  readonly artifactId: string;
  readonly type: TraceabilityArtifactType;
  readonly name: string;
  readonly description?: string;
  readonly category?: string;
  readonly revision?: string;
  readonly uri?: string;
  readonly checksum?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface TraceabilityEdge {
  readonly edgeId: string;
  readonly sourceId: string;
  readonly sourceType: TraceabilityArtifactType;
  readonly targetId: string;
  readonly targetType: TraceabilityArtifactType;
  readonly relationshipType: TraceabilityRelationshipType;
  readonly version?: string;
  readonly createdAt?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface RequirementTraceResult {
  readonly requirementId: string;
  readonly requirement?: EngineeringRequirement;
  readonly designFeatures: readonly TraceabilityArtifact[];
  readonly analyses: readonly TraceabilityArtifact[];
  readonly tests: readonly TraceabilityArtifact[];
  readonly evidence: readonly TraceabilityArtifact[];
  readonly status: TraceabilityStatus;
  readonly missingStages: readonly ('DESIGN_FEATURE' | 'ANALYSIS' | 'TEST' | 'EVIDENCE')[];
  readonly isValidChain: boolean;
  readonly criticalGatePassed: boolean;
}

export interface ReverseTraceResult {
  readonly evidenceId: string;
  readonly evidence?: TraceabilityArtifact;
  readonly tests: readonly TraceabilityArtifact[];
  readonly analyses: readonly TraceabilityArtifact[];
  readonly designFeatures: readonly TraceabilityArtifact[];
  readonly requirements: readonly TraceabilityArtifact[];
  readonly isCompleteReverseChain: boolean;
}

export interface OrphanReport {
  readonly orphanRequirements: readonly TraceabilityArtifact[];
  readonly orphanDesignFeatures: readonly TraceabilityArtifact[];
  readonly orphanAnalyses: readonly TraceabilityArtifact[];
  readonly orphanTests: readonly TraceabilityArtifact[];
  readonly orphanEvidence: readonly TraceabilityArtifact[];
  readonly totalOrphans: number;
}

export interface TraceabilityGraphData {
  readonly graphId: string;
  readonly revision: string;
  readonly artifacts: readonly TraceabilityArtifact[];
  readonly edges: readonly TraceabilityEdge[];
  readonly metadata?: Record<string, unknown>;
}

export class TraceabilityValidationError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string = 'MALFORMED_TRACEABILITY_GRAPH',
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TraceabilityValidationError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, TraceabilityValidationError.prototype);
  }
}

export interface EPC003ValidationResult {
  readonly epc: 'EPC-003';
  readonly name: 'Requirement Traceability';
  readonly verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  readonly checks: Record<string, boolean>;
  readonly evidenceHash: string;
  readonly timestamp: string;
  readonly implementationRevision: string;
}
