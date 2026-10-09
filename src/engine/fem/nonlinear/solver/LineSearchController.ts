/**
 * SECP Industrial OS v3 — Line Search Controller (PATCH-238)
 *
 * Implements Armijo / Wolfe backtracking line search to scale Newton displacement increment \Delta u:
 * u_{new} = u + \eta * \Delta u
 * where \eta \in [\eta_{min}, 1.0] minimizes residual energy.
 */

export interface LineSearchResult {
  alpha: number;             // Step size \eta
  evaluationsCount: number;  // Number of trial evaluations
  initialResidualNorm: number;
  finalResidualNorm: number;
  lineSearchSuccess: boolean;
}

export class LineSearchController {
  /**
   * Executes backtracking line search to find step scaling \eta
   */
  public static execute(
    residualEvaluator: (alpha: number) => number, // returns ||R(u + alpha * deltaU)||
    initialResidualNorm: number,
    etaMin: number = 0.01,
    maxLineSearchIters: number = 6,
    armijoReductionFactor: number = 0.5
  ): LineSearchResult {
    let alpha = 1.0;
    let bestAlpha = 1.0;
    let minResidualNorm = initialResidualNorm;
    let evals = 0;

    for (let iter = 0; iter < maxLineSearchIters; iter++) {
      evals++;
      const currentNorm = residualEvaluator(alpha);

      if (currentNorm < minResidualNorm) {
        minResidualNorm = currentNorm;
        bestAlpha = alpha;
        // Armijo sufficient decrease satisfied
        if (currentNorm <= initialResidualNorm * 0.95) {
          return {
            alpha,
            evaluationsCount: evals,
            initialResidualNorm,
            finalResidualNorm: currentNorm,
            lineSearchSuccess: true
          };
        }
      }

      alpha *= armijoReductionFactor;
      if (alpha < etaMin) break;
    }

    return {
      alpha: bestAlpha,
      evaluationsCount: evals,
      initialResidualNorm,
      finalResidualNorm: minResidualNorm,
      lineSearchSuccess: minResidualNorm < initialResidualNorm
    };
  }
}
