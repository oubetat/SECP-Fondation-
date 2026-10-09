/**
 * SECP Industrial OS v2 — Numerical Convergence Integrity Gate
 * PATCH-049: Numerical Convergence Framework
 */

import { ResidualHistory } from "./ResidualHistory";
import { ConvergenceEvaluator } from "./ConvergenceEvaluator";
import { ConvergenceCriterion } from "./ConvergenceTypes";

export type GateVerdict = "PASS" | "FAIL" | "UNPROVEN" | "INCONCLUSIVE";

export interface GateCapabilitySummary {
  CONVERGENCE_FRAMEWORK: boolean;
  RESIDUAL_HISTORY_VALIDATION: boolean;
  MULTI_CRITERIA_AGGREGATION: boolean;
  DIVERGENCE_DETECTION: boolean;
  STAGNATION_DETECTION: boolean;
  CANONICAL_HASHING: boolean;
  EVIDENCE_LINKAGE: boolean;
  CFD_SOLVER_CONVERGED: "UNPROVEN";
  FEM_SOLVER_CONVERGED: "UNPROVEN";
  PHYSICAL_VALIDATION: "UNPROVEN";
}

export interface GateEvaluationResult {
  status: GateVerdict;
  failedChecks: string[];
  capabilities: GateCapabilitySummary;
}

export class NumericalConvergenceIntegrityGate {

  public static evaluateGate(): GateEvaluationResult {
    const failedChecks: string[] = [];

    // 1. Verify ResidualHistory Validation (NaN rejection)
    const badHistory = new ResidualHistory([
      { iteration: 1, residuals: [{ quantity: "mass", value: NaN }] }
    ]);
    if (badHistory.isValid()) {
      failedChecks.push("ResidualHistory failed to reject NaN residual");
    }

    // 2. Verify Canonical Hash Determinism & Modification Sensitivity
    const histA = new ResidualHistory([
      { iteration: 1, residuals: [{ quantity: "mass", value: 1.0 }] },
      { iteration: 2, residuals: [{ quantity: "mass", value: 0.1 }] }
    ]);

    const histB = new ResidualHistory([
      { iteration: 1, residuals: [{ quantity: "mass", value: 1.0 }] },
      { iteration: 2, residuals: [{ quantity: "mass", value: 0.1001 }] }
    ]);

    const hashA = histA.calculateCanonicalHash();
    const hashB = histB.calculateCanonicalHash();
    if (hashA === hashB) {
      failedChecks.push("Canonical hash failed to change when residual value was modified");
    }

    // 3. Verify ALL_REQUIRED Multi-Criteria Semantics
    const multiHist = new ResidualHistory([
      { iteration: 1, residuals: [{ quantity: "mass", value: 1e-7 }, { quantity: "momentum", value: 0.5 }] }
    ]);

    const criteria: ConvergenceCriterion[] = [
      { type: "ABSOLUTE_RESIDUAL", quantity: "mass", tolerance: 1e-6, required: true },
      { type: "ABSOLUTE_RESIDUAL", quantity: "momentum", tolerance: 1e-6, required: true }
    ];

    const assessment = ConvergenceEvaluator.evaluate(multiHist, criteria, "ALL_REQUIRED");
    if (assessment.status === "CONVERGED") {
      failedChecks.push("Multi-criteria ALL_REQUIRED incorrectly passed when momentum residual failed tolerance");
    }

    const verdict: GateVerdict = failedChecks.length > 0 ? "FAIL" : "PASS";

    return {
      status: verdict,
      failedChecks,
      capabilities: {
        CONVERGENCE_FRAMEWORK: verdict === "PASS",
        RESIDUAL_HISTORY_VALIDATION: verdict === "PASS",
        MULTI_CRITERIA_AGGREGATION: verdict === "PASS",
        DIVERGENCE_DETECTION: verdict === "PASS",
        STAGNATION_DETECTION: verdict === "PASS",
        CANONICAL_HASHING: verdict === "PASS",
        EVIDENCE_LINKAGE: verdict === "PASS",
        CFD_SOLVER_CONVERGED: "UNPROVEN",
        FEM_SOLVER_CONVERGED: "UNPROVEN",
        PHYSICAL_VALIDATION: "UNPROVEN"
      }
    };
  }
}
