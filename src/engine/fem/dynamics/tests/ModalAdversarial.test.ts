import { describe, it, expect } from "vitest";
import { ModalVerificationEngine } from "../ModalVerificationEngine";
import { DOFComponent, FEMModel } from "../../core/FEMTypes";
import { MassMatrixEngine } from "../MassMatrixEngine";
import { FEMDOFManager } from "../../core/FEMDOFManager";

describe("SECP-FEM-UPGRADE-007 — Modal Adversarial Test Suite (ADV-MODAL-001..010)", () => {
  const verifier = new ModalVerificationEngine();
  const massEngine = new MassMatrixEngine();

  it("ADV-MODAL-001: Zero density material should throw descriptive error", () => {
    const { model, formulations } = verifier.createAxialBarModel(2);
    model.materials.get("mat1")!.density = 0;

    const dofManager = new FEMDOFManager();
    dofManager.buildDOFs(model, formulations);

    expect(() => {
      massEngine.assembleSparseMassMatrix(model, dofManager);
    }).toThrow("[INVALID_DENSITY]");
  });

  it("ADV-MODAL-002: Negative density material should throw descriptive error", () => {
    const { model, formulations } = verifier.createAxialBarModel(2);
    model.materials.get("mat1")!.density = -1.0;

    const dofManager = new FEMDOFManager();
    dofManager.buildDOFs(model, formulations);

    expect(() => {
      massEngine.assembleSparseMassMatrix(model, dofManager);
    }).toThrow("[INVALID_DENSITY]");
  });

  it("ADV-MODAL-003: Unconstrained structure should identify rigid body modes", () => {
    const { model, formulations } = verifier.createCantileverBeamModel(2);
    model.boundaryConditions = [];

    const result = verifier.solveModal(model, formulations, "CONSISTENT");
    const rigidModes = result.modes.filter(m => m.classification === "RIGID_BODY");

    expect(rigidModes.length).toBeGreaterThanOrEqual(3);
  });

  it("ADV-MODAL-004: Fully constrained structure should return 0 free DOFs cleanly", () => {
    const { model, formulations } = verifier.createAxialBarModel(2);
    // Fully constrain all nodes
    model.boundaryConditions = [
      { nodeId: "node_1", dof: DOFComponent.UX, value: 0 },
      { nodeId: "node_2", dof: DOFComponent.UX, value: 0 },
      { nodeId: "node_3", dof: DOFComponent.UX, value: 0 },
    ];

    const result = verifier.solveModal(model, formulations, "CONSISTENT");

    expect(result.freeDOFs).toBe(0);
    expect(result.modes.length).toBe(0);
  });

  it("ADV-MODAL-005: Incompatible formulation should throw descriptive error", () => {
    const { model, formulations } = verifier.createAxialBarModel(2);
    model.elements.get("elem_1")!.formulationId = "NON_EXISTENT_FORMULATION";

    expect(() => {
      verifier.solveModal(model, formulations, "CONSISTENT");
    }).toThrow("[ASSEMBLY_FORMULATION_ERROR]");
  });

  it("ADV-MODAL-006: Non-finite material Young's modulus should throw error", () => {
    const { model, formulations } = verifier.createAxialBarModel(2);
    model.materials.get("mat1")!.E = NaN;

    const dofManager = new FEMDOFManager();
    dofManager.buildDOFs(model, formulations);

    expect(() => {
      massEngine.assembleSparseMassMatrix(model, dofManager);
    }).toThrow("[INVALID_MATERIAL]");
  });

  it("ADV-MODAL-007: High density contrast should preserve orthogonality", () => {
    const { model, formulations } = verifier.createCantileverBeamModel(4);
    // Make element 1 extremely dense (10^4 factor)
    model.materials.set("heavyMat", {
      materialId: "heavyMat",
      E: 210000,
      nu: 0.3,
      density: 7.85e-9 * 1e4
    });
    model.elements.get("elem_1")!.materialId = "heavyMat";

    const result = verifier.solveModal(model, formulations, "CONSISTENT");

    expect(result.isOrthogonal).toBe(true);
    expect(result.maxMassOrthogonalityError).toBeLessThan(1e-4);
  });

  it("ADV-MODAL-008: Distorted geometry with zero length element should throw error", () => {
    const { model, formulations } = verifier.createAxialBarModel(2);
    // Coincide node 2 with node 1
    model.nodes.get("node_2")!.x = 0;

    const dofManager = new FEMDOFManager();
    dofManager.buildDOFs(model, formulations);

    expect(() => {
      massEngine.assembleSparseMassMatrix(model, dofManager);
    }).toThrow("[ZERO_LENGTH_ELEMENT]");
  });

  it("ADV-MODAL-010: Lumped vs Consistent mass matrix both yield positive frequencies", () => {
    const { model, formulations } = verifier.createCantileverBeamModel(4);

    const resConsistent = verifier.solveModal(model, formulations, "CONSISTENT");
    const resLumped = verifier.solveModal(model, formulations, "LUMPED");

    expect(resConsistent.modes[0].frequencyHz).toBeGreaterThan(0);
    expect(resLumped.modes[0].frequencyHz).toBeGreaterThan(0);

    // Consistent mass upper bounds exact, lumped mass lower bounds exact
    expect(resConsistent.modes[0].frequencyHz).toBeGreaterThan(resLumped.modes[0].frequencyHz);
  });
});
