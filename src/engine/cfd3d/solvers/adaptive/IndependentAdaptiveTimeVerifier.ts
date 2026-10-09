/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-068: Independent Adaptive Timestep Verifier
 */

import { AdaptiveTimeRecord } from './AdaptiveTypes';

export interface IndependentAdaptiveVerificationResult {
  readonly isValid: boolean;
  readonly cflBoundsPassed: boolean;
  readonly timestepLimitsPassed: boolean;
  readonly diagnostics: string[];
}

export class IndependentAdaptiveTimeVerifier {
  public static verify(
    records: readonly AdaptiveTimeRecord[],
    minDt: number,
    maxDt: number,
    targetCFL: number
  ): IndependentAdaptiveVerificationResult {
    const diagnostics: string[] = [];
    let cflBoundsPassed = true;
    let timestepLimitsPassed = true;

    for (const rec of records) {
      if (rec.accepted) {
        // Timestep bounds check
        if (rec.dt < minDt || rec.dt > maxDt) {
          timestepLimitsPassed = false;
          diagnostics.push(`Independent Verification Failure: accepted dt=${rec.dt} is outside bounds [${minDt}, ${maxDt}] at index ${rec.timestepIndex}`);
        }

        // CFL bounds check (hard safety limit)
        if (rec.CFL > targetCFL * 2.5) {
          cflBoundsPassed = false;
          diagnostics.push(`Independent Verification Failure: accepted CFL=${rec.CFL} exceeded safety cap at index ${rec.timestepIndex}`);
        }
      }
    }

    const isValid = cflBoundsPassed && timestepLimitsPassed;

    return {
      isValid,
      cflBoundsPassed,
      timestepLimitsPassed,
      diagnostics
    };
  }
}
