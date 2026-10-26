import { describe, it, expect } from "vitest";
import { ModalVerificationEngine } from "../ModalVerificationEngine";

describe("SECP-FEM-UPGRADE-007 — StructuralModalSolver Unit Tests", () => {
  const verifier = new ModalVerificationEngine();

  it("should solve modal frequencies and verify mass/stiffness orthogonality", () => {
    const { model, formulations } = verifier.createCantileverBeamModel(4, 1000, 100, 833.333, 210000, 7.85e-9);
    const result = verifier.solveModal(model, formulations, "CONSISTENT");

    expect(result.modes.length).toBeGreaterThan(0);
    expect(result.modes[0].frequencyHz).toBeGreaterThan(0);
    expect(result.maxMassOrthogonalityError).toBeLessThan(1e-4);
    expect(result.maxStiffnessOrthogonalityError).toBeLessThan(1e-4);
    expect(result.isOrthogonal).toBe(true);
  });

  it("should classify modes cleanly as ELASTIC_MODE when properly constrained", () => {
    const { model, formulations } = verifier.createCantileverBeamModel(4);
    const result = verifier.solveModal(model, formulations, "CONSISTENT");

    for (const mode of result.modes) {
      expect(mode.classification).toBe("ELASTIC_MODE");
      expect(mode.relativeResidual).toBeLessThan(1e-4);
    }
  });

  it("should detect rigid body modes for unconstrained structure", () => {
    const { model, formulations } = verifier.createCantileverBeamModel(4);
    // Remove all boundary conditions
    model.boundaryConditions = [];

    const result = verifier.solveModal(model, formulations, "CONSISTENT");

    const rigidModes = result.modes.filter(m => m.classification === "RIGID_BODY");
    // 2D beam unconstrained has 3 rigid body modes (2 translation, 1 rotation)
    expect(rigidModes.length).toBeGreaterThanOrEqual(3);
    expect(rigidModes[0].frequencyHz).toBeLessThan(1e-2);
  });
});
