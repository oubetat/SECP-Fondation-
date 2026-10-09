import { describe, expect, it } from "vitest";
import { BAR2Element } from "../BAR2Element";
import { HEX8Element } from "../HEX8Element";
import { QUAD4Element } from "../QUAD4Element";
import { TET4Element } from "../TET4Element";
import { TRI3Element } from "../TRI3Element";
import { MaterialProperties } from "../types";

describe("Elements Formulations Suite", () => {
  const mat1D: MaterialProperties = { E: 200e9, area: 0.01 };
  const mat2D: MaterialProperties = { E: 210e9, nu: 0.3, thickness: 0.01 };
  const mat3D: MaterialProperties = { E: 210e9, nu: 0.3 };

  it("BAR2 computes derived 1D stiffness accurately", () => {
    const coords = [[0], [2]]; // L=2
    const res = BAR2Element.computeStiffness("b1", coords, mat1D);
    // Ke = EA/L = (200e9 * 0.01) / 2 = 1e9
    expect(res.stiffnessMatrix.rows).toBe(2);
    expect(res.stiffnessMatrix.get(0, 0)).toBeCloseTo(1e9, 0);
    expect(res.stiffnessMatrix.get(0, 1)).toBeCloseTo(-1e9, 0);
  });

  it("TRI3 CST computes 6x6 symmetric stiffness", () => {
    const coords = [[0, 0], [1, 0], [0, 1]];
    const res = TRI3Element.computeStiffness("t1", coords, mat2D);
    expect(res.stiffnessMatrix.rows).toBe(6);
    expect(res.stiffnessMatrix.cols).toBe(6);
    expect(res.stiffnessMatrix.isSymmetric(1e-6)).toBe(true);
  });

  it("QUAD4 computes 8x8 symmetric stiffness via Gauss integration", () => {
    const coords = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const res = QUAD4Element.computeStiffness("q1", coords, mat2D);
    expect(res.stiffnessMatrix.rows).toBe(8);
    expect(res.stiffnessMatrix.cols).toBe(8);
    expect(res.stiffnessMatrix.isSymmetric(1e-6)).toBe(true);
  });

  it("TET4 computes 12x12 symmetric stiffness", () => {
    const coords = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const res = TET4Element.computeStiffness("tet1", coords, mat3D);
    expect(res.stiffnessMatrix.rows).toBe(12);
    expect(res.stiffnessMatrix.cols).toBe(12);
    expect(res.stiffnessMatrix.isSymmetric(1e-6)).toBe(true);
  });

  it("HEX8 computes 24x24 symmetric stiffness via 2x2x2 Gauss integration", () => {
    const coords = [
      [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
      [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]
    ];
    const res = HEX8Element.computeStiffness("hex1", coords, mat3D);
    expect(res.stiffnessMatrix.rows).toBe(24);
    expect(res.stiffnessMatrix.cols).toBe(24);
    expect(res.stiffnessMatrix.isSymmetric(1e-6)).toBe(true);
  });
});
