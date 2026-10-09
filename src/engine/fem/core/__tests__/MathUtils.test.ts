import { describe, it, expect } from "vitest";
import { Matrix, solveLinearSystem } from "../MathUtils";

describe("MathUtils Matrix", () => {
  it("should multiply matrices correctly", () => {
    const a = new Matrix(2, 2, [
      [1, 2],
      [3, 4]
    ]);
    const b = new Matrix(2, 2, [
      [2, 0],
      [1, 2]
    ]);
    const c = a.multiply(b);
    expect(c.data).toEqual([
      [4, 4],
      [10, 8]
    ]);
  });

  it("should multiply matrix and vector correctly", () => {
    const a = new Matrix(2, 2, [
      [1, 2],
      [3, 4]
    ]);
    const res = a.multiplyVector([1, 2]);
    expect(res).toEqual([5, 11]);
  });

  it("should calculate determinant for up to 3x3", () => {
    const a = new Matrix(2, 2, [
      [4, 6],
      [3, 8]
    ]);
    expect(a.determinant()).toBe(14);
  });

  it("should detect symmetry correctly", () => {
    const a = new Matrix(3, 3, [
      [1, 2, 3],
      [2, 4, 5],
      [3, 5, 6]
    ]);
    expect(a.isSymmetric()).toBe(true);

    const b = new Matrix(2, 2, [
      [1, 2],
      [3, 4]
    ]);
    expect(b.isSymmetric()).toBe(false);
  });
});

describe("MathUtils solveLinearSystem", () => {
  it("should solve a 2x2 system correctly", () => {
    const A = new Matrix(2, 2, [
      [3, 2],
      [1, 2]
    ]);
    const B = [7, 5];
    const x = solveLinearSystem(A, B);
    // 3x + 2y = 7
    // x + 2y = 5
    // x = 1, y = 2
    expect(x[0]).toBeCloseTo(1);
    expect(x[1]).toBeCloseTo(2);
  });

  it("should throw on singular matrix", () => {
    const A = new Matrix(2, 2, [
      [1, 2],
      [2, 4]
    ]);
    expect(() => solveLinearSystem(A, [1, 2])).toThrow();
  });
});
