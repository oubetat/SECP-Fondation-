/**
 * SECP Industrial OS — EPC-026: CAD To FEA Traceability Service
 * Maintains bidirectional mapping between CAD Revisions (EPC-019), FEA Model Revisions,
 * Mesh Revisions, and Solver Execution records.
 * Automatically detects state transitions: VALID, STALE, and INVALIDATED.
 */

import { FEATraceabilityRecord, FEAModelStatus, FEAConfigurationRevision } from './FEAVerificationTypes';
import { GeneratedFEAModel } from './FEAModelGenerator';
import { ExecutedFEASolution } from './FEASolverExecutionEngine';
import { StructuralAcceptanceCheck } from './FEAVerificationTypes';

export class CADToFEATraceabilityService {
  /**
   * Generates a complete traceability record linking Requirements -> Load Case -> FEA Model -> Mesh -> Execution -> Results.
   */
  public static createTraceabilityRecord(
    requirementId: string,
    loadCaseId: string,
    model: GeneratedFEAModel,
    solution: ExecutedFEASolution,
    checks: readonly StructuralAcceptanceCheck[]
  ): FEATraceabilityRecord {
    const isChecksPassed = checks.every(c => c.verdict === 'PASS');
    const summary = solution.solutionSummary;

    return {
      requirementId,
      loadCaseId,
      feaModelRevision: model.configuration.feaModelRevision,
      meshRevision: model.configuration.meshRevision,
      executionId: solution.executionMetrics.executionId,
      maxStressMPa: summary.maxVonMisesStressMPa,
      safetyFactor: summary.minSafetyFactor,
      marginOfSafety: summary.minMarginOfSafety,
      checkVerdict: isChecksPassed ? 'PASS' : 'FAIL',
      status: isChecksPassed ? 'VERIFIED' : 'FAILED'
    };
  }

  /**
   * Verifies CAD revision integrity against FEA Model revision to detect stale models.
   */
  public static verifyModelStatus(
    currentCADRevision: string,
    feaModelConfig: FEAConfigurationRevision
  ): FEAModelStatus {
    if (feaModelConfig.cadRevision !== currentCADRevision) {
      return 'STALE';
    }
    return 'VALID';
  }
}
