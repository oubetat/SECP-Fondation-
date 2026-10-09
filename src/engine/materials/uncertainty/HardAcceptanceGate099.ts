import { 
  MaterialUncertaintyRecord, 
  UncertaintyType, 
  UncertaintyDistributionType,
  CovarianceMatrix,
  UncertaintyBudget,
  UncertaintyBudgetComponent,
  UncertaintySourceType,
  UncertaintyAwareDecisionRule
} from "./types";
import { MaterialUncertaintyEngine } from "./MaterialUncertaintyEngine";
import { IndependentMaterialUncertaintyAuditor } from "./IndependentMaterialUncertaintyAuditor";

export interface Gate099Report {
  verdict: "PASS" | "FAIL";
  checks: { id: string; passed: boolean; details: string }[];
}

export class HardAcceptanceGate099 {
  public static evaluateGate(): Gate099Report {
    const checks: { id: string; passed: boolean; details: string }[] = [];

    // 1. Setup sample high-quality valid Material Uncertainty Record
    const record: MaterialUncertaintyRecord = {
      uncertaintyId: "UNC-TI64-YIELD-01",
      quantityId: "YIELD-STRENGTH",
      value: 920.0, // MPa
      unit: "MPa",
      uncertaintyType: UncertaintyType.TYPE_A,
      distribution: {
        type: UncertaintyDistributionType.NORMAL,
        parameters: { mean: 920.0, stdDev: 5.5 },
        provenance: {
          sourceId: "TIMET-CERT-2026",
          sourceType: "EXPERIMENT" as any,
          reference: "Timet tensile log",
          timestamp: "2026-08-20T00:00:00Z",
          author: "J. Doe",
          hash: "a1b2c3d4e5"
        }
      },
      standardUncertainty: 5.5,
      expandedUncertainty: 11.0,
      coverageFactor: 2.0,
      coverageProbability: 0.95,
      source: 'Tensile repeatable test series',
      method: "Statistical evaluation u_A",
      validityDomain: { minTemp: -50, maxTemp: 350 },
      provenance: {
        sourceId: "TIMET-CERT-2026",
        sourceType: "EXPERIMENT" as any,
        reference: "Timet tensile log",
        timestamp: "2026-08-20T00:00:00Z",
        author: "J. Doe",
        hash: "a1b2c3d4e5"
      },
      revision: 1,
      timestamp: "2026-08-20T10:00:00Z",
      fingerprint: ""
    };

    record.fingerprint = MaterialUncertaintyEngine.calculateFingerprint(record);

    // 2. Setup uncertainty budget and verify GUM first-order propagation
    const comp1: UncertaintyBudgetComponent = {
      sourceId: "SRC-INSTRUMENT-LOADCELL",
      sourceType: UncertaintySourceType.INSTRUMENT,
      description: "Load cell calibration",
      value: 1.5,
      unit: "MPa",
      distributionType: UncertaintyDistributionType.NORMAL,
      sensitivityCoefficient: 1.0
    };

    const comp2: UncertaintyBudgetComponent = {
      sourceId: "SRC-SPECIMEN-DIAMETER",
      sourceType: UncertaintySourceType.SAMPLING,
      description: "Specimen gauge diameter variance",
      value: 2.0,
      unit: "MPa",
      distributionType: UncertaintyDistributionType.UNIFORM,
      sensitivityCoefficient: 1.0
    };

    const budget: UncertaintyBudget = {
      budgetId: "BUDGET-YIELD-01",
      measurand: "Yield Strength",
      unit: "MPa",
      components: [comp1, comp2],
      combinedUncertainty: 0,
      expandedUncertainty: 0,
      coverageFactor: 2,
      coverageProbability: 0.95,
      revision: 1,
      timestamp: "2026-08-20T10:00:00Z"
    };

    const u_c = MaterialUncertaintyEngine.propagateFirstOrder(budget);
    checks.push({
      id: "GUM_FIRST_ORDER_PROPAGATION_VALID",
      passed: Math.abs(u_c - Math.sqrt(1.5*1.5 + 2.0*2.0)) < 1e-5,
      details: "GUM first-order independent propagation matches calculated root-sum-square values"
    });

    // 3. Covariance Asymmetry Rejection
    const invalidCov: CovarianceMatrix = {
      dimensions: 2,
      labels: ["LoadCell", "Diameter"],
      matrix: [
        [1.0, 0.5],
        [0.1, 1.0] // Mismatched off-diagonals (0.5 vs 0.1)
      ],
      provenance: record.provenance
    };

    const covCheck = MaterialUncertaintyEngine.validateCovarianceMatrix(invalidCov);
    checks.push({
      id: "COVARIANCE_ASYMMETRY_REJECTION",
      passed: !covCheck.valid && covCheck.error?.includes("Asymmetric"),
      details: "Successfully detected and rejected asymmetric element in the covariance matrix"
    });

    // 4. Monte Carlo Seed Reproducibility
    const mcDist1 = { type: UncertaintyDistributionType.NORMAL, parameters: { mean: 10, stdDev: 1 }, provenance: record.provenance };
    const mcDist2 = { type: UncertaintyDistributionType.UNIFORM, parameters: { min: 2, max: 4 }, provenance: record.provenance };
    const model = (inputs: number[]) => inputs[0] * inputs[1];

    const mc1 = MaterialUncertaintyEngine.propagateMonteCarlo(42, 1000, [mcDist1, mcDist2], model);
    const mc2 = MaterialUncertaintyEngine.propagateMonteCarlo(42, 1000, [mcDist1, mcDist2], model);
    checks.push({
      id: "MONTE_CARLO_REPRODUCIBILITY",
      passed: mc1.mean === mc2.mean && mc1.stdDev === mc2.stdDev,
      details: "Monte Carlo deterministic seed generator ensures 100% reproducible mean and variance"
    });

    // 5. Guard-Band Conformity Check
    const rule: UncertaintyAwareDecisionRule = {
      ruleId: "RULE-AEROS-91",
      name: "Aerospace 91 Stringent Acceptance",
      acceptanceLimit: 900.0,
      rejectionLimit: 900.0,
      guardBand: 11.0, // Expanded uncertainty guard band
      decisionRuleType: "STRINGENT_ACCEPTANCE"
    };

    // Case A: measured = 905, limit = 900, expandedUnc = 11. Safe Pass requires >= 900+11 = 911 -> Should be INDETERMINATE
    const statusA = MaterialUncertaintyEngine.evaluateConformity(905.0, 11.0, 900.0, rule);
    checks.push({
      id: "GUARD_BAND_INDETERMINATE_EVALUATION",
      passed: statusA === "INDETERMINATE",
      details: "Successfully flagged measured value within uncertainty guard band as INDETERMINATE"
    });

    // Case B: measured = 920. Safe Pass (>= 911) -> Should be PASS
    const statusB = MaterialUncertaintyEngine.evaluateConformity(920.0, 11.0, 900.0, rule);
    checks.push({
      id: "GUARD_BAND_PASS_EVALUATION",
      passed: statusB === "PASS",
      details: "Successfully validated measured value above safe guard-band margin as PASS"
    });

    // 6. Independent Auditor Integration
    const auditorReport = IndependentMaterialUncertaintyAuditor.audit(record, budget, 920, 900);
    checks.push({
      id: "INDEPENDENT_AUDITOR_INTEGRATION_PASS",
      passed: auditorReport.verdict === "PASS",
      details: "Successfully verified the complete material uncertainty package under third-party independent audit checklist"
    });

    // 7. Double Counting Detection
    const duplicateBudget: UncertaintyBudget = {
      ...budget,
      components: [comp1, comp1] // duplicate instrument loadcell
    };
    const doubleCountingAuditorReport = IndependentMaterialUncertaintyAuditor.audit(record, duplicateBudget, 920, 900);
    checks.push({
      id: "DOUBLE_COUNTING_DETECTION",
      passed: doubleCountingAuditorReport.verdict === "FAIL" && 
              doubleCountingAuditorReport.checks.some(c => c.id === "DOUBLE_COUNTING_RISK_DETECTION" && !c.passed),
      details: "Successfully detected duplicate uncertainty sources and potential double counting in the budget"
    });

    const verdict = checks.every(c => c.passed) ? "PASS" : "FAIL";

    return { verdict, checks };
  }
}
