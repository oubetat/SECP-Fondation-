import { describe, expect, it } from "vitest";
import { DeformationGradient } from "../DeformationGradient";
import { PolarDecomposition } from "../PolarDecomposition";
import { StrainMeasures, StressMeasures } from "../StrainMeasures";
import { HardAcceptanceGate082 } from "../HardAcceptanceGate082";
import { Matrix } from "../../core/MathUtils";
import { generateReports082 } from "../generateReports082";

describe("PATCH-082: Large Deformation / Finite Kinematics Foundation", () => {

  it("1. DeformationGradient computes correct F and J for 2D homogeneous deformation", () => {
    const X = [[0, 0], [1, 0], [0, 1]];
    const x = [[0, 0], [2, 0], [0, 3]]; // Stretching: 2x in X, 3x in Y
    const dNdX = [[-1, -1], [1, 0], [0, 1]];

    const res = DeformationGradient.compute(X, x, dNdX);
    expect(res.F[0][0]).toBeCloseTo(2);
    expect(res.F[1][1]).toBeCloseTo(3);
    expect(res.F[0][1]).toBeCloseTo(0);
    expect(res.F[1][0]).toBeCloseTo(0);
    expect(res.J).toBeCloseTo(6);
  });

  it("2. PolarDecomposition extracts pure rotation R and stretch U", () => {
    const angle = Math.PI / 4; // 45 degrees
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    
    // F = R * U where U = diag(2, 1) and R = rot(45)
    // R = [c, -s; s, c], U = [2, 0; 0, 1]
    // F = [2c, -s; 2s, c]
    const F_data = [
      [2 * c, -s],
      [2 * s, c]
    ];

    const decomp = PolarDecomposition.decompose(F_data);
    const R = new Matrix(2, 2, decomp.R);
    const U = new Matrix(2, 2, decomp.U);

    expect(R.get(0, 0)).toBeCloseTo(c);
    expect(R.get(0, 1)).toBeCloseTo(-s);
    expect(U.get(0, 0)).toBeCloseTo(2);
    expect(U.get(1, 1)).toBeCloseTo(1);
    
    expect(() => PolarDecomposition.validateRotation(decomp.R)).not.toThrow();
  });

  it("3. Green-Lagrange strain is zero for pure rigid rotation", () => {
    const angle = 0.5;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const R_data = [[c, -s], [s, c]];

    const C = StrainMeasures.computeRightCauchyGreen(R_data);
    const E = StrainMeasures.computeGreenLagrange(C);

    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        expect(E.get(i, j)).toBeCloseTo(0, 10);
      }
    }
  });

  it("4. StressMeasures convert between Cauchy and PK2 correctly", () => {
    const F_data = [[2, 0], [0, 1]];
    const J = 2;
    const sigma_data = [[100, 0], [0, 50]]; // Cauchy stress
    
    // S = J * F^-1 * sigma * F^-T
    // Finv = [0.5, 0; 0, 1]
    // S = 2 * [0.5, 0; 0, 1] * [100, 0; 0, 50] * [0.5, 0; 0, 1]
    // S = 2 * [50, 0; 0, 50] * [0.5, 0; 0, 1]
    // S = [50, 0; 0, 100]
    
    const S = StressMeasures.cauchyToPK2(sigma_data, F_data, J);
    expect(S.get(0, 0)).toBeCloseTo(50);
    expect(S.get(1, 1)).toBeCloseTo(100);

    const sigma_back = StressMeasures.pk2ToCauchy(S, F_data, J);
    expect(sigma_back.get(0, 0)).toBeCloseTo(100);
    expect(sigma_back.get(1, 1)).toBeCloseTo(50);
  });

  it("5. HardAcceptanceGate082 passes all core kinematic checks", () => {
    const report = HardAcceptanceGate082.evaluateGate();
    expect(report.failedChecks).toBe(0);
    expect(report.verdict).toBe("VERIFIED");
  });

  it("6. generateReports082 produces forensic evidence reports", () => {
    expect(() => generateReports082()).not.toThrow();
  });
});
