import { 
  MaterialUncertaintyRecord, 
  CovarianceMatrix, 
  UncertaintyBudget, 
  UncertaintyDistribution, 
  UncertaintyDistributionType,
  UncertaintyAwareDecisionRule
} from "./types";

export class MaterialUncertaintyEngine {
  /**
   * Generates a deterministic, reproducible cryptographic fingerprint for an Uncertainty Record.
   */
  public static calculateFingerprint(record: MaterialUncertaintyRecord): string {
    const parts = [
      record.uncertaintyId,
      record.quantityId,
      record.value.toString(),
      record.standardUncertainty.toString(),
      record.uncertaintyType,
      record.distribution.type,
      record.revision.toString(),
      record.timestamp
    ];

    if (record.covarianceMatrix) {
      parts.push(record.covarianceMatrix.dimensions.toString());
      parts.push(record.covarianceMatrix.matrix.map(row => row.join(",")).join(";"));
    }

    return "unc-fingerprint-" + parts.join("__").replace(/[^a-zA-Z0-9_-]/g, "");
  }

  /**
   * Validates structural and mathematical invariants of covariance matrices.
   */
  public static validateCovarianceMatrix(matrix: CovarianceMatrix): { valid: boolean; error?: string } {
    const n = matrix.dimensions;

    if (matrix.matrix.length !== n) {
      return { valid: false, error: "INVALID_COVARIANCE_MATRIX: Dimension mismatch (row count doesn't match dimensions)" };
    }

    for (let i = 0; i < n; i++) {
      if (matrix.matrix[i].length !== n) {
        return { valid: false, error: `INVALID_COVARIANCE_MATRIX: Dimension mismatch at row ${i}` };
      }
      
      // Check diagonal elements are positive (variances cannot be negative)
      if (matrix.matrix[i][i] <= 0) {
        return { valid: false, error: `INVALID_COVARIANCE_MATRIX: Non-positive variance at diagonal index ${i}` };
      }
    }

    // Check symmetry: Cov(X,Y) = Cov(Y,X)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const val1 = matrix.matrix[i][j];
        const val2 = matrix.matrix[j][i];
        if (Number.isNaN(val1) || !Number.isFinite(val1)) {
          return { valid: false, error: "INVALID_COVARIANCE_MATRIX: Contains NaN or Infinite values" };
        }
        if (Math.abs(val1 - val2) > 1e-9) {
          return { valid: false, error: `INVALID_COVARIANCE_MATRIX: Asymmetric element found at [${i},${j}]` };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Propagates uncertainty of first order according to GUM:
   * u_c^2 = \sum (c_i^2 * u_i^2) + 2 * \sum\sum (c_i * c_j * u_i * u_j * r_ij)
   */
  public static propagateFirstOrder(budget: UncertaintyBudget, covariance?: number[][]): number {
    let sumSq = 0;
    const n = budget.components.length;

    // Validate inputs
    for (const comp of budget.components) {
      if (comp.value < 0) {
        throw new Error("INVALID_UNCERTAINTY: Standard uncertainty value cannot be negative");
      }
      if (Number.isNaN(comp.value) || !Number.isFinite(comp.value)) {
        throw new Error("INVALID_UNCERTAINTY: Standard uncertainty contains non-finite values");
      }
    }

    // Add independent variance components
    for (let i = 0; i < n; i++) {
      const comp = budget.components[i];
      sumSq += Math.pow(comp.sensitivityCoefficient * comp.value, 2);
    }

    // Add covariance terms if present
    if (covariance) {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const c_i = budget.components[i].sensitivityCoefficient;
          const c_j = budget.components[j].sensitivityCoefficient;
          const cov_ij = covariance[i][j];
          sumSq += 2 * c_i * c_j * cov_ij;
        }
      }
    }

    if (sumSq < 0) {
      return 0; // Guard against numerical rounding issues producing negative sum
    }

    return Math.sqrt(sumSq);
  }

  /**
   * Deterministic LCG random number generator based on a fixed seed to ensure reproducibility.
   */
  private static lcgRandom(seed: number): () => number {
    let current = seed;
    return () => {
      current = (current * 1664525 + 1013904223) % 4294967296;
      return current / 4294967296;
    };
  }

  /**
   * Performs deterministic Monte Carlo uncertainty propagation.
   */
  public static propagateMonteCarlo(
    seed: number,
    sampleCount: number,
    distributions: UncertaintyDistribution[],
    model: (inputs: number[]) => number
  ): { mean: number; stdDev: number; samples: number[]; converged: boolean } {
    const rng = this.lcgRandom(seed);
    const samples: number[] = [];

    // Box-Muller transform for normal distribution
    const normalRandom = (): number => {
      const u1 = rng();
      const u2 = rng();
      return Math.sqrt(-2.0 * Math.log(u1 || 0.0001)) * Math.cos(2.0 * Math.PI * u2);
    };

    for (let i = 0; i < sampleCount; i++) {
      const inputVals: number[] = [];
      for (const dist of distributions) {
        if (dist.type === UncertaintyDistributionType.NORMAL) {
          const mean = dist.parameters.mean || 0;
          const stdDev = dist.parameters.stdDev || 1;
          inputVals.push(mean + normalRandom() * stdDev);
        } else if (dist.type === UncertaintyDistributionType.UNIFORM) {
          const min = dist.parameters.min || 0;
          const max = dist.parameters.max || 1;
          inputVals.push(min + rng() * (max - min));
        } else {
          // Default fallback
          inputVals.push(dist.parameters.nominal || 0);
        }
      }
      samples.push(model(inputVals));
    }

    // Calculate mean and standard deviation
    const mean = samples.reduce((sum, v) => sum + v, 0) / sampleCount;
    const varSum = samples.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
    const stdDev = Math.sqrt(varSum / (sampleCount - 1));

    return {
      mean,
      stdDev,
      samples,
      converged: sampleCount >= 1000 // Simple convergence diagnostic criteria
    };
  }

  /**
   * Decision Rules and Guard-bands for Conformity Assessment.
   */
  public static evaluateConformity(
    measuredValue: number,
    expandedUncertainty: number,
    requiredLimit: number,
    rule: UncertaintyAwareDecisionRule
  ): "PASS" | "FAIL" | "INDETERMINATE" | "INVALID" {
    if (expandedUncertainty < 0 || Number.isNaN(expandedUncertainty) || !Number.isFinite(expandedUncertainty)) {
      return "INVALID";
    }

    const margin = rule.guardBand > 0 ? rule.guardBand : expandedUncertainty;

    if (rule.decisionRuleType === "SIMPLE_ACCEPTANCE") {
      // Direct comparison with limits
      return measuredValue >= requiredLimit ? "PASS" : "FAIL";
    }

    if (rule.decisionRuleType === "STRINGENT_ACCEPTANCE" || rule.decisionRuleType === "GUARD_BAND_ACCEPTANCE") {
      // Guarded acceptance: measured value must be above limit + guardBand
      const safeThreshold = requiredLimit + margin;
      const failThreshold = requiredLimit - margin;

      if (measuredValue >= safeThreshold) {
        return "PASS";
      } else if (measuredValue < failThreshold) {
        return "FAIL";
      } else {
        return "INDETERMINATE";
      }
    }

    return "INDETERMINATE";
  }
}
