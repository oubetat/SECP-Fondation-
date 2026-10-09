/**
 * SECP Industrial OS — EPC-026: FEA Verification System Types
 * Defines data structures, contracts, revision tracking, FEA model interfaces,
 * mesh quality contracts, unit validation specs, solver execution metrics,
 * structural equilibrium reports, acceptance checks, CAD-FEA traceability,
 * and canonical evidence package formats for FEA execution & verification.
 */

import { Point3D, Vector3D, StructuralLoadCase, LoadCaseType } from '../loads/StructuralLoadCaseTypes';
import { FEAMesh, MeshNode, MeshElement, NodeResults, StructuralAnalysisResults } from '../../structural-physics/StructuralPhysicsTypes';

// ============================================================================
// 1. ANALYSIS & SOLVER TYPES
// ============================================================================

export type FEAAnalysisType =
  | 'LINEAR_STATIC_STRUCTURAL'
  | 'STRESS_ANALYSIS'
  | 'DISPLACEMENT_ANALYSIS'
  | 'STRAIN_ANALYSIS'
  | 'REACTION_FORCE_ANALYSIS'
  | 'MODAL_VIBRATION_ANALYSIS';

export type FEASolverName = 'SECP_STRUCTURAL_FEA_SOLVER_v4.2';

export type FEAModelStatus = 'VALID' | 'STALE' | 'INVALIDATED';

// ============================================================================
// 2. CONFIGURATION & REVISION CONTRACT
// ============================================================================

export interface FEAConfigurationRevision {
  readonly cadRevision: string;
  readonly assemblyRevision: string;
  readonly configurationRevision: string;
  readonly materialRevision: string;
  readonly loadCaseRevision: string;
  readonly meshRevision: string;
  readonly solverVersion: string;
  readonly feaModelRevision: string;
}

// ============================================================================
// 3. CAD-TO-FEA ENTITY MAPPING
// ============================================================================

export interface CADToFEAEntityMap {
  readonly cadPartId: string;
  readonly cadFeatureId: string;
  readonly feaComponentId: string;
  readonly feaNodeIds: readonly number[];
  readonly feaElementIds: readonly number[];
  readonly cadRevision: string;
  readonly feaModelRevision: string;
  readonly mappingStatus: FEAModelStatus;
}

// ============================================================================
// 4. MATERIAL ASSIGNMENT CONTRACT
// ============================================================================

export interface FEAMaterialAssignment {
  readonly componentId: string;
  readonly materialId: string;
  readonly materialName: string;
  readonly materialRevision: string;
  readonly densityKgM3: number;
  readonly youngsModulusPa: number;
  readonly poissonsRatio: number;
  readonly yieldStrengthPa: number;
  readonly ultimateStrengthPa: number;
  readonly verified: boolean;
}

// ============================================================================
// 5. MESH QUALITY GATE TYPES
// ============================================================================

export interface MeshQualityGateResult {
  readonly meshId: string;
  readonly meshRevision: string;
  readonly elementType: string;
  readonly elementCount: number;
  readonly nodeCount: number;
  readonly minimumQuality: number;
  readonly maximumQuality: number;
  readonly averageQuality: number;
  readonly aspectRatioMin: number;
  readonly aspectRatioMax: number;
  readonly jacobianDeterminantMin: number;
  readonly hasDegenerateElements: boolean;
  readonly hasInvalidElements: boolean;
  readonly hasDuplicateNodes: boolean;
  readonly hasFreeUnconnectedRegions: boolean;
  readonly gatePassed: boolean;
  readonly details: string;
}

// ============================================================================
// 6. UNIT VALIDATION CONTRACT
// ============================================================================

export interface FEAUnitValidationResult {
  readonly lengthUnit: 'm' | 'mm';
  readonly massUnit: 'kg';
  readonly timeUnit: 's';
  readonly forceUnit: 'N';
  readonly pressureUnit: 'Pa';
  readonly stressUnit: 'Pa' | 'MPa';
  readonly energyUnit: 'J';
  readonly torqueUnit: 'N*m';
  readonly isValid: boolean;
  readonly checkedQuantityCount: number;
  readonly errors: readonly string[];
}

