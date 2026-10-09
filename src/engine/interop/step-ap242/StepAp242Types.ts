/**
 * SECP Industrial OS v2 — STEP AP242 Native Pipeline Types
 * PATCH-034: STEP AP242 Native Pipeline
 */

import { EngineeringEvidence } from '../../evidence/EngineeringEvidenceTypes';

export type StepValidationStatus = 'VALID' | 'INVALID' | 'UNPROVEN';

export interface StepValidationResult {
  readonly status: StepValidationStatus;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly schema?: string;
  readonly entityCount: number;
  readonly referenceIntegrity: boolean;
  readonly sourceHash: string;
}

export type StepFidelityVerdict =
  | 'EXACT'
  | 'FIDELITY_WITHIN_TOLERANCE'
  | 'DEGRADED'
  | 'LOSS_DETECTED'
  | 'INVALID'
  | 'UNPROVEN';

export interface StepLossReport {
  readonly status: 'PRESERVED' | 'PARTIAL' | 'LOST' | 'UNSUPPORTED';
  readonly reason?: string;
  readonly sourceEntity?: string;
  readonly targetEntity?: string;
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface StepTopologyReport {
  readonly status: 'VALID' | 'INVALID' | 'UNPROVEN';
  readonly violations: readonly string[];
  readonly counts: {
    readonly vertexCount: number;
    readonly edgeCount: number;
    readonly faceCount: number;
    readonly loopCount: number;
    readonly shellCount: number;
    readonly solidCount: number;
  };
}

export interface StepFidelityReport {
  readonly verdict: StepFidelityVerdict;
  readonly boundingBoxDelta?: number;
  readonly toleranceDelta?: number;
  readonly lossReports: readonly StepLossReport[];
}

export interface StepAp242PipelineResult {
  readonly validation: StepValidationResult;
  readonly topology?: StepTopologyReport;
  readonly fidelity?: StepFidelityReport;
  readonly evidence?: EngineeringEvidence;
  readonly nativeModel?: any; // SECP Native Model reference
}

/**
 * STEP AP242 Entity Representation
 */
export interface StepEntity {
  readonly id: number; // #10, #20, etc.
  readonly type: string;
  readonly parameters: readonly any[];
}

export interface StepHeader {
  readonly fileDescription: readonly string[];
  readonly fileName: string;
  readonly timeStamp: string;
  readonly author: readonly string[];
  readonly organization: readonly string[];
  readonly preprocessorVersion: string;
  readonly originatingSystem: string;
  readonly authorization: string;
  readonly fileSchema: readonly string[];
}

export interface StepData {
  readonly entities: Map<number, StepEntity>;
}

export interface StepParsedFile {
  readonly header: StepHeader;
  readonly data: StepData;
}

/**
 * Assembly Structure Representations
 */
export interface Ap242Component {
  readonly id: string;
  readonly name: string;
  readonly partNumber: string;
  readonly revisionId: string;
  readonly solidIds: readonly string[];
}

export interface Ap242Occurrence {
  readonly occurrenceId: string;
  readonly componentId: string;
  readonly parentOccurrenceId?: string;
  readonly transformMatrix: readonly number[]; // 4x4 matrix (16 elements)
  readonly isRepeatedInstance: boolean;
}

export interface Ap242AssemblyTree {
  readonly assemblyId: string;
  readonly name: string;
  readonly components: readonly Ap242Component[];
  readonly occurrences: readonly Ap242Occurrence[];
  readonly rootOccurrenceIds: readonly string[];
}

/**
 * Quantitative Geometry & Topology Metrics
 */
export interface QuantitativeGeometryMetrics {
  readonly maxVertexDisplacementMm: number;
  readonly maxEdgeCurveDeviationMm: number;
  readonly maxFaceSurfaceDeviationMm: number;
  readonly boundingBoxDeltaMm: number;
  readonly relativeVolumeDeviation: number;
  readonly relativeSurfaceAreaDeviation: number;
  readonly centroidDisplacementMm: number;
  readonly maxTransformDeviation: number;
}

export interface TopologicalInvariants {
  readonly vertexCount: number;
  readonly edgeCount: number;
  readonly faceCount: number;
  readonly loopCount: number;
  readonly shellCount: number;
  readonly solidCount: number;
  readonly eulerCharacteristic: number; // V - E + F
  readonly boundaryEdgesCount: number; // Must be 0 for closed manifold solids
  readonly nonManifoldEdgesCount: number; // Must be 0
  readonly orphanEdgesCount: number; // Must be 0
  readonly orphanVerticesCount: number; // Must be 0
  readonly isClosedManifold: boolean;
}

export interface UnitConversionReport {
  readonly sourceUnit: string;
  readonly targetUnit: string; // 'mm'
  readonly scaleFactor: number;
  readonly unitPreserved: boolean;
  readonly isUnitMismatchRejected: boolean;
}

export interface SemanticLossMatrixEntry {
  readonly entityType: string;
  readonly sourceState: string;
  readonly ap242Representation: string;
  readonly importedState: string;
  readonly semanticLoss: boolean;
  readonly geometricLoss: boolean;
  readonly topologicalLoss: boolean;
  readonly identityLoss: boolean;
  readonly unitLoss: boolean;
  readonly pmiLoss: boolean;
  readonly revisionLoss: boolean;
  readonly status: 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED' | 'NOT_PROVEN';
}

