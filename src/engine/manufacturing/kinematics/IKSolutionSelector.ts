import { IKSolution, IKSolutionStatus } from "./types";

export class IKSolutionSelector {
  /**
   * Selects the optimal IK solution based on distance from current axis positions and preference.
   */
  public static selectBestSolution(
    candidates: IKSolution[],
    currentPositions: Record<string, number>,
    preferredPosture: string = "SOLUTION_1"
  ): { bestSolution: IKSolution | null; explanation: string } {
    // Filter to only VALID or SINGULAR (avoid LIMIT_VIOLATION/UNREACHABLE)
    const feasible = candidates.filter(
      c => c.status === IKSolutionStatus.VALID || c.status === IKSolutionStatus.SINGULAR
    );

    if (feasible.length === 0) {
      // Look if there are limit violations we can return for diagnostic
      const withLimits = candidates.filter(c => c.status === IKSolutionStatus.LIMIT_VIOLATION);
      if (withLimits.length > 0) {
        return {
          bestSolution: withLimits[0],
          explanation: "No fully valid solution found. Selected solution violates axis travel limits."
        };
      }
      return { bestSolution: null, explanation: "Target is completely unreachable" };
    }

    // Sort by joint travel distance from current positions
    const scored = feasible.map(candidate => {
      let totalDisplacement = 0;
      for (const [axisId, val] of Object.entries(candidate.axisValues)) {
        const currentVal = currentPositions[axisId] || 0;
        totalDisplacement += Math.pow(val - currentVal, 2);
      }
      const distanceScore = Math.sqrt(totalDisplacement);

      // Preferred posture gets a slight scoring bonus (lower is better)
      const preferencePenalty = candidate.solutionId === preferredPosture ? 0.0 : 10.0;
      const finalScore = distanceScore + preferencePenalty;

      return {
        candidate,
        score: finalScore,
        distance: distanceScore
      };
    });

    // Sort ascending (lowest score is best)
    scored.sort((a, b) => a.score - b.score);

    const best = scored[0].candidate;
    const explanation = `Selected ${best.solutionId} based on minimal joint displacement (${scored[0].distance.toFixed(3)} units) and posture preference`;

    return {
      bestSolution: best,
      explanation
    };
  }
}
