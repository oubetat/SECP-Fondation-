import { describe, it, expect } from "vitest";
import { ModalVerificationEngine } from "../ModalVerificationEngine";

describe("SECP-FEM-UPGRADE-007 — AxialBarModalBenchmark Suite", () => {
  const verifier = new ModalVerificationEngine();

  it("should match analytical natural frequencies for 1D cantilever axial bar", () => {
    const L = 1000;
    const E = 210000;
    const rho = 7.85e-9;
    const N = 8; // 8 elements

    const { model, formulations } = verifier.createAxialBarModel(N, L, 100, E, rho);
    const result = verifier.solveModal(model, formulations, "CONSISTENT");

    for (let m = 1; m <= 3; m++) {
      const analyticalFreq = verifier.getAxialBarAnalyticalFrequency(m, L, E, rho);
      const numericalFreq = result.modes[m - 1].frequencyHz;

      const relErrPercent = (Math.abs(numericalFreq - analyticalFreq) / analyticalFreq) * 100;

      // Consistent mass formulation upper bounds exact frequency, within 5% error for N=8 linear elements
      expect(relErrPercent).toBeLessThan(5.0);
    }
  });

  it("should demonstrate monotonic mesh convergence (N=4, N=8, N=16)", () => {
    const L = 1000;
    const E = 210000;
    const rho = 7.85e-9;
    const analyticalFreq1 = verifier.getAxialBarAnalyticalFrequency(1, L, E, rho);

    const meshSizes = [4, 8, 16];
    const errors: number[] = [];

    for (const N of meshSizes) {
      const { model, formulations } = verifier.createAxialBarModel(N, L, 100, E, rho);
      const result = verifier.solveModal(model, formulations, "CONSISTENT");

      const f1 = result.modes[0].frequencyHz;
      const err = Math.abs(f1 - analyticalFreq1);
      errors.push(err);
    }

    // Monotonic error reduction
    expect(errors[1]).toBeLessThan(errors[0]);
    expect(errors[2]).toBeLessThan(errors[1]);
  });
});
