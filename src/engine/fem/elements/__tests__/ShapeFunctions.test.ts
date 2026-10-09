import { describe, expect, it } from "vitest";
import { ShapeFunctions } from "../ShapeFunctions";

describe("ShapeFunctions Suite", () => {
  it("verifies partition of unity for all element types", () => {
    const elements = ["BAR2", "TRI3", "QUAD4", "TET4", "HEX8"];
    for (const el of elements) {
      const pass = ShapeFunctions.testPartitionOfUnity(el);
      expect(pass).toBe(true);
    }
  });

  it("verifies nodal Kronecker delta property for all element types", () => {
    const elements = ["BAR2", "TRI3", "QUAD4", "TET4", "HEX8"];
    for (const el of elements) {
      const pass = ShapeFunctions.testNodalProperty(el);
      expect(pass).toBe(true);
    }
  });

  it("evaluates derivatives correctly for QUAD4", () => {
    const res = ShapeFunctions.quad4(0, 0);
    // At center (0,0), all N_i = 0.25
    expect(res.N).toEqual([0.25, 0.25, 0.25, 0.25]);
    // Sum of dN/dxi and dN/deta should be 0
    const sumDxi = res.dN_dxi.reduce((a, b) => a + b, 0);
    const sumDeta = res.dN_deta!.reduce((a, b) => a + b, 0);
    expect(Math.abs(sumDxi)).toBeLessThan(1e-12);
    expect(Math.abs(sumDeta)).toBeLessThan(1e-12);
  });

  it("evaluates derivatives correctly for HEX8", () => {
    const res = ShapeFunctions.hex8(0, 0, 0);
    expect(res.N.length).toBe(8);
    for (const val of res.N) {
      expect(val).toBeCloseTo(0.125, 10);
    }
    const sumDxi = res.dN_dxi.reduce((a, b) => a + b, 0);
    const sumDeta = res.dN_deta!.reduce((a, b) => a + b, 0);
    const sumDzeta = res.dN_dzeta!.reduce((a, b) => a + b, 0);
    expect(Math.abs(sumDxi)).toBeLessThan(1e-12);
    expect(Math.abs(sumDeta)).toBeLessThan(1e-12);
    expect(Math.abs(sumDzeta)).toBeLessThan(1e-12);
  });
});
