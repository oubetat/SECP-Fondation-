/**
 * SECP Industrial OS v2 — Solver Adversarial Tests
 * PATCH-048: Solver Contract
 */

import { describe, it, expect } from "vitest";
import { 
  SolverContract, 
  PhysicsDomain, 
  SolverRegistry, 
  SolverContractValidator, 
  SolverExecution, 
  SolverResult, 
  ConvergenceStatus 
} from "../index";

describe("PATCH-048: Solver Adversarial Tests", () => {

  const baseContract: SolverContract = {
    solverId: "SOLVER-ADV-01",
    solverVersion: "1.0.0",
    physicsDomain: PhysicsDomain.CFD,
    problemType: "FLOW",
    supportedDimensions: ["3D"],
    supportedUnits: ["Pa", "m/s"],
    requiredInputs: ["GEOMETRY"],
    meshRequirement: "REQUIRED",
    boundaryConditionRequirement: "REQUIRED",
    initialConditionRequirement: "NONE",
    materialRequirement: "REQUIRED",
    numericalMethod: "FVM",
    capabilities: [
      { capabilityId: "TURBULENCE_K_EPSILON", description: "RANS k-epsilon", supported: true, verified: false }
    ],
    determinismPolicy: "STRICT",
    reproducibilityPolicy: { mode: "DETERMINISTIC", requiredForQualification: true },
    outputDefinitions: [
      { fieldId: "p", name: "Pressure", physicalQuantity: "PRESSURE", unit: "Pa", location: "ELEMENT", required: true }
    ]
  };

  it("1. rejects solver claiming verified=true without evidenceRequirements", () => {
    const invalidCapContract: SolverContract = {
      ...baseContract,
      capabilities: [
        { capabilityId: "TURBULENCE_K_EPSILON", description: "RANS k-epsilon", supported: true, verified: true } // Claimed verified!
      ],
      evidenceRequirements: [] // No evidence requirements!
    };

    const valRes = SolverContractValidator.validateContract(invalidCapContract);
    expect(valRes.valid).toBe(false);
    expect(valRes.errors.some(e => e.includes("claims verified=true without explicit evidenceRequirements"))).toBe(true);
  });

  it("2. rejects Result without executionId", () => {
    const badResult: SolverResult = {
      resultId: "RES-NOEXEC",
      executionId: "", // Missing
      solverId: "SOLVER-ADV-01",
      solverVersion: "1.0.0",
      status: "COMPLETED",
      convergenceStatus: ConvergenceStatus.CONVERGED,
      fields: { p: { unit: "Pa", location: "ELEMENT", data: [100] } },
      residualHistory: [{ iteration: 1, residual: 1e-7 }],
      warnings: [],
      errors: [],
      provenance: { solverId: "SOLVER-ADV-01", solverVersion: "1.0.0", timestamp: "2026-08-19", revision: "1" },
      evidenceStatus: "UNPROVEN"
    };

    const valRes = SolverContractValidator.validateResultIntegrity(badResult);
    expect(valRes.valid).toBe(false);
    expect(valRes.errors.some(e => e.includes("Missing executionId"))).toBe(true);
  });

  it("3. rejects Result from different solverVersion than execution", () => {
    const exec: SolverExecution = {
      executionId: "EXEC-01",
      solverId: "SOLVER-ADV-01",
      solverVersion: "1.0.0", // Exec version
      problemId: "PROB-01",
      inputIdentity: "INP-01",
      executionClock: { startTime: 0, timeUnit: "s" },
      executionMode: "SYNC",
      startedAt: "2026-08-19T00:00:00Z",
      status: "COMPLETED"
    };

    const resMismatch: SolverResult = {
      resultId: "RES-MISMATCH",
      executionId: "EXEC-01",
      solverId: "SOLVER-ADV-01",
      solverVersion: "2.0.0", // Mismatch version!
      status: "COMPLETED",
      convergenceStatus: ConvergenceStatus.CONVERGED,
      fields: { p: { unit: "Pa", location: "ELEMENT", data: [100] } },
      residualHistory: [{ iteration: 1, residual: 1e-7 }],
      warnings: [],
      errors: [],
      provenance: { solverId: "SOLVER-ADV-01", solverVersion: "2.0.0", timestamp: "2026-08-19", revision: "1" },
      evidenceStatus: "UNPROVEN"
    };

    const valRes = SolverContractValidator.validateResultIntegrity(resMismatch, exec);
    expect(valRes.valid).toBe(false);
    expect(valRes.errors.some(e => e.includes("Solver Version mismatch"))).toBe(true);
  });

  it("4. rejects execution request when Mesh identity is missing for mesh-required solver", () => {
    const valRes = SolverContractValidator.validateExecutionRequest(baseContract, {
      problemDomain: PhysicsDomain.CFD,
      meshIdentity: "", // Missing
      boundaryConditionIdentity: "BC-1",
      materialIdentity: "MAT-1"
    });

    expect(valRes.valid).toBe(false);
    expect(valRes.errors.some(e => e.includes("Mesh is REQUIRED"))).toBe(true);
  });

  it("5. rejects execution request when Material identity is missing for material-required solver", () => {
    const valRes = SolverContractValidator.validateExecutionRequest(baseContract, {
      problemDomain: PhysicsDomain.CFD,
      meshIdentity: "MESH-1",
      boundaryConditionIdentity: "BC-1",
      materialIdentity: "" // Missing
    });

    expect(valRes.valid).toBe(false);
    expect(valRes.errors.some(e => e.includes("Material Model is REQUIRED"))).toBe(true);
  });

  it("6. rejects execution request when Boundary Condition identity is missing for BC-required solver", () => {
    const valRes = SolverContractValidator.validateExecutionRequest(baseContract, {
      problemDomain: PhysicsDomain.CFD,
      meshIdentity: "MESH-1",
      boundaryConditionIdentity: "", // Missing
      materialIdentity: "MAT-1"
    });

    expect(valRes.valid).toBe(false);
    expect(valRes.errors.some(e => e.includes("Boundary Conditions are REQUIRED"))).toBe(true);
  });

  it("7. rejects CONVERGED status without residual evidence", () => {
    const resNoResiduals: SolverResult = {
      resultId: "RES-FAKECONV",
      executionId: "EXEC-01",
      solverId: "SOLVER-ADV-01",
      solverVersion: "1.0.0",
      status: "COMPLETED",
      convergenceStatus: ConvergenceStatus.CONVERGED,
      fields: { p: { unit: "Pa", location: "ELEMENT", data: [100] } },
      residualHistory: [], // EMPTY
      warnings: [],
      errors: [],
      provenance: { solverId: "SOLVER-ADV-01", solverVersion: "1.0.0", timestamp: "2026-08-19", revision: "1" },
      evidenceStatus: "UNPROVEN"
    };

    const valRes = SolverContractValidator.validateResultIntegrity(resNoResiduals);
    expect(valRes.valid).toBe(false);
    expect(valRes.errors.some(e => e.includes("claims CONVERGED, but no residual history evidence"))).toBe(true);
  });

  it("8. rejects COMPLETED execution status when result contains no fields", () => {
    const exec: SolverExecution = {
      executionId: "EXEC-01",
      solverId: "SOLVER-ADV-01",
      solverVersion: "1.0.0",
      problemId: "PROB-01",
      inputIdentity: "INP-01",
      executionClock: { startTime: 0, timeUnit: "s" },
      executionMode: "SYNC",
      startedAt: "2026-08-19T00:00:00Z",
      status: "COMPLETED"
    };

    const emptyResult: SolverResult = {
      resultId: "RES-EMPTY",
      executionId: "EXEC-01",
      solverId: "SOLVER-ADV-01",
      solverVersion: "1.0.0",
      status: "COMPLETED",
      convergenceStatus: ConvergenceStatus.NOT_ASSESSED,
      fields: {}, // EMPTY FIELDS!
      warnings: [],
      errors: [],
      provenance: { solverId: "SOLVER-ADV-01", solverVersion: "1.0.0", timestamp: "2026-08-19", revision: "1" },
      evidenceStatus: "UNPROVEN"
    };

    const valRes = SolverContractValidator.validateResultIntegrity(emptyResult, exec);
    expect(valRes.valid).toBe(false);
    expect(valRes.errors.some(e => e.includes("COMPLETED but SolverResult contains no output fields"))).toBe(true);
  });

  it("9. warns when SolverResult claims evidenceStatus VERIFIED without verification certification", () => {
    const unverifiedResult: SolverResult = {
      resultId: "RES-SELFVERIFIED",
      executionId: "EXEC-01",
      solverId: "SOLVER-ADV-01",
      solverVersion: "1.0.0",
      status: "COMPLETED",
      convergenceStatus: ConvergenceStatus.CONVERGED,
      fields: { p: { unit: "Pa", location: "ELEMENT", data: [100] } },
      residualHistory: [{ iteration: 1, residual: 1e-7 }],
      warnings: [],
      errors: [],
      provenance: { solverId: "SOLVER-ADV-01", solverVersion: "1.0.0", timestamp: "2026-08-19", revision: "1" },
      evidenceStatus: "VERIFIED" // Self-proclaimed verified
    };

    const valRes = SolverContractValidator.validateResultIntegrity(unverifiedResult);
    expect(valRes.warnings.some(w => w.includes("verification must be certified by Verification Framework"))).toBe(true);
  });

  it("10. rejects duplicate solver version registration in Registry", () => {
    const reg = new SolverRegistry();
    const res1 = reg.register(baseContract);
    expect(res1.success).toBe(true);

    const res2 = reg.register(baseContract); // Duplicate
    expect(res2.success).toBe(false);
    expect(res2.error).toContain("Duplicate solver registration rejected");
  });

  it("11. rejects malformed Contract passed to Registry", () => {
    const reg = new SolverRegistry();
    const malformedContract: any = {
      solverId: "SOLVER-BAD",
      solverVersion: "1.0.0",
      physicsDomain: "INVALID_DOMAIN", // Invalid domain
      supportedDimensions: [] // Empty
    };

    const res = reg.register(malformedContract);
    expect(res.success).toBe(false);
    expect(res.error).toContain("Contract validation failed");
  });

});
