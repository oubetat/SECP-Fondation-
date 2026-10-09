/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-258 — IK Solution Branch Evaluator & Ranker
 * Evaluates multiple analytical IK solutions, verifies travel limits, continuity,
 * singularity margins, and selects the optimal machine joint configuration.
 */

import { 
  FiveAxisMachineDefinition, 
  IKSolutionBranch, 
  MachineAxesState 
} from './FiveAxisTypes';
import { FiveAxisMathUtils } from './FiveAxisMathUtils';

export class IKSolutionRanker {
  /**
   * Evaluates and scores candidate IK branches. Returns candidates sorted from best (lowest score) to worst.
   */
  public static rankSolutions(
    machine: FiveAxisMachineDefinition,
    candidates: IKSolutionBranch[],
    prevAxes?: MachineAxesState
  ): IKSolutionBranch[] {
    const scoredCandidates: IKSolutionBranch[] = candidates.map(branch => {
      const { axes } = branch;
      const limitViolations: string[] = [];
      let isWithinLimits = true;

      // 1. Check Linear Limits
      if (axes.X < machine.linearLimits.X.min - 1e-3 || axes.X > machine.linearLimits.X.max + 1e-3) {
        isWithinLimits = false;
        limitViolations.push(`Linear X [${axes.X.toFixed(2)} mm] exceeds bounds [${machine.linearLimits.X.min}, ${machine.linearLimits.X.max}]`);
      }
      if (axes.Y < machine.linearLimits.Y.min - 1e-3 || axes.Y > machine.linearLimits.Y.max + 1e-3) {
        isWithinLimits = false;
        limitViolations.push(`Linear Y [${axes.Y.toFixed(2)} mm] exceeds bounds [${machine.linearLimits.Y.min}, ${machine.linearLimits.Y.max}]`);
      }
      if (axes.Z < machine.linearLimits.Z.min - 1e-3 || axes.Z > machine.linearLimits.Z.max + 1e-3) {
        isWithinLimits = false;
        limitViolations.push(`Linear Z [${axes.Z.toFixed(2)} mm] exceeds bounds [${machine.linearLimits.Z.min}, ${machine.linearLimits.Z.max}]`);
      }

      // 2. Check Primary Rotary Limits
      const primAxis = machine.rotaryLimits.primary.axis;
      const primVal = primAxis === 'A' ? axes.A : (primAxis === 'B' ? axes.B : axes.C);
      const primLim = machine.rotaryLimits.primary.limits;
      if (!machine.rotaryLimits.primary.isContinuous && (primVal < primLim.min - 1e-3 || primVal > primLim.max + 1e-3)) {
        isWithinLimits = false;
        limitViolations.push(`Rotary ${primAxis} [${primVal.toFixed(2)}°] exceeds bounds [${primLim.min}, ${primLim.max}]`);
      }

      // 3. Check Secondary Rotary Limits
      const secAxis = machine.rotaryLimits.secondary.axis;
      const secVal = secAxis === 'C' ? axes.C : (secAxis === 'B' ? axes.B : axes.A);
      const secLim = machine.rotaryLimits.secondary.limits;
      if (!machine.rotaryLimits.secondary.isContinuous && (secVal < secLim.min - 1e-3 || secVal > secLim.max + 1e-3)) {
        isWithinLimits = false;
        limitViolations.push(`Rotary ${secAxis} [${secVal.toFixed(2)}°] exceeds bounds [${secLim.min}, ${secLim.max}]`);
      }

      // 4. Calculate Distance Metrics
      let angularDistDeg = 0;
      let linearDispMm = 0;

      if (prevAxes) {
        const dA = axes.A - prevAxes.A;
        const dB = axes.B - prevAxes.B;
        const dC = axes.C - prevAxes.C;
        angularDistDeg = Math.sqrt(dA * dA + dB * dB + dC * dC);

        const dX = axes.X - prevAxes.X;
        const dY = axes.Y - prevAxes.Y;
        const dZ = axes.Z - prevAxes.Z;
        linearDispMm = Math.sqrt(dX * dX + dY * dY + dZ * dZ);
      }

      // 5. Singularity Penalty
      let singularityPenalty = 0;
      if (branch.isSingular) {
        singularityPenalty = 5000.0;
      } else if (branch.singularityDistanceDeg < machine.singularityConeAngleDeg) {
        singularityPenalty = (machine.singularityConeAngleDeg - branch.singularityDistanceDeg) * 100.0;
      }

      // 6. Limits Penalty (Severe if out of bounds)
      const limitPenalty = isWithinLimits ? 0 : 100000.0 + limitViolations.length * 1000.0;

      // Total Composite Cost Score
      const totalScore = limitPenalty + angularDistDeg * 2.0 + linearDispMm * 0.5 + singularityPenalty;

      return {
        ...branch,
        score: Number(totalScore.toFixed(3)),
        isWithinLimits,
        limitViolations,
        rejectionReason: !isWithinLimits ? limitViolations.join('; ') : undefined,
        rankingDetails: {
          angularDistanceDeg: Number(angularDistDeg.toFixed(3)),
          linearDisplacementMm: Number(linearDispMm.toFixed(3)),
          singularityPenalty: Number(singularityPenalty.toFixed(3)),
          limitPenalty: Number(limitPenalty.toFixed(3))
        }
      };
    });

    // Sort ascending by score (lowest cost first)
    return scoredCandidates.sort((a, b) => a.score - b.score);
  }
}
