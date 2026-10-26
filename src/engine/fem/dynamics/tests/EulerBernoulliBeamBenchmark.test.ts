import { describe, it, expect } from "vitest";
import { ModalVerificationEngine } from "../ModalVerificationEngine";

describe("SECP-FEM-UPGRADE-007 — EulerBernoulliBeamBenchmark Suite", () => {
  const verifier = new ModalVerificationEngine();

  it("should match analytical natural bending frequencies for 2D cantilever beam", () => {
    const L = 1000;
    const A = 100;
    const I = 833.333;
    const E = 210000;
    const rho = 7.85e-9;
    const N = 8; // 8 elements

    const { model, formulations } = verifier.createCantileverBeamModel(N, L, A, I, E, rho);
    const result = verifier.solveModal(model, formulations, "CONSISTENT");

    // Extract bending modes (filter out pure axial modes)
    const bendingModes = result.modes.filter(m => m.classification === "ELASTIC_MODE");

    // Mode 1 fundamental bending
    const f1_analytical = verifier.getCantileverBeamAnalyticalFrequency(1, L, A, I, E, rho);
    const f1_numerical = bendingModes[0].frequencyHz;

    const relErr1 = (Math.abs(f1_numerical - f1_analytical) / f1_analytical) * 100;
    expect(relErr1).toBeLessThan(1.0); // Excellent agreement (<1% error)

    // Mode 2 second bending mode
    const f2_analytical = verifier.getCantileverBeamAnalyticalFrequency(2, L, A, I, E, rho);
    const f2_numerical = bendingModes[1].frequencyHz;

    const relErr2 = (Math.abs(f2_numerical - f2_analytical) / f2_analytical) * 100;
    expect(relErr2).toBeLessThan(2.0);
  });

  it("should satisfy physical scaling laws (4K => 2f, 4M => f/2)", () => {
    const N = 4;
    const { model: modelBase, formulations } = verifier.createCantileverBeamModel(N);
    const resBase = verifier.solveModal(modelBase, formulations, "CONSISTENT");
    const fBase = resBase.modes[0].frequencyHz;

    // 1. Scale stiffness (E -> 4E)
    const { model: model4K } = verifier.createCantileverBeamModel(N, 1000, 100, 833.333, 210000 * 4, 7.85e-9);
    const res4K = verifier.solveModal(model4K, formulations, "CONSISTENT");
    const f4K = res4K.modes[0].frequencyHz;

    expect(f4K / fBase).toBeCloseTo(2.0, 4);

    // 2. Scale mass (rho -> 4rho)
    const { model: model4M } = verifier.createCantileverBeamModel(N, 1000, 100, 833.333, 210000, 7.85e-9 * 4);
    const res4M = verifier.solveModal(model4M, formulations, "CONSISTENT");
    const f4M = res4M.modes[0].frequencyHz;

    expect(f4M / fBase).toBeCloseTo(0.5, 4);
  });
});
