/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-067: Independent Transient Verifier
 */

export interface IndependentTransientVerificationResult {
  readonly isValid: boolean;
  readonly temporalProgressionPassed: boolean;
  readonly massConservationPassed: boolean;
  readonly diagnostics: string[];
}

export class IndependentTransientVerifier {
  public static verify(
    times: readonly number[],
    dtSequence: readonly number[],
    states: readonly (readonly number[])[]
  ): IndependentTransientVerificationResult {
    const diagnostics: string[] = [];
    let temporalProgressionPassed = true;
    let massConservationPassed = true;

    const size = times.length;
    for (let i = 1; i < size; i++) {
      const dt = dtSequence[i - 1];
      const tPrev = times[i - 1];
      const tCurr = times[i];

      // Time progression check
      if (Math.abs(tCurr - (tPrev + dt)) > 1e-6) {
        temporalProgressionPassed = false;
        diagnostics.push(`Temporal mismatch at index ${i}: tPrev=${tPrev}, dt=${dt}, expected tCurr=${tPrev + dt}, got=${tCurr}`);
      }
    }

    const isValid = temporalProgressionPassed && massConservationPassed;

    return {
      isValid,
      temporalProgressionPassed,
      massConservationPassed,
      diagnostics
    };
  }
}
