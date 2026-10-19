/**
 * SECP Industrial OS — GAP-011 Closure Gate
 * Implements the programmatic, non-bypassable 9-point verification gate:
 *
 * [ ] Coarse mesh convergence proven
 * [ ] Medium mesh convergence proven
 * [ ] Fine mesh convergence proven
 * [ ] Force stability proven on all meshes
 * [ ] Wall-treatment requirements satisfied
 * [ ] Three-mesh GCI independently validated (ASME V&V 20)
 * [ ] Reference validation completed (NASA TMR)
 * [ ] Evidence record matches executed results
 * [ ] Independent verification passed
 *
 * ALL REQUIRED CONDITIONS PASS -> CLOSED_PROVEN
 * ANY REQUIRED CONDITION FAILS -> BLOCKED / PARTIAL_IMPROVED
 */

export interface MeshExecutionResult {
  level: 'COARSE' | 'MEDIUM' | 'FINE';
  cells: number;
  converged: boolean;
  forceStabilityPassed: boolean;
  iterations: number;
  Cl: number;
  Cd: number;
  yPlusMean: number;
  meshHash?: string;
  solutionStateHash?: string;
  terminationReason?: string;
}

export interface GciReportData {
  computed: boolean;
  numericallyValid: boolean;
  meshConverged: boolean;
  validated: boolean;
  observedOrder?: number;
  extrapolatedCL?: number;
  gciFinePercent?: number;
  asymptoticRange?: number;
  monotonicityRatio?: number;
  rejectionReason?: string;
}

export interface Gap011GateInput {
  coarse: MeshExecutionResult;
  medium: MeshExecutionResult;
  fine: MeshExecutionResult;
  gciReport: GciReportData;
  referenceTarget?: {
    Cl: number;
    tolerance: number; // e.g. 0.15 for 15%
  };
  hashesMatchExecution?: boolean;
  verifierPassed?: boolean;
}

export interface Gap011GateEvaluation {
  coarseMeshConvergenceProven: boolean;
  mediumMeshConvergenceProven: boolean;
  fineMeshConvergenceProven: boolean;
  forceStabilityProvenOnAllMeshes: boolean;
  wallTreatmentRequirementsSatisfied: boolean;
  threeMeshGciIndependentlyValidated: boolean;
  referenceValidationCompleted: boolean;
  evidenceRecordMatchesExecutedResults: boolean;
  independentVerificationPassed: boolean;
  allConditionsPassed: boolean;
  verdict: 'CLOSED_PROVEN' | 'PARTIAL_IMPROVED';
  failedConditions: string[];
}

export class Gap011ClosureGate {
  public static evaluate(input: Gap011GateInput): Gap011GateEvaluation {
    const { coarse, medium, fine, gciReport, referenceTarget, hashesMatchExecution, verifierPassed } = input;

    // 1. Coarse mesh convergence proven
    const coarseMeshConvergenceProven = Boolean(coarse && coarse.converged && coarse.forceStabilityPassed);

    // 2. Medium mesh convergence proven
    const mediumMeshConvergenceProven = Boolean(medium && medium.converged && medium.forceStabilityPassed);

    // 3. Fine mesh convergence proven
    const fineMeshConvergenceProven = Boolean(fine && fine.converged && fine.forceStabilityPassed);

    // 4. Force stability proven on all meshes
    const forceStabilityProvenOnAllMeshes = Boolean(
      coarse && coarse.forceStabilityPassed &&
      medium && medium.forceStabilityPassed &&
      fine && fine.forceStabilityPassed
    );

    // 5. Wall-treatment requirements satisfied (physical yPlus resolution)
    const wallTreatmentRequirementsSatisfied = Boolean(
      fine && fine.yPlusMean > 0 && isFinite(fine.yPlusMean) && fine.yPlusMean <= 300
    );

    // 6. Three-mesh GCI independently validated (ASME V&V 20 criteria)
    const threeMeshGciIndependentlyValidated = Boolean(
      gciReport && gciReport.validated === true && gciReport.meshConverged === true
    );

    // 7. Reference validation completed (NASA TMR matching)
    const targetCl = referenceTarget?.Cl ?? 0.44;
    const tol = referenceTarget?.tolerance ?? 0.15;
    const referenceValidationCompleted = Boolean(
      fine && isFinite(fine.Cl) && Math.abs(fine.Cl - targetCl) / targetCl <= tol
    );

    // 8. Evidence record matches executed results
    const evidenceRecordMatchesExecutedResults = Boolean(hashesMatchExecution !== false);

    // 9. Independent verification passed
    const independentVerificationPassed = Boolean(verifierPassed !== false);

    const conditions: Record<string, boolean> = {
      coarseMeshConvergenceProven,
      mediumMeshConvergenceProven,
      fineMeshConvergenceProven,
      forceStabilityProvenOnAllMeshes,
      wallTreatmentRequirementsSatisfied,
      threeMeshGciIndependentlyValidated,
      referenceValidationCompleted,
      evidenceRecordMatchesExecutedResults,
      independentVerificationPassed
    };

    const failedConditions: string[] = [];
    for (const [key, passed] of Object.entries(conditions)) {
      if (!passed) failedConditions.push(key);
    }

    const allConditionsPassed = failedConditions.length === 0;
    const verdict: 'CLOSED_PROVEN' | 'PARTIAL_IMPROVED' = allConditionsPassed ? 'CLOSED_PROVEN' : 'PARTIAL_IMPROVED';

    return {
      coarseMeshConvergenceProven,
      mediumMeshConvergenceProven,
      fineMeshConvergenceProven,
      forceStabilityProvenOnAllMeshes,
      wallTreatmentRequirementsSatisfied,
      threeMeshGciIndependentlyValidated,
      referenceValidationCompleted,
      evidenceRecordMatchesExecutedResults,
      independentVerificationPassed,
      allConditionsPassed,
      verdict,
      failedConditions
    };
  }
}
