/**
 * SECP Industrial OS v2 — Solver Contract Integrity Gate
 * PATCH-048: Solver Contract
 */

import { SolverRegistry } from "./SolverRegistry";
import { SolverExecution } from "./SolverExecution";
import { SolverResult } from "./SolverResult";
import { SolverContractValidator } from "./SolverContractValidator";

export type GateVerdict = "PASS" | "FAIL" | "UNPROVEN" | "INCONCLUSIVE";

export interface GateCapabilitySummary {
  SOLVER_CONTRACT_FRAMEWORK: boolean;
  REGISTRY_INTEGRITY: boolean;
  CONTRACT_VALIDATION: boolean;
  CONVERGENCE_SEMANTICS: boolean;
  REPRODUCIBILITY_POLICY: boolean;
  EVIDENCE_BOUNDARY: boolean;
  CFD_SOLVER_EXECUTION: "UNPROVEN" | "IMPLEMENTED";
  FEM_SOLVER_EXECUTION: "UNPROVEN" | "IMPLEMENTED";
  PHYSICAL_VERIFICATION: "UNPROVEN" | "IMPLEMENTED";
}

export interface GateEvaluationResult {
  status: GateVerdict;
  failedChecks: string[];
  capabilities: GateCapabilitySummary;
  registeredSolversCount: number;
}

export class SolverContractIntegrityGate {
  public static evaluateGate(
    registry: SolverRegistry,
    sampleExecutions?: SolverExecution[],
    sampleResults?: SolverResult[]
  ): GateEvaluationResult {
    const failedChecks: string[] = [];

    // 1. Registry Integrity
    if (!registry) {
      return {
        status: "FAIL",
        failedChecks: ["SolverRegistry instance is missing or null"],
        capabilities: this.getCapabilities(false),
        registeredSolversCount: 0
      };
    }

    const contracts = registry.list();
    for (const contract of contracts) {
      const val = SolverContractValidator.validateContract(contract);
      if (!val.valid) {
        failedChecks.push(`Registry contains invalid contract [${contract.solverId} v${contract.solverVersion}]: ${val.errors.join(", ")}`);
      }
    }

    // 2. Execution / Result Linkage Checks
    if (sampleExecutions && sampleResults) {
      const execMap = new Map<string, SolverExecution>();
      for (const exec of sampleExecutions) {
        execMap.set(exec.executionId, exec);
      }

      for (const res of sampleResults) {
        const exec = execMap.get(res.executionId);
        const valRes = SolverContractValidator.validateResultIntegrity(res, exec);
        if (!valRes.valid) {
          failedChecks.push(`Result integrity failure [${res.resultId}]: ${valRes.errors.join(", ")}`);
        }
      }
    }

    const status: GateVerdict = failedChecks.length > 0 ? "FAIL" : "PASS";

    return {
      status,
      failedChecks,
      capabilities: this.getCapabilities(failedChecks.length === 0),
      registeredSolversCount: contracts.length
    };
  }

  private static getCapabilities(valid: boolean): GateCapabilitySummary {
    return {
      SOLVER_CONTRACT_FRAMEWORK: valid,
      REGISTRY_INTEGRITY: valid,
      CONTRACT_VALIDATION: valid,
      CONVERGENCE_SEMANTICS: valid,
      REPRODUCIBILITY_POLICY: valid,
      EVIDENCE_BOUNDARY: valid,
      CFD_SOLVER_EXECUTION: "UNPROVEN",
      FEM_SOLVER_EXECUTION: "UNPROVEN",
      PHYSICAL_VERIFICATION: "UNPROVEN"
    };
  }
}
