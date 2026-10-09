import { PropertySourceType } from "../types";
import { describe, expect, it } from "vitest";
import { 
  FatigueCurvesEngine, 
  FatigueUtils, 
  HardAcceptanceGate094, 
  generateReports094,
  FatigueVerdict
} from "../index";

describe("PATCH-094: Fatigue Curves Framework", () => {
  it("1. Fatigue Utils calculates parameters correctly", () => {
    const sigmaMax = 100e6;
    const sigmaMin = -100e6;
    expect(FatigueUtils.calculateAmplitude(sigmaMax, sigmaMin)).toBe(100e6);
    expect(FatigueUtils.calculateR(sigmaMax, sigmaMin)).toBe(-1);
    expect(FatigueUtils.calculateMeanStress(sigmaMax, sigmaMin)).toBe(0);
  });

  it("2. SN Curve Fitting and Prediction works", () => {
    const dataset = {
      datasetId: "TEST-DS",
      materialId: "TEST-MAT",
      materialRevision: 1,
      loadingMode: "Axial",
      stressRatio: -1,
      temperature: 293.15,
      environment: "Air",
      surfaceCondition: "Polished",
      provenance: { sourceId: 'Ref', sourceType: PropertySourceType.STANDARD, reference: 'ref', author: 'system', hash: 'hash', timestamp: "now" },
      points: [
        { amplitude: 500e6, cyclesToFailure: 1e4, isRunout: false },
        { amplitude: 300e6, cyclesToFailure: 1e6, isRunout: false }
      ]
    };

    const params = FatigueCurvesEngine.fitSNBasquin(dataset);
    expect(params.parameters.b).toBeLessThan(0);

    const prediction = FatigueCurvesEngine.predictLife(400e6, 0, params);
    expect(prediction.verdict).toBe(FatigueVerdict.VALID);
    expect(prediction.life).toBeGreaterThan(1e4);
    expect(prediction.life).toBeLessThan(1e6);
  });

  it("3. HardAcceptanceGate094 achieves PASS verdict", () => {
    const report = HardAcceptanceGate094.evaluateGate();
    expect(report.verdict).toBe("PASS");
  });

  it("4. generateReports094 executes without error", () => {
    expect(() => generateReports094()).not.toThrow();
  });
});
