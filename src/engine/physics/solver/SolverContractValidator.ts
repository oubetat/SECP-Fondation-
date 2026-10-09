/**
 * SECP Industrial OS v2 — Solver Contract Validator
 * PATCH-048: Solver Contract
 */

import { SolverContract, PhysicsDomain } from "./SolverTypes";
import { SolverExecution } from "./SolverExecution";
import { SolverResult, ConvergenceStatus } from "./SolverResult";

export interface SolverValidationResult {
  valid: boolean;
  status: "VALID" | "INVALID" | "MISMATCH" | "UNPROVEN";
  errors: string[];
  warnings: string[];
}

export interface ExecutionRequest {
  problemDomain?: PhysicsDomain;
  meshIdentity?: string;
  boundaryConditionIdentity?: string;
  initialConditionIdentity?: string;
  materialIdentity?: string;
  units?: string[];
}

export class SolverContractValidator {
  public static validateContract(contract: SolverContract): SolverValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!contract) {
      return {
        valid: false,
        status: "INVALID",
        errors: ["Contract is null or undefined"],
        warnings
      };
    }

    if (!contract.solverId || contract.solverId.trim() === "") {
      errors.push("Missing solverId");
    }
    if (!contract.solverVersion || contract.solverVersion.trim() === "") {
      errors.push("Missing solverVersion");
    }
    if (!contract.physicsDomain || !Object.values(PhysicsDomain).includes(contract.physicsDomain)) {
      errors.push(`Invalid or missing physicsDomain: ${contract.physicsDomain}`);
    }
    if (!contract.problemType || contract.problemType.trim() === "") {
      errors.push("Missing problemType");
    }
    if (!contract.supportedDimensions || !Array.isArray(contract.supportedDimensions) || contract.supportedDimensions.length === 0) {
      errors.push("supportedDimensions must be a non-empty array");
    }
    if (!contract.supportedUnits || !Array.isArray(contract.supportedUnits)) {
      errors.push("supportedUnits must be an array");
    }

    // Capability verification boundary
    if (contract.capabilities && Array.isArray(contract.capabilities)) {
      for (const cap of contract.capabilities) {
        if (!cap.capabilityId) {
          errors.push("Found solver capability with missing capabilityId");
        }
        if (cap.verified && (!contract.evidenceRequirements || contract.evidenceRequirements.length === 0)) {
          errors.push(`Capability '${cap.capabilityId}' claims verified=true without explicit evidenceRequirements`);
        }
      }
    }

    // Reproducibility policy
    if (!contract.reproducibilityPolicy || !contract.reproducibilityPolicy.mode) {
      errors.push("Missing reproducibilityPolicy or mode");
    }

    // Convergence criteria check
    if (contract.convergenceCriteria) {
      if (contract.convergenceCriteria.tolerance <= 0 || isNaN(contract.convergenceCriteria.tolerance)) {
        errors.push("convergenceCriteria.tolerance must be greater than 0");
      }
      if (contract.convergenceCriteria.maxIterations <= 0) {
        errors.push("convergenceCriteria.maxIterations must be greater than 0");
      }
    }

    // Output definitions check
    if (!contract.outputDefinitions || !Array.isArray(contract.outputDefinitions)) {
      errors.push("outputDefinitions must be an array");
    } else {
      for (const outDef of contract.outputDefinitions) {
        if (!outDef.fieldId || !outDef.name || !outDef.unit) {
          errors.push(`Malformed outputDefinition: ${JSON.stringify(outDef)}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      status: errors.length > 0 ? "INVALID" : "VALID",
      errors,
      warnings
    };
  }

  public static validateExecutionRequest(contract: SolverContract, request: ExecutionRequest): SolverValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Contract itself must be valid
    const contractVal = this.validateContract(contract);
    if (!contractVal.valid) {
      return contractVal;
    }

    // Physics Domain check
    if (request.problemDomain && request.problemDomain !== contract.physicsDomain) {
      errors.push(`Physics domain mismatch: Request expects ${request.problemDomain}, solver provides ${contract.physicsDomain}`);
    }

    // Mesh requirement check
    if (contract.meshRequirement === "REQUIRED" && (!request.meshIdentity || request.meshIdentity.trim() === "")) {
      errors.push(`Mesh is REQUIRED for solver ${contract.solverId} v${contract.solverVersion}, but none was provided`);
    }

    // Boundary Condition requirement check
    if (contract.boundaryConditionRequirement === "REQUIRED" && (!request.boundaryConditionIdentity || request.boundaryConditionIdentity.trim() === "")) {
      errors.push(`Boundary Conditions are REQUIRED for solver ${contract.solverId} v${contract.solverVersion}, but none were provided`);
    }

    // Initial Condition requirement check
    if (contract.initialConditionRequirement === "REQUIRED" && (!request.initialConditionIdentity || request.initialConditionIdentity.trim() === "")) {
      errors.push(`Initial Conditions are REQUIRED for solver ${contract.solverId} v${contract.solverVersion}, but none were provided`);
    }

    // Material requirement check
    if (contract.materialRequirement === "REQUIRED" && (!request.materialIdentity || request.materialIdentity.trim() === "")) {
      errors.push(`Material Model is REQUIRED for solver ${contract.solverId} v${contract.solverVersion}, but none was provided`);
    }

    // Units check
    if (request.units && Array.isArray(request.units)) {
      const unsupported = request.units.filter(u => !contract.supportedUnits.includes(u));
      if (unsupported.length > 0) {
        errors.push(`Unsupported units requested: ${unsupported.join(", ")}`);
      }
    }

    return {
      valid: errors.length === 0,
      status: errors.length > 0 ? "MISMATCH" : "VALID",
      errors,
      warnings
    };
  }

  public static validateResultIntegrity(result: SolverResult, execution?: SolverExecution, contract?: SolverContract): SolverValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!result) {
      return {
        valid: false,
        status: "INVALID",
        errors: ["Result object is null or undefined"],
        warnings
      };
    }

    if (!result.resultId || result.resultId.trim() === "") {
      errors.push("Missing resultId in SolverResult");
    }

    if (!result.executionId || result.executionId.trim() === "") {
      errors.push("Missing executionId in SolverResult");
    }

    // Match with execution if provided
    if (execution) {
      if (result.executionId !== execution.executionId) {
        errors.push(`Execution ID mismatch: Result executionId '${result.executionId}' != Execution executionId '${execution.executionId}'`);
      }
      if (result.solverId !== execution.solverId) {
        errors.push(`Solver ID mismatch: Result solverId '${result.solverId}' != Execution solverId '${execution.solverId}'`);
      }
      if (result.solverVersion !== execution.solverVersion) {
        errors.push(`Solver Version mismatch: Result solverVersion '${result.solverVersion}' != Execution solverVersion '${execution.solverVersion}'`);
      }
      if (execution.status === "COMPLETED" && (!result.fields || Object.keys(result.fields).length === 0)) {
        errors.push("Execution status is COMPLETED but SolverResult contains no output fields");
      }
    }

    // Convergence integrity
    if (result.convergenceStatus === ConvergenceStatus.CONVERGED) {
      if (!result.residualHistory || result.residualHistory.length === 0) {
        errors.push("Convergence status claims CONVERGED, but no residual history evidence was provided");
      }
    }

    // Evidence boundary: Solver result cannot certify itself as VERIFIED without external verification evidence
    if (result.evidenceStatus === "VERIFIED") {
      warnings.push("SolverResult claims evidenceStatus VERIFIED; verification must be certified by Verification Framework");
    }

    return {
      valid: errors.length === 0,
      status: errors.length > 0 ? "INVALID" : "VALID",
      errors,
      warnings
    };
  }
}
