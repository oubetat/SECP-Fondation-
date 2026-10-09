/**
 * SECP Industrial OS — EPC-012: Reproducibility Comparator
 */

import { 
  ComparisonMetric, 
  ComparisonResult, 
  ReproducibilityStatus, 
  TolerancePolicy 
} from './ReproducibilityTypes';

export class ReproducibilityComparator {
  /**
   * Compares a reproduced result against a reference result based on a tolerance policy.
   */
  public static compare(
    reference: Record<string, any>,
    reproduced: Record<string, any>,
    policy: Record<string, TolerancePolicy>
  ): ComparisonResult {
    const metrics: ComparisonMetric[] = [];
    const violations: string[] = [];
    let sumSquaredError = 0;
    let maxError = 0;
    let count = 0;

    for (const key in reference) {
      const refVal = reference[key];
      const repVal = reproduced[key];
      const tol = policy[key] || policy['default'] || { absoluteTolerance: 1e-6, relativeTolerance: 1e-4 };

      if (repVal === undefined) {
        violations.push(`Missing quantity in reproduction: ${key}`);
        continue;
      }

      const metric = this.compareQuantity(key, refVal, repVal, tol);
      metrics.push(metric);

      if (metric.status === ReproducibilityStatus.FAIL) {
        violations.push(`Tolerance violation for ${key}: ${metric.details}`);
      }

      // Track errors for scalars/vectors
      if (typeof refVal === 'number' && typeof repVal === 'number') {
        const err = Math.abs(refVal - repVal);
        sumSquaredError += err * err;
        maxError = Math.max(maxError, err);
        count++;
      }
    }

    const overallStatus = violations.length > 0 ? ReproducibilityStatus.FAIL : ReproducibilityStatus.PASS;
    const rmsError = count > 0 ? Math.sqrt(sumSquaredError / count) : 0;

    return {
      overallStatus,
      metrics,
      maxError,
      rmsError,
      deterministicStatus: maxError === 0,
      violations
    };
  }

  private static compareQuantity(
    key: string,
    ref: any,
    rep: any,
    tol: TolerancePolicy
  ): ComparisonMetric {
    if (typeof ref === 'number' && typeof rep === 'number') {
      const absError = Math.abs(ref - rep);
      const floor = tol.referenceFloor || 1e-12;
      const relError = absError / Math.max(Math.abs(ref), floor);

      const passAbs = absError <= tol.absoluteTolerance;
      const passRel = relError <= tol.relativeTolerance;
      const status = (passAbs || passRel) ? ReproducibilityStatus.PASS : ReproducibilityStatus.FAIL;

      return {
        quantity: key,
        referenceValue: ref,
        reproducedValue: rep,
        absoluteError: absError,
        relativeError: relError,
        status,
        details: status === ReproducibilityStatus.FAIL ? 
          `AbsError: ${absError.toExponential(4)} > ${tol.absoluteTolerance}, RelError: ${relError.toExponential(4)} > ${tol.relativeTolerance}` : 
          undefined
      };
    }

    // Array/Vector comparison
    if (Array.isArray(ref) && Array.isArray(rep)) {
      if (ref.length !== rep.length) {
        return {
          quantity: key,
          referenceValue: ref,
          reproducedValue: rep,
          absoluteError: Infinity,
          relativeError: Infinity,
          status: ReproducibilityStatus.FAIL,
          details: `Array length mismatch: ${ref.length} vs ${rep.length}`
        };
      }

      let maxAbs = 0;
      let maxRel = 0;
      for (let i = 0; i < ref.length; i++) {
        const m = this.compareQuantity(`${key}[${i}]`, ref[i], rep[i], tol);
        maxAbs = Math.max(maxAbs, m.absoluteError);
        maxRel = Math.max(maxRel, m.relativeError);
        if (m.status === ReproducibilityStatus.FAIL) {
          return {
            ...m,
            quantity: key,
            details: `Vector violation at index ${i}: ${m.details}`
          };
        }
      }

      return {
        quantity: key,
        referenceValue: ref,
        reproducedValue: rep,
        absoluteError: maxAbs,
        relativeError: maxRel,
        status: ReproducibilityStatus.PASS
      };
    }

    // Direct equivalence for non-numeric
    const status = JSON.stringify(ref) === JSON.stringify(rep) ? ReproducibilityStatus.PASS : ReproducibilityStatus.FAIL;
    return {
      quantity: key,
      referenceValue: ref,
      reproducedValue: rep,
      absoluteError: status === ReproducibilityStatus.PASS ? 0 : 1,
      relativeError: status === ReproducibilityStatus.PASS ? 0 : 1,
      status,
      details: status === ReproducibilityStatus.FAIL ? 'Non-numeric value mismatch' : undefined
    };
  }
}