// ============================================================================
// 7. SOLVER EXECUTION CONTRACT & METRICS
// ============================================================================

export interface FEASolverExecutionMetrics {
  readonly executionId: string;
  readonly caseId: string;
  readonly loadCaseId: string;
  readonly solverName: FEASolverName;
  readonly solverVersion: string;
  readonly analysisType: FEAAnalysisType;
  readonly startTimeIso: string;
  readonly endTimeIso: string;
  readonly executionTimeMs: number;
  readonly iterationsCount: number;
  readonly convergenceStatus: 'CONVERGED' | 'DIVERGED' | 'UNCONVERGED';
  readonly finalResidualNorm: number;
  readonly numericalStatus: 'STABLE' | 'ILL_CONDITIONED' | 'SINGULAR';
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

// ============================================================================
// 8. STRUCTURAL EQUILIBRIUM CONTRACT
// ============================================================================

export interface StructuralEquilibriumReport {
  readonly loadCaseId: string;
  readonly executionId: string;
  readonly totalAppliedForceN: Vector3D;
  readonly totalReactionForceN: Vector3D;
  readonly forceResidualN: Vector3D;
  readonly netForceResidualMagnitudeN: number;
  readonly totalAppliedMomentNm: Vector3D;
  readonly totalReactionMomentNm: Vector3D;
  readonly momentResidualNm: Vector3D;
  readonly netMomentResidualMagnitudeNm: number;
  readonly toleranceN: number;
  readonly toleranceNm: number;
  readonly isEquilibriumSatisfied: boolean;
  readonly verdict: 'PASS' | 'FAIL';
}

// ============================================================================
// 9. DETAILED STRUCTURAL RESULTS
// ============================================================================

export interface NodalStructuralResult {
  readonly resultId: string;
  readonly executionId: string;
  readonly loadCaseId: string;
  readonly componentId: string;
  readonly nodeId: number;
  readonly position: Point3D;
  readonly displacementM: Vector3D;
  readonly displacementMagnitudeM: number;
  readonly strainTensor: { xx: number; yy: number; zz: number; xy: number; yz: number; xz: number };
  readonly stressTensorPa: { xx: number; yy: number; zz: number; xy: number; yz: number; xz: number };
  readonly vonMisesStressPa: number;
  readonly vonMisesStressMPa: number;
  readonly safetyFactor: number;
  readonly marginOfSafety: number;
}

export interface ReactionForceResult {
  readonly resultId: string;
  readonly executionId: string;
  readonly loadCaseId: string;
  readonly nodeId: number;
  readonly boundaryConditionId: string;
  readonly reactionForceN: Vector3D;
  readonly reactionMomentNm: Vector3D;
}

export interface FEASolutionSummary {
  readonly executionId: string;
  readonly loadCaseId: string;
  readonly analysisType: FEAAnalysisType;
  readonly maxDisplacementMm: number;
  readonly maxDisplacementNodeId: number;
  readonly maxVonMisesStressMPa: number;
  readonly maxVonMisesNodeId: number;
  readonly maxVonMisesComponentId: string;
  readonly minSafetyFactor: number;
  readonly minMarginOfSafety: number;
  readonly totalReactionForceN: Vector3D;
  readonly nodalResults: readonly NodalStructuralResult[];
  readonly reactionForces: readonly ReactionForceResult[];
}

// ============================================================================
// 10. ACCEPTANCE CHECKS & FAILURE PINPOINTING
// ============================================================================

export interface FailureLocationSpec {
  readonly componentId: string;
  readonly nodeId: number;
  readonly elementId?: number;
  readonly locationCoordinate: Point3D;
  readonly loadCaseId: string;
  readonly resultType: 'VON_MISES_STRESS' | 'DISPLACEMENT' | 'SAFETY_FACTOR';
  readonly actualValue: number;
  readonly allowableValue: number;
  readonly unit: string;
  readonly marginOfSafety: number;
  readonly failureMode: string;
}

export interface StructuralAcceptanceCheck {
  readonly checkId: string;
  readonly loadCaseId: string;
  readonly requirementId: string;
  readonly checkType: 'STRESS_ALLOWABLE' | 'DISPLACEMENT_LIMIT' | 'SAFETY_FACTOR_MIN' | 'EQUILIBRIUM';
  readonly targetComponentId: string;
  readonly expectedLimit: number;
  readonly actualValue: number;
  readonly unit: string;
  readonly marginOfSafety: number;
  readonly tolerance: number;
  readonly difference: number;
  readonly verdict: 'PASS' | 'FAIL';
  readonly failureLocation?: FailureLocationSpec;
}

// ============================================================================
// 11. LOAD CASE EXECUTION MATRIX ENTRY
// ============================================================================

export interface LoadCaseExecutionMatrixEntry {
  readonly loadCaseId: string;
  readonly loadCaseName: string;
  readonly loadType: LoadCaseType;
  readonly requirementIds: readonly string[];
  readonly isRequired: boolean;
  readonly isSupported: boolean;
  readonly isExecuted: boolean;
  readonly executionMetrics?: FEASolverExecutionMetrics;
  readonly solutionSummary?: FEASolutionSummary;
  readonly equilibriumReport?: StructuralEquilibriumReport;
  readonly acceptanceChecks: readonly StructuralAcceptanceCheck[];
  readonly verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
}

// ============================================================================
// 12. TRACEABILITY & REPRODUCIBILITY
// ============================================================================

export interface FEATraceabilityRecord {
  readonly requirementId: string;
  readonly loadCaseId: string;
  readonly feaModelRevision: string;
  readonly meshRevision: string;
  readonly executionId: string;
  readonly maxStressMPa: number;
  readonly safetyFactor: number;
  readonly marginOfSafety: number;
  readonly checkVerdict: 'PASS' | 'FAIL';
  readonly status: 'VERIFIED' | 'STALE' | 'FAILED';
}

export interface FEAReproducibilityReport {
  readonly runAExecutionId: string;
  readonly runBExecutionId: string;
  readonly maxStressDiffMPa: number;
  readonly maxDisplacementDiffMm: number;
  readonly relativeDifference: number;
  readonly tolerance: number;
  readonly isReproducible: boolean;
  readonly verdict: 'PASS' | 'FAIL';
}

// ============================================================================
// 13. VISUALIZATION METADATA
// ============================================================================

export interface FEAFieldVisualizationMetadata {
  readonly executionId: string;
  readonly loadCaseId: string;
  readonly fieldType: 'DEFORMATION' | 'VON_MISES_STRESS' | 'STRAIN' | 'REACTION_FORCES';
  readonly minVal: number;
  readonly maxVal: number;
  readonly unit: string;
  readonly legendTitle: string;
  readonly colorMap: 'JET' | 'VIRIDIS' | 'COOLWARM';
  readonly nodeCount: number;
  readonly isDataBindingValid: boolean;
}

// ============================================================================
// 14. EVIDENCE PACKAGE & MASTER VERIFIER RESULT
// ============================================================================

export interface EPC026EvidencePackage {
  readonly evidenceId: string;
  readonly caseId: string;
  readonly timestamp: string;
  readonly provenance: {
    readonly systemId: string;
    readonly author: string;
    readonly algorithmVersion: string;
  };
  readonly configurations: FEAConfigurationRevision;
  readonly executedMatrix: readonly LoadCaseExecutionMatrixEntry[];
  readonly traceabilityRecords: readonly FEATraceabilityRecord[];
  readonly reproducibilityReport: FEAReproducibilityReport;
  readonly overallVerdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  readonly evidenceHash: string;
}

export interface EPC026AcceptanceCriterionResult {
  readonly id: string;
  readonly description: string;
  readonly status: 'PASS' | 'FAIL';
  readonly details: string;
}

export interface EPC026VerificationResult {
  readonly verifierId: string;
  readonly timestamp: string;
  readonly overallVerdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  readonly totalCriteriaCount: number;
  readonly passedCount: number;
  readonly failedCount: number;
  readonly criteriaResults: readonly EPC026AcceptanceCriterionResult[];
  readonly evidencePackage: EPC026EvidencePackage;
}
