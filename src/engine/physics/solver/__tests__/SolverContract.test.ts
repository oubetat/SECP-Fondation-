/**
 * SECP Industrial OS v2 — Solver Contract Unit Tests
 * PATCH-048: Solver Contract
 */

import { describe, it, expect, beforeEach } from "vitest";
import { 
  SolverContract, 
  PhysicsDomain, 
  SolverRegistry, 
  SolverContractValidator, 
  SolverExecution, 
  SolverResult, 
  ConvergenceStatus,
  SolverContractIntegrityGate 
} from "../index";

describe("PATCH-048: Solver Contract Framework", () => {

  let registry: SolverRegistry;

  beforeEach(() => {
    registry = new SolverRegistry();
  });

  const validContract: SolverContract = {
    solverId: "SOLVER-CFD-01",
    solverVersion: "1.0.0",
    physicsDomain: PhysicsDomain.CFD,
    problemType: "NAVIER_STOKES_INCOMPRESSIBLE",
    supportedDimensions: ["2D", "3D"],
    supportedUnits: ["Pa", "m/s", "kg/m3", "K"],
    requiredInputs: ["FLUID_PROPERTIES"],
    meshRequirement: "REQUIRED",
    boundaryConditionRequirement: "REQUIRED",
    initialConditionRequirement: "OPTIONAL",
    materialRequirement: "REQUIRED",
    numericalMethod: "FINITE_VOLUME",
    convergenceCriteria: {
      tolerance: 1e-6,
      maxIterations: 1000,
      metric: "L2_NORM_RESIDUAL"
    },
    capabilities: [
      { capabilityId: "LAMINAR_FLOW", description: "Laminar incompressible flow", supported: true, verified: false }
    ],
    determinismPolicy: "DETERMINISTIC_REPLAY",
    reproducibilityPolicy: {
      mode: "DETERMINISTIC",
      requiredForQualification: true
    },
    outputDefinitions: [
      { fieldId: "velocity", name: "Velocity Vector", physicalQuantity: "VELOCITY", unit: "m/s", location: "ELEMENT", required: true },
      { fieldId: "pressure", name: "Static Pressure", physicalQuantity: "PRESSURE", unit: "Pa", location: "ELEMENT", required: true }
    ]
  };

  it("registers a valid contract successfully", () => {
    const res = registry.register(validContract);
    expect(res.success).toBe(true);
    expect(registry.has("SOLVER-CFD-01", "1.0.0")).toBe(true);
    expect(registry.get("SOLVER-CFD-01", "1.0.0")).toEqual(validContract);
  });

  it("rejects duplicate solver contract registration with same solverId and version", () => {
    registry.register(validContract);
    const dupRes = registry.register(validContract);
    expect(dupRes.success).toBe(false);
    expect(dupRes.error).toContain("Duplicate solver registration rejected");
  });

  it("detects missing required inputs in execution requests (Mesh, BCs, Materials)", () => {
    registry.register(validContract);

    const execReq = {
      problemDomain: PhysicsDomain.CFD,
      // Missing meshIdentity, boundaryConditionIdentity, materialIdentity
    };

    const valRes = SolverContractValidator.validateExecutionRequest(validContract, execReq);
    expect(valRes.valid).toBe(false);
    expect(valRes.status).toBe("MISMATCH");
    expect(valRes.errors.some(e => e.includes("Mesh is REQUIRED"))).toBe(true);
    expect(valRes.errors.some(e => e.includes("Boundary Conditions are REQUIRED"))).toBe(true);
    expect(valRes.errors.some(e => e.includes("Material Model is REQUIRED"))).toBe(true);
  });

  it("distinguishes supported = true from verified = true", () => {
    const unverifiedCap = validContract.capabilities[0];
    expect(unverifiedCap.supported).toBe(true);
    expect(unverifiedCap.verified).toBe(false); // Must not automatically become verified
  });

  it("validates convergence status integrity and residual requirements", () => {
    const resultNoResiduals: SolverResult = {
      resultId: "RES-01",
      executionId: "EXEC-01",
      solverId: "SOLVER-CFD-01",
      solverVersion: "1.0.0",
      status: "COMPLETED",
      convergenceStatus: ConvergenceStatus.CONVERGED, // Claims CONVERGED
      fields: { velocity: { unit: "m/s", location: "NODE", data: [1, 0, 0] } },
      residualHistory: [], // EMPTY residuals!
      warnings: [],
      errors: [],
      provenance: { solverId: "SOLVER-CFD-01", solverVersion: "1.0.0", timestamp: "2026-08-19", revision: "1" },
      evidenceStatus: "UNPROVEN"
    };

    const valRes = SolverContractValidator.validateResultIntegrity(resultNoResiduals);
    expect(valRes.valid).toBe(false);
    expect(valRes.errors.some(e => e.includes("claims CONVERGED, but no residual history evidence"))).toBe(true);
  });

  it("validates execution and result linkage", () => {
    const exec: SolverExecution = {
      executionId: "EXEC-100",
      solverId: "SOLVER-CFD-01",
      solverVersion: "1.0.0",
      problemId: "PROB-100",
      inputIdentity: "INP-HASH",
      executionClock: { startTime: 0, endTime: 10, timeUnit: "s" },
      executionMode: "SYNC",
      startedAt: "2026-08-19T00:00:00Z",
      completedAt: "2026-08-19T00:00:10Z",
      status: "COMPLETED"
    };

    const resValid: SolverResult = {
      resultId: "RES-100",
      executionId: "EXEC-100",
      solverId: "SOLVER-CFD-01",
      solverVersion: "1.0.0",
      status: "COMPLETED",
      convergenceStatus: ConvergenceStatus.CONVERGED,
      fields: { velocity: { unit: "m/s", location: "NODE", data: [1, 0, 0] } },
      residualHistory: [{ iteration: 1, residual: 1e-7 }],
      warnings: [],
      errors: [],
      provenance: { solverId: "SOLVER-CFD-01", solverVersion: "1.0.0", timestamp: "2026-08-19", revision: "1" },
      evidenceStatus: "UNPROVEN"
    };

    const valRes = SolverContractValidator.validateResultIntegrity(resValid, exec);
    expect(valRes.valid).toBe(true);
  });

  it("evaluates SolverContractIntegrityGate PASS for registered contracts", () => {
    registry.register(validContract);
    const gateRes = SolverContractIntegrityGate.evaluateGate(registry);
    expect(gateRes.status).toBe("PASS");
    expect(gateRes.capabilities.SOLVER_CONTRACT_FRAMEWORK).toBe(true);
    expect(gateRes.capabilities.CFD_SOLVER_EXECUTION).toBe("UNPROVEN");
    expect(gateRes.registeredSolversCount).toBe(1);
  });

});
