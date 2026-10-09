/**
 * SECP Industrial OS v2 — Convergence Evaluator
 * PATCH-049: Numerical Convergence Framework
 */

import { 
  ConvergenceAssessment, 
  ConvergenceCriterion, 
  AggregationStrategy, 
  ConvergenceStatus, 
  ConvergenceDiagnostic,
  CriterionResult
} from "./ConvergenceTypes";
import { ResidualHistory } from "./ResidualHistory";
import { ConvergenceAnalyzer } from "./ConvergenceAnalyzer";
import { ConvergenceCriterionEvaluator } from "./ConvergenceCriterion";

export class ConvergenceEvaluator {

  public static evaluate(
    history: ResidualHistory,
    criteria: ConvergenceCriterion[],
    strategy: AggregationStrategy = "ALL_REQUIRED",
    maxIterationsLimit = 1000
  ): ConvergenceAssessment {
    const diagnostics: ConvergenceDiagnostic[] = [];

    // 1. History Validity Check
    if (!history || !history.isValid()) {
      const errs = history ? history.getValidationErrors() : ["History is null or undefined"];
      diagnostics.push({
        type: "ANOMALY",
        message: `Invalid residual history: ${errs.join("; ")}`
      });

      return {
        status: "INVALID",
        criteriaResults: [],
        diagnostics,
        iterations: history ? history.length() : 0,
        finalResiduals: [],
        trend: "INSUFFICIENT_DATA"
      };
    }

    const iterCount = history.length();
    if (iterCount === 0) {
      return {
        status: "INSUFFICIENT_DATA",
        criteriaResults: [],
        diagnostics: [{ type: "ANOMALY", message: "Residual history contains 0 iterations" }],
        iterations: 0,
        finalResiduals: [],
        trend: "INSUFFICIENT_DATA"
      };
    }

    const latest = history.latest()!;
    const finalResiduals = latest.residuals;

    // 2. Divergence Detection
    const divRes = ConvergenceAnalyzer.detectDivergence(history);
    if (divRes.diverged) {
      diagnostics.push({
        type: "DIVERGENCE",
        message: divRes.diagnostic ?? "Numerical divergence detected",
        iteration: latest.iteration
      });

      return {
        status: "DIVERGED",
        criteriaResults: [],
        diagnostics,
        iterations: iterCount,
        finalResiduals,
        trend: ConvergenceAnalyzer.analyzeMonotonicity(history),
        divergenceReason: divRes.reason
      };
    }

    // 3. Evaluate Individual Criteria
    const criteriaResults: CriterionResult[] = criteria.map(c => 
      ConvergenceCriterionEvaluator.evaluateCriterion(c, history)
    );

    // 4. Stagnation Detection Check
    const minTol = Math.min(...criteria.map(c => c.tolerance ?? 1e-6));
    const stagRes = ConvergenceAnalyzer.detectStagnation(history, minTol);
    if (stagRes.stagnated) {
      diagnostics.push({
        type: "STAGNATION",
        message: stagRes.diagnostic ?? "Residual stagnation detected",
        iteration: latest.iteration
      });
    }

    // 5. Aggregate Results
    let isSatisfied = false;
    const requiredResults = criteriaResults.filter(r => r.criterion.required);

    if (strategy === "ALL_REQUIRED") {
      isSatisfied = requiredResults.length > 0 ? requiredResults.every(r => r.satisfied) : criteriaResults.every(r => r.satisfied);
    } else if (strategy === "ANY_REQUIRED") {
      isSatisfied = requiredResults.length > 0 ? requiredResults.some(r => r.satisfied) : criteriaResults.some(r => r.satisfied);
    } else {
      isSatisfied = requiredResults.every(r => r.satisfied);
    }

    let status: ConvergenceStatus = "NOT_CONVERGED";

    if (isSatisfied) {
      status = "CONVERGED";
    } else if (stagRes.stagnated) {
      status = "STAGNATED";
    } else if (iterCount >= maxIterationsLimit) {
      status = "MAX_ITERATIONS_REACHED";
    } else {
      status = "NOT_CONVERGED";
    }

    const trend = ConvergenceAnalyzer.analyzeMonotonicity(history);

    return {
      status,
      criteriaResults,
      diagnostics,
      iterations: iterCount,
      finalResiduals,
      trend,
      confidence: status === "CONVERGED" ? "HIGH" : "MEDIUM"
    };
  }
}
