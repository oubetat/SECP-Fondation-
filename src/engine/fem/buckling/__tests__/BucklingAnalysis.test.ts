import { describe, expect, it } from "vitest";
import { GeometricStiffnessModel } from "../GeometricStiffnessModel";
import { BucklingAnalysisEngine } from "../BucklingAnalysisEngine";
import { HardAcceptanceGate085 } from "../HardAcceptanceGate085";
import { generateReports085 } from "../generateReports085";

describe("PATCH-085: Buckling Analysis Foundation", () => {
  it("1. GeometricStiffnessModel computes valid beam elastic and geometric matrices", () => {
    const Ke = GeometricStiffnessModel.computeBeamElasticStiffness(200e9, 0.01, 1e-6, 1.0);
    expect(Ke.rows).toBe(6);
    expect(Ke.get(0, 0)).toBeCloseTo(2e9, -5);

    const KGe = GeometricStiffnessModel.computeBeamGeometricStiffness(1000.0, 1.0);
    expect(KGe.rows).toBe(6);
    expect(KGe.get(1, 1)).toBeCloseTo(1200.0, 4); // 36 * 1000 / 30 = 1200
  });

  it("2. HardAcceptanceGate085 passes all analytical Euler buckling benchmarks", () => {
    const report = HardAcceptanceGate085.evaluateGate();
    if (report.verdict !== "VERIFIED") {
      console.log("FAILED CHECKS:", JSON.stringify(report.checks.filter(c => !c.passed), null, 2));
    }
    expect(report.verdict).toBe("VERIFIED");
  });

  it("3. generateReports085 produces forensic evidence", () => {
    expect(() => generateReports085()).not.toThrow();
  });
});
