/**
 * SECP Industrial OS v2 — Convergence Evidence
 * PATCH-049: Numerical Convergence Framework
 */

import { ConvergenceAssessment, ConvergenceCriterion } from "./ConvergenceTypes";
import { ResidualHistory } from "./ResidualHistory";

export interface ConvergenceEvidenceRecord {
  evidenceId: string;
  patchId: "PATCH-049";
  solverId: string;
  solverVersion: string;
  executionId: string;
  residualHistoryHash: string;
  criteria: ConvergenceCriterion[];
  assessment: ConvergenceAssessment;
  evidenceStatus: "VERIFIED" | "UNPROVEN" | "INVALID";
  timestamp: string;
  provenance: {
    source: string;
    revision: string;
  };
}

export class ConvergenceEvidence {
  public static createEvidence(
    solverId: string,
    solverVersion: string,
    executionId: string,
    history: ResidualHistory,
    assessment: ConvergenceAssessment,
    criteria: ConvergenceCriterion[]
  ): ConvergenceEvidenceRecord {
    const hash = history.calculateCanonicalHash();

    return {
      evidenceId: `EVID-CONV-${executionId}`,
      patchId: "PATCH-049",
      solverId,
      solverVersion,
      executionId,
      residualHistoryHash: hash,
      criteria,
      assessment,
      evidenceStatus: assessment.status === "CONVERGED" ? "UNPROVEN" : "INVALID", // Numerical convergence alone is UNPROVEN for physical verification until certified by Verification Framework
      timestamp: new Date().toISOString(),
      provenance: {
        source: "SECP_NUMERICAL_CONVERGENCE_FRAMEWORK",
        revision: "1.0.0"
      }
    };
  }
}
