import { describe, expect, it } from "vitest";
import { IntegrationEngine } from "../IntegrationEngine";

describe("IntegrationEngine Suite", () => {
  it("initializes and lists all default rules", () => {
    const rules = IntegrationEngine.listRules();
    expect(rules.length).toBeGreaterThanOrEqual(8);
  });

  it("integrates polynomials accurately in 1D", () => {
    // Integral of (3x^2 - 2x + 1) on [-1, 1]
    // = [x^3 - x^2 + x]_{-1}^1 = (1 - 1 + 1) - (-1 - 1 - 1) = 1 - (-3) = 4
    const res = IntegrationEngine.integrate1D((x) => 3 * x * x - 2 * x + 1, "GAUSS_1D_2PT");
    expect(res).toBeCloseTo(4.0, 10);
  });

  it("integrates in 2D quadrilaterals", () => {
    // Integral of (x^2 + y^2) on [-1, 1]^2
    // = integral_{-1}^1 (x^2*2 + 2/3) dx = (2/3*2 + 4/3) = 8/3 ≈ 2.6666666667
    const res = IntegrationEngine.integrate2D((x, y) => x * x + y * y, "GAUSS_QUAD_2X2");
    expect(res).toBeCloseTo(8 / 3, 10);
  });

  it("integrates in 3D hexahedra", () => {
    // Integral of (1) on [-1, 1]^3 = 8
    const res = IntegrationEngine.integrate3D(() => 1.0, "GAUSS_HEX_2X2X2");
    expect(res).toBeCloseTo(8.0, 10);

    // Integral of (x^2 + y^2 + z^2) on [-1, 1]^3 = 3 * ( (2/3) * 2 * 2 ) = 3 * (8/3) = 8
    const resPoly = IntegrationEngine.integrate3D((x, y, z) => x * x + y * y + z * z, "GAUSS_HEX_2X2X2");
    expect(resPoly).toBeCloseTo(8.0, 10);
  });
});
