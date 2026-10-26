import { describe, it, expect } from "vitest";
import { MassMatrixEngine } from "../MassMatrixEngine";
import { ModalVerificationEngine } from "../ModalVerificationEngine";
import { FEMDOFManager } from "../../core/FEMDOFManager";
import { Bar1DFormulation } from "../../core/Bar1DFormulation";
import { Frame2DFormulation } from "../../core/Frame2DFormulation";
import { CST2DFormulation } from "../../core/CST2DFormulation";
import { Q42DFormulation } from "../../core/Q42DFormulation";
import { T62DFormulation } from "../../core/T62DFormulation";
import { TET43DFormulation } from "../../core/TET43DFormulation";
import { DOFComponent, FEMModel } from "../../core/FEMTypes";

describe("SECP-FEM-UPGRADE-007 — MassMatrixEngine Unit Tests", () => {
  const verifier = new ModalVerificationEngine();
  const massEngine = new MassMatrixEngine();

  it("should compute BAR_1D consistent and lumped mass matrices correctly", () => {
    const { model, formulations } = verifier.createAxialBarModel(1, 1000, 100, 210000, 7.85e-9);
    const dofManager = new FEMDOFManager();
    dofManager.buildDOFs(model, formulations);

    const elem = model.elements.get("elem_1")!;

    const consistentRes = massEngine.computeElementMassMatrix(elem, model, dofManager, "CONSISTENT");
    const lumpedRes = massEngine.computeElementMassMatrix(elem, model, dofManager, "LUMPED");

    // Total mass = rho * A * L = 7.85e-9 * 100 * 1000 = 7.85e-4
    const totalMass = 7.85e-4;

    // Check diagonal terms
    expect(consistentRes.Me.get(0, 0)).toBeCloseTo(totalMass / 3, 8);
    expect(consistentRes.Me.get(1, 1)).toBeCloseTo(totalMass / 3, 8);
    expect(consistentRes.Me.get(0, 1)).toBeCloseTo(totalMass / 6, 8);

    expect(lumpedRes.Me.get(0, 0)).toBeCloseTo(totalMass / 2, 8);
    expect(lumpedRes.Me.get(1, 1)).toBeCloseTo(totalMass / 2, 8);
    expect(lumpedRes.Me.get(0, 1)).toBe(0);
  });

  it("should compute FRAME_2D consistent mass matrix correctly", () => {
    const { model, formulations } = verifier.createCantileverBeamModel(1, 1000, 100, 833.333, 210000, 7.85e-9);
    const dofManager = new FEMDOFManager();
    dofManager.buildDOFs(model, formulations);

    const elem = model.elements.get("elem_1")!;
    const res = massEngine.computeElementMassMatrix(elem, model, dofManager, "CONSISTENT");

    expect(res.Me.rows).toBe(6);
    expect(res.Me.cols).toBe(6);

    const totalMass = 7.85e-4;
    // Axial term u1 = totalMass / 3
    expect(res.Me.get(0, 0)).toBeCloseTo(totalMass / 3, 8);
    // Bending term v1 = 156 * totalMass / 420
    expect(res.Me.get(1, 1)).toBeCloseTo((156 * totalMass) / 420, 8);
  });

  it("should throw error when material density is zero or negative", () => {
    const { model, formulations } = verifier.createAxialBarModel(1);
    model.materials.get("mat1")!.density = 0;

    const dofManager = new FEMDOFManager();
    dofManager.buildDOFs(model, formulations);

    const elem = model.elements.get("elem_1")!;

    expect(() => {
      massEngine.computeElementMassMatrix(elem, model, dofManager, "CONSISTENT");
    }).toThrow("[INVALID_DENSITY]");
  });

  it("should assemble global sparse mass matrix with total mass conservation", () => {
    const { model, formulations } = verifier.createAxialBarModel(4, 1000, 100, 210000, 7.85e-9);
    const dofManager = new FEMDOFManager();
    dofManager.buildDOFs(model, formulations);

    const M_sparse = massEngine.assembleSparseMassMatrix(model, dofManager, { type: "LUMPED" });

    let sumDiagonal = 0;
    for (let i = 0; i < dofManager.getTotalDOFCount(); i++) {
      sumDiagonal += M_sparse.get(i, i);
    }

    const expectedTotalMass = 7.85e-9 * 100 * 1000;
    expect(sumDiagonal).toBeCloseTo(expectedTotalMass, 8);
  });
});
