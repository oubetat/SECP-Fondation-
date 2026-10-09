/**
 * SECP Industrial OS v2 — Convergence Criterion Evaluator
 * PATCH-049: Numerical Convergence Framework
 */

import { ConvergenceCriterion, CriterionResult } from "./ConvergenceTypes";
import { ResidualHistory } from "./ResidualHistory";
import { ConvergenceAnalyzer } from "./ConvergenceAnalyzer";

export class ConvergenceCriterionEvaluator {

  public static evaluateCriterion(
    criterion: ConvergenceCriterion,
    history: ResidualHistory
  ): CriterionResult {
    const records = history.getRecords();
    const iterCount = records.length;

    if (iterCount === 0) {
      return {
        criterion,
        observedValue: NaN,
        tolerance: criterion.tolerance ?? 0,
        satisfied: false,
        iterationsEvaluated: 0,
        reason: "Residual history is empty"
      };
    }

    const latest = records[iterCount - 1];
    const targetQuantity = criterion.quantity;
    const tol = criterion.tolerance ?? 1e-6;

    // Helper to get residual value for the target quantity or max
    const getVal = (rec: typeof latest) => {
      if (targetQuantity) {
        const found = rec.residuals.find(r => r.quantity === targetQuantity);
        return found ? found.value : undefined;
      }
      return Math.max(...rec.residuals.map(r => r.value));
    };

    const latestVal = getVal(latest);

    if (latestVal === undefined || isNaN(latestVal)) {
      return {
        criterion,
        observedValue: NaN,
        tolerance: tol,
        satisfied: false,
        iterationsEvaluated: iterCount,
        reason: `Quantity '${targetQuantity ?? "ALL"}' not found or invalid in latest iteration`
      };
    }

    switch (criterion.type) {
      case "ABSOLUTE_RESIDUAL": {
        const satisfied = latestVal <= tol;
        return {
          criterion,
          observedValue: latestVal,
          tolerance: tol,
          satisfied,
          iterationsEvaluated: iterCount,
          reason: satisfied
            ? `Absolute residual ${latestVal.toExponential(3)} <= tolerance ${tol.toExponential(3)}`
            : `Absolute residual ${latestVal.toExponential(3)} > tolerance ${tol.toExponential(3)}`
        };
      }

      case "RELATIVE_RESIDUAL": {
        const first = records[0];
        const firstVal = getVal(first);
        if (firstVal === undefined || firstVal === 0) {
          return {
            criterion,
            observedValue: latestVal,
            tolerance: tol,
            satisfied: false,
            iterationsEvaluated: iterCount,
            reason: "Reference initial residual is zero or missing, cannot compute relative residual"
          };
        }

        const rel = ConvergenceAnalyzer.calculateRelativeResidual(latestVal, firstVal, criterion.floor ?? 1e-15);
        if (rel === undefined) {
          return {
            criterion,
            observedValue: NaN,
            tolerance: tol,
            satisfied: false,
            iterationsEvaluated: iterCount,
            reason: "Failed to calculate relative residual"
          };
        }

        const satisfied = rel <= tol;
        return {
          criterion,
          observedValue: rel,
          tolerance: tol,
          satisfied,
          iterationsEvaluated: iterCount,
          reason: satisfied
            ? `Relative residual ${rel.toExponential(3)} <= tolerance ${tol.toExponential(3)}`
            : `Relative residual ${rel.toExponential(3)} > tolerance ${tol.toExponential(3)}`
        };
      }

      case "ABSOLUTE_ERROR": {
        const err = latest.absoluteError ?? latestVal;
        const satisfied = err <= tol;
        return {
          criterion,
          observedValue: err,
          tolerance: tol,
          satisfied,
          iterationsEvaluated: iterCount,
          reason: satisfied
            ? `Absolute error ${err.toExponential(3)} <= tolerance ${tol.toExponential(3)}`
            : `Absolute error ${err.toExponential(3)} > tolerance ${tol.toExponential(3)}`
        };
      }

      case "RELATIVE_ERROR": {
        const relErr = latest.relativeError ?? latestVal;
        const satisfied = relErr <= tol;
        return {
          criterion,
          observedValue: relErr,
          tolerance: tol,
          satisfied,
          iterationsEvaluated: iterCount,
          reason: satisfied
            ? `Relative error ${relErr.toExponential(3)} <= tolerance ${tol.toExponential(3)}`
            : `Relative error ${relErr.toExponential(3)} > tolerance ${tol.toExponential(3)}`
        };
      }

      case "CHANGE_BETWEEN_ITERATIONS": {
        if (iterCount < 2) {
          return {
            criterion,
            observedValue: NaN,
            tolerance: tol,
            satisfied: false,
            iterationsEvaluated: iterCount,
            reason: "Requires at least 2 iterations to compute change between iterations"
          };
        }

        const prevVal = getVal(records[iterCount - 2]);
        if (prevVal === undefined) {
          return {
            criterion,
            observedValue: NaN,
            tolerance: tol,
            satisfied: false,
            iterationsEvaluated: iterCount,
            reason: "Previous iteration value missing"
          };
        }

        const delta = Math.abs(latestVal - prevVal);
        const satisfied = delta <= tol;
        return {
          criterion,
          observedValue: delta,
          tolerance: tol,
          satisfied,
          iterationsEvaluated: iterCount,
          reason: satisfied
            ? `Iteration change ${delta.toExponential(3)} <= tolerance ${tol.toExponential(3)}`
            : `Iteration change ${delta.toExponential(3)} > tolerance ${tol.toExponential(3)}`
        };
      }

      case "MAX_ITERATIONS": {
        const maxAllowed = criterion.maximumIterations ?? 1000;
        const hitMax = iterCount >= maxAllowed;
        return {
          criterion,
          observedValue: iterCount,
          tolerance: maxAllowed,
          satisfied: hitMax,
          iterationsEvaluated: iterCount,
          reason: hitMax
            ? `Maximum iteration count (${maxAllowed}) reached`
            : `Current iterations (${iterCount}) < maximum (${maxAllowed})`
        };
      }

      default: {
        const satisfied = latestVal <= tol;
        return {
          criterion,
          observedValue: latestVal,
          tolerance: tol,
          satisfied,
          iterationsEvaluated: iterCount,
          reason: `Evaluated default criteria: ${satisfied}`
        };
      }
    }
  }
}
