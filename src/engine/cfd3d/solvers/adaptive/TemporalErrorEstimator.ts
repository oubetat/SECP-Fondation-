/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-068: Temporal Error Estimator via Step-Doubling
 */

export class TemporalErrorEstimator {
  public static estimateStepDoublingError(
    singleStepState: readonly number[],
    doubleHalfStepState: readonly number[]
  ): { errorL2: number; errorL1: number; errorLMax: number } {
    const size = singleStepState.length;
    let sumSq = 0.0;
    let sumAbs = 0.0;
    let maxDiff = 0.0;

    for (let i = 0; i < size; i++) {
      const diff = Math.abs(singleStepState[i] - doubleHalfStepState[i]);
      sumSq += diff * diff;
      sumAbs += diff;
      if (diff > maxDiff) {
        maxDiff = diff;
      }
    }

    const errorL2 = Math.sqrt(sumSq / size);
    const errorL1 = sumAbs / size;
    const errorLMax = maxDiff;

    return { errorL2, errorL1, errorLMax };
  }
}
