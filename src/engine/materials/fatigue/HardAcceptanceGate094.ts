import { PropertySourceType } from "../types";
import { FatigueCurvesEngine } from "./FatigueCurvesEngine";
import { FatigueDataset, FatigueCurveType, FatigueVerdict } from "./types";
import { IndependentFatigueAuditor } from "./IndependentFatigueAuditor";

export interface Gate094Report {
  verdict: string;
  checks: { id: string; passed: boolean; details: string }[];
}

export class HardAcceptanceGate094 {
  public static evaluateGate(): Gate094Report {
    const checks: { id: string; passed: boolean; details: string }[] = [];

    const mockDataset: FatigueDataset = {
      datasetId: "DS-4340-STEEL",
      materialId: "4340-STEEL",
      materialRevision: 1,
      loadingMode: "Axial",
      stressRatio: -1,
      temperature: 293.15,
      environment: "Air",
      surfaceCondition: "Polished",
      provenance: {
          sourceId: 'MIL-HDBK-5J', sourceType: PropertySourceType.STANDARD, reference: 'ref', author: 'system', hash: 'hash',
          timestamp: new Date().toISOString()
      },
      points: [
        { amplitude: 700e6, cyclesToFailure: 1e4, isRunout: false },
        { amplitude: 600e6, cyclesToFailure: 5e4, isRunout: false },
        { amplitude: 500e6, cyclesToFailure: 2e5, isRunout: false },
        { amplitude: 450e6, cyclesToFailure: 1e6, isRunout: false }
      ]
    };

    // 1. FITTING_VERIFICATION
    const params = FatigueCurvesEngine.fitSNBasquin(mockDataset);
    checks.push({
      id: "BASQUIN_FITTING_INTEGRITY",
      passed: params.parameters.sigmaF > 0 && params.parameters.b < 0,
      details: "Verified successful S-N curve fitting with physically consistent parameters"
    });

    // 2. PREDICTION_VERIFICATION
    const prediction = FatigueCurvesEngine.predictLife(550e6, 0, params);
    checks.push({
      id: "LIFE_PREDICTION_ACCURACY",
      passed: prediction.life > 1e4 && prediction.life < 2e5,
      details: "Verified that life prediction falls within expected range for interpolated stress"
    });

    // 3. MEAN_STRESS_CORRECTION_VERIFICATION
    // Goodman correction should reduce predicted life for tensile mean stress
    const predictionMean = FatigueCurvesEngine.predictLife(550e6, 100e6, params, 'GOODMAN', { S_ut: 1000e6 });
    checks.push({
      id: "MEAN_STRESS_CORRECTION_IMPACT",
      passed: predictionMean.life < prediction.life,
      details: "Verified that Goodman correction properly penalizes tensile mean stress"
    });

    // 4. INDEPENDENT_AUDIT
    const audit = IndependentFatigueAuditor.audit(mockDataset, params);
    checks.push({
      id: "INDEPENDENT_FATIGUE_AUDIT",
      passed: audit.verdict === "PASS",
      details: "Passed provenance and parameter physicality checks"
    });

    const verdict = checks.every(c => c.passed) ? "PASS" : "FAIL";
    return { verdict, checks };
  }
}
