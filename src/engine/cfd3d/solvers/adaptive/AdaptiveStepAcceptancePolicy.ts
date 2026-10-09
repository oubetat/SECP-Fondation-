/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-068: Adaptive Step Acceptance and Rejection Policy
 */

import { LimiterReason } from './AdaptiveTypes';

export interface AcceptanceResult {
  readonly accepted: boolean;
  readonly reason: string;
}

export class AdaptiveStepAcceptancePolicy {
  public static evaluate(
    measuredError: number,
    targetError: number,
    measuredCFL: number,
    targetCFL: number,
    density: readonly number[]
  ): AcceptanceResult {
    // 1. Error check
    if (measuredError > targetError) {
      return { accepted: false, reason: `TEMPORAL_ERROR_EXCEEDED: Error ${measuredError} exceeded tolerance ${targetError}` };
    }

    // 2. CFL hard limits
    if (measuredCFL > targetCFL * 2.0) {
      return { accepted: false, reason: `CFL_LIMIT_EXCEEDED: CFL ${measuredCFL} exceeded safety cap ${targetCFL * 2.0}` };
    }

    // 3. Physical state positivity
    for (let i = 0; i < density.length; i++) {
      if (density[i] <= 0) {
        return { accepted: false, reason: `PHYSICAL_STATE_INVALID: Negative density detected at cell ${i}: ${density[i]}` };
      }
    }

    return { accepted: true, reason: 'STEP_ACCEPTED' };
  }
}
