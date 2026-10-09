/**
 * SECP Industrial OS - PATCH-309 Optimization Regression Guard
 * Verifies that candidate parameter variations do not cause regressions in unoptimized
 * structural, thermal, fatigue, or manufacturing rules.
 */

import { OptimizationCandidate, HardConstraintDefinition } from './AIOptimizationTypes309';

export interface RegressionCheckResult {
  passed: boolean;
  violations: { constraintId: string; limit: number; actual: number; violation: number }[];
  details: string;
}

export class OptimizationRegressionGuard {
  /**
   * Verifies all hard constraints against candidate solver metrics.
   */
  public verifyCandidate(
    candidate: OptimizationCandidate,
    constraints: HardConstraintDefinition[]
  ): RegressionCheckResult {
    const violations: { constraintId: string; limit: number; actual: number; violation: number }[] = [];

    for (const c of constraints) {
      const metric = candidate.metrics[c.parameterName];
      if (metric) {
        const val = metric.value;
        let satisfied = false;
        let diff = 0;

        if (c.operator === '<=') {
          satisfied = val <= c.targetValue;
          diff = val - c.targetValue;
        } else if (c.operator === '>=') {
          satisfied = val >= c.targetValue;
          diff = c.targetValue - val;
        } else if (c.operator === '==') {
          satisfied = Math.abs(val - c.targetValue) < 1e-4;
          diff = Math.abs(val - c.targetValue);
        }

        if (!satisfied) {
          violations.push({
            constraintId: c.constraintId,
            limit: c.targetValue,
            actual: val,
            violation: Number(diff.toFixed(2)),
          });
        }
      }
    }

    const passed = violations.length === 0;

    return {
      passed,
      violations,
      details: passed
        ? 'Regression Guard Passed: All engineering constraints satisfied.'
        : `Regression Guard Failed: ${violations.length} constraint violation(s) detected.`,
    };
  }
}
