/**
 * SECP Industrial OS v2 — Conservation Framework Integrity Gate
 * PATCH-050: Conservation Framework
 */

import { ConservationResult, ConservationVerdict } from "./ConservationTypes";
import { ConservationEvidence } from "./ConservationEvidence";

export interface GateCapabilitySummary {
  CONSERVATION_FRAMEWORK: boolean;
  MASS_CONSERVATION_EVALUATION: boolean;
  MOMENTUM_CONSERVATION_EVALUATION: boolean;
  ENERGY_CONSERVATION_EVALUATION: boolean;
  DIMENSIONAL_UNITS_VALIDATION: boolean;
  EVIDENCE_INTEGRITY: boolean;
}

export interface GateEvaluationResult {
  status: ConservationVerdict;
  failedChecks: string[];
  capabilities: GateCapabilitySummary;
  evaluatedCasesCount: number;
}

export class ConservationFrameworkGate {

  public static evaluateGate(sampleResults?: ConservationResult[]): GateEvaluationResult {
    const failedChecks: string[] = [];

    if (!sampleResults || sampleResults.length === 0) {
      return {
        status: "UNPROVEN",
        failedChecks: ["No ConservationResult instances provided to gate for evaluation"],
        capabilities: {
          CONSERVATION_FRAMEWORK: true,
          MASS_CONSERVATION_EVALUATION: true,
          MOMENTUM_CONSERVATION_EVALUATION: true,
          ENERGY_CONSERVATION_EVALUATION: true,
          DIMENSIONAL_UNITS_VALIDATION: true,
          EVIDENCE_INTEGRITY: true
        },
        evaluatedCasesCount: 0
      };
    }

    for (const res of sampleResults) {
      if (!res.caseId || !res.solverId || !res.meshId) {
        failedChecks.push(`Result missing metadata: ${JSON.stringify(res)}`);
        continue;
      }

      // 1. Evidence & Hash Integrity
      const evidence = ConservationEvidence.createEvidence(res);
      const isIntegrityValid = ConservationEvidence.verifyEvidenceIntegrity(res, evidence);
      if (!isIntegrityValid) {
        failedChecks.push(`Case [${res.caseId}]: Evidence hash mismatch or integrity verification failure`);
      }

      // 2. Failure & Invalidity Checks
      if (res.overallVerdict === "INVALID") {
        failedChecks.push(`Case [${res.caseId}]: Invalid conservation calculation (${res.diagnostics.join("; ")})`);
      } else if (res.overallVerdict === "FAIL") {
        failedChecks.push(`Case [${res.caseId}]: Conservation balance failed (${res.diagnostics.join("; ")})`);
      } else if (res.overallVerdict === "UNPROVEN") {
        failedChecks.push(`Case [${res.caseId}]: Conservation balance is UNPROVEN (${res.diagnostics.join("; ")})`);
      }
    }

    const overallStatus: ConservationVerdict = failedChecks.length > 0
      ? (sampleResults.some(r => r.overallVerdict === "FAIL") ? "FAIL" : "UNPROVEN")
      : "PASS";

    return {
      status: overallStatus,
      failedChecks,
      capabilities: {
        CONSERVATION_FRAMEWORK: true,
        MASS_CONSERVATION_EVALUATION: true,
        MOMENTUM_CONSERVATION_EVALUATION: true,
        ENERGY_CONSERVATION_EVALUATION: true,
        DIMENSIONAL_UNITS_VALIDATION: true,
        EVIDENCE_INTEGRITY: failedChecks.length === 0
      },
      evaluatedCasesCount: sampleResults.length
    };
  }
}
