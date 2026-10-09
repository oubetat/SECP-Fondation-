import { describe, expect, it } from "vitest";
import { 
  MaterialUncertaintyEngine, 
  IndependentMaterialUncertaintyAuditor, 
  HardAcceptanceGate099, 
  generateReports099,
  UncertaintyType,
  UncertaintyDistributionType,
  UncertaintyBudget,
  UncertaintySourceType
} from "../uncertainty/index";

describe("PATCH-099: Material Uncertainty & Propagation", () => {
  it("1. MaterialUncertaintyEngine propagates first-order independent components correctly", () => {
    const budget: UncertaintyBudget = {
      budgetId: "BUDGET-TEST-1",
      measurand: "Yield Strength",
      unit: "MPa",
      components: [
        {
          sourceId: "S1",
          sourceType: UncertaintySourceType.INSTRUMENT,
          description: "u_1",
          value: 3.0,
          unit: "MPa",
          distributionType: UncertaintyDistributionType.NORMAL,
          sensitivityCoefficient: 1.0
        },
        {
          sourceId: "S2",
          sourceType: UncertaintySourceType.SAMPLING,
          description: "u_2",
          value: 4.0,
          unit: "MPa",
          distributionType: UncertaintyDistributionType.NORMAL,
          sensitivityCoefficient: 1.0
        }
      ],
      combinedUncertainty: 0,
      expandedUncertainty: 0,
      coverageFactor: 2,
      coverageProbability: 0.95,
      revision: 1,
      timestamp: "2026-08-20T00:00:00Z"
    };

    const u_c = MaterialUncertaintyEngine.propagateFirstOrder(budget);
    expect(u_c).toBe(5.0); // sqrt(3^2 + 4^2) = 5
  });

  it("2. MaterialUncertaintyEngine rejects non-symmetric covariance matrix", () => {
    const cov = {
      dimensions: 2,
      labels: ["X", "Y"],
      matrix: [
        [1.0, 0.5],
        [0.1, 1.0] // mismatched off-diagonals
      ],
      provenance: { sourceId: "x", sourceType: "EXPERIMENT" as any, reference: "x", timestamp: "x", author: "x", hash: "x" }
    };

    const check = MaterialUncertaintyEngine.validateCovarianceMatrix(cov);
    expect(check.valid).toBe(false);
    expect(check.error).toContain("Asymmetric");
  });

  it("3. Monte Carlo generator ensures deterministic reproducibility via fixed seed", () => {
    const dist1 = { type: UncertaintyDistributionType.NORMAL, parameters: { mean: 100, stdDev: 5 }, provenance: { sourceId: "x", sourceType: "EXPERIMENT" as any, reference: "x", timestamp: "x", author: "x", hash: "x" } };
    const model = (inputs: number[]) => inputs[0] * 2.0;

    const run1 = MaterialUncertaintyEngine.propagateMonteCarlo(1337, 500, [dist1], model);
    const run2 = MaterialUncertaintyEngine.propagateMonteCarlo(1337, 500, [dist1], model);

    expect(run1.mean).toBe(run2.mean);
    expect(run1.stdDev).toBe(run2.stdDev);
  });

  it("4. Hard Acceptance Gate evaluates to PASS", () => {
    const gate = HardAcceptanceGate099.evaluateGate();
    expect(gate.verdict).toBe("PASS");
  });

  it("5. generateReports099 executes cleanly without throwing errors", () => {
    expect(() => generateReports099()).not.toThrow();
  });
});
