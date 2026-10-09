import { describe, expect, it } from "vitest";
import { Matrix } from "../../core/MathUtils";
import { MassMatrixModel } from "../MassMatrixModel";
import { EigenSolver } from "../EigenSolver";
import { ModalAnalysisEngine } from "../ModalAnalysisEngine";
import { HardAcceptanceGate084 } from "../HardAcceptanceGate084";
import { ModeClassification } from "../types";

describe("PATCH-084: Modal Analysis Foundation", () => {
  it("1. EigenSolver solves small generalized eigenproblem correctly", () => {
    // 2x2 system: K = [2, -1; -1, 1], M = [1, 0; 0, 1]
    // det(K - lambda M) = (2-L)(1-L) - 1 = 2 - 3L + L^2 - 1 = L^2 - 3L + 1 = 0
    // lambda = (3 +- sqrt(9 - 4))/2 = (3 +- sqrt(5))/2
    // L1 = 0.38196, L2 = 2.61803
    const K = new Matrix(2, 2, [[2, -1], [-1, 1]]);
    const M = new Matrix(2, 2, [[1, 0], [0, 1]]);
    
    const results = EigenSolver.solveGeneralized(K, M, 2);
    expect(results[0].eigenvalue).toBeCloseTo(0.38196, 4);
    expect(results[1].eigenvalue).toBeCloseTo(2.61803, 4);
  });

  it("2. ModalAnalysisEngine handles constraints and calculates frequencies", () => {
    const K = new Matrix(2, 2, [[2, -1], [-1, 1]]);
    const M = new Matrix(2, 2, [[1, 0], [0, 1]]);
    const bcs = new Map([[0, 0]]); // Fix node 0
    // Reduced system: K = [1], M = [1] -> lambda = 1 -> f = 1/(2pi) = 0.159 Hz
    
    const res = ModalAnalysisEngine.analyze(K, M, 1, bcs);
    expect(res.eigenPairs[0].eigenvalue).toBeCloseTo(1.0, 4);
    expect(res.eigenPairs[0].frequencyHz).toBeCloseTo(0.159, 3);
  });

  it("3. MassMatrixModel computes consistent mass for BAR", () => {
    const M = MassMatrixModel.computeBarConsistentMass(1.0, 1.0, 1.0);
    expect(M.get(0, 0)).toBeCloseTo(1/3, 4);
    expect(M.get(0, 1)).toBeCloseTo(1/6, 4);
  });

  it("4. HardAcceptanceGate084 passes all industrial modal checks", () => {
    const report = HardAcceptanceGate084.evaluateGate();
    expect(report.verdict).toBe("VERIFIED");
  });
});
