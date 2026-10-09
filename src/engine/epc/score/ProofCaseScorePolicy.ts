/**
 * SECP Industrial OS — EPC-014: Proof Case Score Policy
 */

import { ScoreDimensionId, ProofCaseScorePolicy, ScoreBand } from './ProofCaseScoreTypes';

export const DEFAULT_SCORE_POLICY: ProofCaseScorePolicy = {
  version: '1.0.0',
  weights: {
    [ScoreDimensionId.REQUIREMENTS]: 0.10,
    [ScoreDimensionId.CAD]: 0.10,
    [ScoreDimensionId.ASSEMBLY]: 0.08,
    [ScoreDimensionId.PHYSICS]: 0.12,
    [ScoreDimensionId.SIMULATION]: 0.12,
    [ScoreDimensionId.VERIFICATION]: 0.15,
    [ScoreDimensionId.MANUFACTURING]: 0.10,
    [ScoreDimensionId.PLM]: 0.07,
    [ScoreDimensionId.DIGITAL_THREAD]: 0.10,
    [ScoreDimensionId.PHYSICAL_VALIDATION]: 0.06
  },
  criticalRequirementCap: 50, // Severe cap if critical verification fails
  scoreBands: {
    [ScoreBand.INSUFFICIENT]: [0, 39],
    [ScoreBand.DEVELOPING]: [40, 59],
    [ScoreBand.ENGINEERED]: [60, 74],
    [ScoreBand.VERIFIED]: [75, 89],
    [ScoreBand.HIGH_CONFIDENCE]: [90, 100]
  }
};

export class ScorePolicyValidator {
  public static validate(policy: ProofCaseScorePolicy): void {
    const totalWeight = Object.values(policy.weights).reduce((sum, w) => sum + w, 0);
    if (Math.abs(totalWeight - 1.0) > 0.0001) {
      throw new Error(`Invalid Score Policy: Total weight must be 1.0, found ${totalWeight}`);
    }

    for (const [dim, weight] of Object.entries(policy.weights)) {
      if (weight < 0 || weight > 1) {
        throw new Error(`Invalid weight for dimension ${dim}: ${weight}`);
      }
    }
  }
}
