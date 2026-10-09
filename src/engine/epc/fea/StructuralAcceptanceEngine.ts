/**
 * SECP Industrial OS — EPC-026: Structural Acceptance Engine
 * Compares actual FEA solution results against engineering limits and requirements.
 * Evaluates: Max Stress <= Allowable, Max Displacement <= Limit, Safety Factor >= 1.5,
 * and calculates exact Engineering Margins (MoS = Allowable / (Actual * USF) - 1.0).
 * Failure Pinpointing: Provides exact component, node/element ID, location, load case,
 * actual value, allowable limit, and margin when a criteria fails.
 */

import {
  StructuralAcceptanceCheck,
  FailureLocationSpec,
  FEAMaterialAssignment
} from './FEAVerificationTypes';
import { GeneratedFEAModel } from './FEAModelGenerator';
import { ExecutedFEASolution } from './FEASolverExecutionEngine';
import { StructuralLoadCase } from '../loads/StructuralLoadCaseTypes';

export class StructuralAcceptanceEngine {
  /**
   * Performs structural acceptance checks for an executed FEA load case.
   */
  public static evaluateAcceptance(
    loadCase: StructuralLoadCase,
    model: GeneratedFEAModel,
    solution: ExecutedFEASolution
  ): readonly StructuralAcceptanceCheck[] {
    const checks: StructuralAcceptanceCheck[] = [];
    const summary = solution.solutionSummary;

    // Default structural allowable limits
    // Max Allowable Stress: Carbon Fiber Yield (~600 MPa) / Aluminum 7075 Yield (~503 MPa)
    const carbonMat = model.materialAssignments.find(m => m.materialId === 'mat-carbon-fiber');
    const yieldStrengthMPa = carbonMat ? carbonMat.yieldStrengthPa / 1e6 : 503.0;
    const requiredUSF = loadCase.factors.ultimateSafetyFactor || 1.5;
    const allowableStressMPa = yieldStrengthMPa / requiredUSF;

    // Max Displacement Limit: 10 mm (0.010 m) for drone arms / frame
    const allowableDisplacementMm = 10.0;

    // 1. Stress Allowable Check
    const actualStressMPa = summary.maxVonMisesStressMPa;
    const stressMargin = (yieldStrengthMPa / (actualStressMPa * requiredUSF)) - 1.0;
    const isStressPass = actualStressMPa <= allowableStressMPa && stressMargin >= 0;

    let stressFailureLocation: FailureLocationSpec | undefined = undefined;
    if (!isStressPass) {
      const maxNode = summary.nodalResults.find(n => n.nodeId === summary.maxVonMisesNodeId);
      stressFailureLocation = {
        componentId: summary.maxVonMisesComponentId,
        nodeId: summary.maxVonMisesNodeId,
        locationCoordinate: maxNode ? maxNode.position : { x: 0, y: 0, z: 0 },
        loadCaseId: loadCase.loadCaseId,
        resultType: 'VON_MISES_STRESS',
        actualValue: actualStressMPa,
        allowableValue: allowableStressMPa,
        unit: 'MPa',
        marginOfSafety: stressMargin,
        failureMode: 'YIELD_EXCEEDED'
      };
    }

    checks.push({
      checkId: `CHK-STRESS-${loadCase.loadCaseId}`,
      loadCaseId: loadCase.loadCaseId,
      requirementId: loadCase.requirementIds[0] || 'DRONE-REQ-001',
      checkType: 'STRESS_ALLOWABLE',
      targetComponentId: summary.maxVonMisesComponentId,
      expectedLimit: allowableStressMPa,
      actualValue: actualStressMPa,
      unit: 'MPa',
      marginOfSafety: stressMargin,
      tolerance: 0.0,
      difference: allowableStressMPa - actualStressMPa,
      verdict: isStressPass ? 'PASS' : 'FAIL',
      failureLocation: stressFailureLocation
    });

    // 2. Maximum Displacement Check
    const actualDispMm = summary.maxDisplacementMm;
    const dispMargin = (allowableDisplacementMm / actualDispMm) - 1.0;
    const isDispPass = actualDispMm <= allowableDisplacementMm;

    let dispFailureLocation: FailureLocationSpec | undefined = undefined;
    if (!isDispPass) {
      const maxNode = summary.nodalResults.find(n => n.nodeId === summary.maxDisplacementNodeId);
      dispFailureLocation = {
        componentId: summary.maxVonMisesComponentId,
        nodeId: summary.maxDisplacementNodeId,
        locationCoordinate: maxNode ? maxNode.position : { x: 0, y: 0, z: 0 },
        loadCaseId: loadCase.loadCaseId,
        resultType: 'DISPLACEMENT',
        actualValue: actualDispMm,
        allowableValue: allowableDisplacementMm,
        unit: 'mm',
        marginOfSafety: dispMargin,
        failureMode: 'EXCESSIVE_DEFLECTION'
      };
    }

    checks.push({
      checkId: `CHK-DISP-${loadCase.loadCaseId}`,
      loadCaseId: loadCase.loadCaseId,
      requirementId: loadCase.requirementIds[0] || 'DRONE-REQ-001',
      checkType: 'DISPLACEMENT_LIMIT',
      targetComponentId: summary.maxVonMisesComponentId,
      expectedLimit: allowableDisplacementMm,
      actualValue: actualDispMm,
      unit: 'mm',
      marginOfSafety: dispMargin,
      tolerance: 0.0,
      difference: allowableDisplacementMm - actualDispMm,
      verdict: isDispPass ? 'PASS' : 'FAIL',
      failureLocation: dispFailureLocation
    });

    // 3. Minimum Safety Factor Check
    const actualSF = summary.minSafetyFactor;
    const sfMargin = (actualSF / requiredUSF) - 1.0;
    const isSFPass = actualSF >= requiredUSF;

    checks.push({
      checkId: `CHK-SF-${loadCase.loadCaseId}`,
      loadCaseId: loadCase.loadCaseId,
      requirementId: loadCase.requirementIds[0] || 'DRONE-REQ-001',
      checkType: 'SAFETY_FACTOR_MIN',
      targetComponentId: summary.maxVonMisesComponentId,
      expectedLimit: requiredUSF,
      actualValue: actualSF,
      unit: 'ratio',
      marginOfSafety: sfMargin,
      tolerance: 0.0,
      difference: actualSF - requiredUSF,
      verdict: isSFPass ? 'PASS' : 'FAIL'
    });

    return checks;
  }
}
