import { describe, expect, it } from "vitest";
import { RainflowCycleCounter } from "../RainflowCycleCounter";
import { MeanStressCorrector } from "../MeanStressCorrector";
import { SNMaterialModelEngine } from "../SNMaterialModelEngine";
import { ENMaterialModelEngine } from "../ENMaterialModelEngine";
import { FatigueAnalysisEngine } from "../FatigueAnalysisEngine";
import { HardAcceptanceGate086 } from "../HardAcceptanceGate086";
import { generateReports086 } from "../generateReports086";
import { MeanStressCorrectionMethod, SNMaterialModel, ENMaterialModel, StressHistory, FatigueAnalysisModel, CycleCountingMethod, DamageRule } from "../types";

describe("PATCH-086: Fatigue Analysis Foundation", () => {
  it("1. RainflowCycleCounter correctly extracts turning points and counts cycles", () => {
    const rawHistory = [0, 100, 100, -50, -50, 150, 0];
    const turningPoints = RainflowCycleCounter.extractTurningPoints(rawHistory);
    expect(turningPoints).toEqual([0, 100, -50, 150, 0]);

    const cycles = RainflowCycleCounter.countCycles(turningPoints);
    expect(cycles.length).toBeGreaterThan(0);
    const totalCount = cycles.reduce((sum, c) => sum + c.count, 0);
    expect(totalCount).toBeGreaterThan(0);
  });

  it("2. MeanStressCorrector evaluates Goodman, Gerber, and Soderberg corrections correctly", () => {
    const goodman = MeanStressCorrector.correctMeanStress(150, 100, 600, undefined, MeanStressCorrectionMethod.GOODMAN);
    expect(goodman).toBeCloseTo(180.0, 4);

    const gerber = MeanStressCorrector.correctMeanStress(150, 100, 600, undefined, MeanStressCorrectionMethod.GERBER);
    expect(gerber).toBeCloseTo(154.2857, 3);

    const soderberg = MeanStressCorrector.correctMeanStress(150, 100, 600, 400, MeanStressCorrectionMethod.SODERBERG);
    expect(soderberg).toBeCloseTo(200.0, 4);
  });

  it("3. SNMaterialModelEngine computes exact Basquin life and log-log tabulated interpolation", () => {
    const basquinMat: SNMaterialModel = {
      materialId: "BASQUIN_STEEL",
      curveType: "BASQUIN",
      basquinParams: { sf_prime: 1000, b: -0.1 },
      uts: 600,
      units: "MPa"
    };

    const Nf = SNMaterialModelEngine.calculateCyclesToFailure(basquinMat, 300);
    const expectedNf = 0.5 * Math.pow(300 / 1000, -10);
    expect(Nf).toBeCloseTo(expectedNf, 2);

    const tabulatedMat: SNMaterialModel = {
      materialId: "TABULATED_STEEL",
      curveType: "TABULATED",
      curveData: [
        { stressAmplitude: 500, cyclesToFailure: 1000 },
        { stressAmplitude: 300, cyclesToFailure: 100000 },
        { stressAmplitude: 200, cyclesToFailure: 10000000 }
      ],
      uts: 600,
      units: "MPa"
    };

    const NfTab = SNMaterialModelEngine.calculateCyclesToFailure(tabulatedMat, 300);
    expect(NfTab).toBeCloseTo(100000, 1);
  });

  it("4. ENMaterialModelEngine solves Coffin-Manson relation accurately", () => {
    const enMat: ENMaterialModel = {
      materialId: "ALU_EN",
      sf_prime: 1000.0,
      b: -0.09,
      ef_prime: 0.5,
      c: -0.6,
      E: 200000.0,
      units: "MPa"
    };

    const res = ENMaterialModelEngine.calculateCyclesToFailure(enMat, 0.005);
    expect(res.cyclesToFailure).toBeGreaterThan(0);
    const totalStrain = res.elasticStrainAmplitude + res.plasticStrainAmplitude;
    expect(totalStrain).toBeCloseTo(0.005, 5);
  });

  it("5. FatigueAnalysisEngine performs hotspot analysis and cumulative Miner damage summation", () => {
    const snMat: SNMaterialModel = {
      materialId: "STEEL",
      curveType: "BASQUIN",
      basquinParams: { sf_prime: 1000, b: -0.1 },
      uts: 600,
      units: "MPa"
    };

    const h1: StressHistory = {
      locationId: "LOC_1",
      elementId: 1,
      integrationPoint: 1,
      time: [0, 1, 2],
      equivalentStress: [0, 200, 0],
      units: "MPa"
    };

    const h2: StressHistory = {
      locationId: "LOC_2",
      elementId: 2,
      integrationPoint: 1,
      time: [0, 1, 2],
      equivalentStress: [0, 400, 0],
      units: "MPa"
    };

    const model: FatigueAnalysisModel = {
      modelId: "FATIGUE_APP",
      meshId: "M1",
      fatigueMaterialModel: snMat,
      cycleCountingMethod: CycleCountingMethod.RAINFLOW,
      meanStressCorrection: MeanStressCorrectionMethod.GOODMAN,
      damageRule: DamageRule.LINEAR_MINER,
      units: "MPa"
    };

    const result = FatigueAnalysisEngine.evaluateModel(model, [h1, h2]);
    expect(result.hotspots.length).toBe(2);
    expect(result.hotspots[0].elementId).toBe(2);
    expect(result.damage).toBeGreaterThan(0);
  });

  it("6. HardAcceptanceGate086 evaluates and achieves VERIFIED verdict", () => {
    const report = HardAcceptanceGate086.evaluateGate();
    if (report.verdict !== "VERIFIED") {
      console.log("FAILED GATE CHECKS:", JSON.stringify(report.checks.filter(c => !c.passed), null, 2));
    }
    expect(report.verdict).toBe("VERIFIED");
  });

  it("7. generateReports086 produces forensic evidence package", () => {
    expect(() => generateReports086()).not.toThrow();
  });
});
