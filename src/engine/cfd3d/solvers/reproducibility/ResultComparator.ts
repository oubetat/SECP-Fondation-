/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-074: CFD Result & Numerical Difference Comparator
 */

import {
  FieldComparisonResult,
  QoIComparisonResult,
  ReproducibilityEnvelope
} from './ReproducibilityTypes';

export class ResultComparator {
  public static compareScalarField(
    fieldName: string,
    original: readonly number[],
    replay: readonly number[],
    envelope: ReproducibilityEnvelope
  ): FieldComparisonResult {
    if (original.length !== replay.length) {
      throw new Error(`Field length mismatch for ${fieldName}: original has ${original.length}, replay has ${replay.length}`);
    }

    const n = original.length;
    let sumAbsDiff = 0;
    let sumSqDiff = 0;
    let maxAbsDiff = 0;
    let maxRelDiff = 0;

    for (let i = 0; i < n; i++) {
      const o = original[i];
      const r = replay[i];
      const absDiff = Math.abs(o - r);
      sumAbsDiff += absDiff;
      sumSqDiff += absDiff * absDiff;

      if (absDiff > maxAbsDiff) {
        maxAbsDiff = absDiff;
      }

      // Safe relative error with near-zero threshold (1e-12)
      const denom = Math.abs(o);
      const rel = denom > 1e-12 ? absDiff / denom : absDiff;
      if (rel > maxRelDiff) {
        maxRelDiff = rel;
      }
    }

    const meanAbsDiff = n > 0 ? sumAbsDiff / n : 0;
    const rmsDiff = n > 0 ? Math.sqrt(sumSqDiff / n) : 0;
    const l1Norm = sumAbsDiff;
    const l2Norm = Math.sqrt(sumSqDiff);
    const lInfNorm = maxAbsDiff;

    const isWithinEnvelope =
      maxAbsDiff <= envelope.fieldToleranceAbs || maxRelDiff <= envelope.fieldToleranceRel;

    return {
      fieldName,
      maxAbsDiff,
      meanAbsDiff,
      rmsDiff,
      maxRelDiff,
      l1Norm,
      l2Norm,
      lInfNorm,
      isWithinEnvelope
    };
  }

  public static compareQoI(
    qoiName: string,
    originalValue: number,
    replayValue: number,
    envelope: ReproducibilityEnvelope
  ): QoIComparisonResult {
    const absDiff = Math.abs(originalValue - replayValue);
    const denom = Math.abs(originalValue);
    const relDiff = denom > 1e-12 ? absDiff / denom : absDiff;

    const isWithinEnvelope = relDiff <= envelope.qoiToleranceRel || absDiff <= 1e-6;

    return {
      qoiName,
      originalValue,
      replayValue,
      absDiff,
      relDiff,
      isWithinEnvelope
    };
  }

  public static compareResidualHistories(
    original: readonly number[],
    replay: readonly number[]
  ): { readonly maxDiff: number; readonly finalDiff: number; readonly isEquivalent: boolean } {
    if (original.length === 0 || replay.length === 0) {
      return { maxDiff: 0, finalDiff: 0, isEquivalent: true };
    }

    let maxDiff = 0;
    const len = Math.min(original.length, replay.length);
    for (let i = 0; i < len; i++) {
      const diff = Math.abs(original[i] - replay[i]);
      if (diff > maxDiff) maxDiff = diff;
    }

    const finalDiff = Math.abs(original[original.length - 1] - replay[replay.length - 1]);
    return {
      maxDiff,
      finalDiff,
      isEquivalent: finalDiff < 1e-6
    };
  }

  public static compareConservationBalances(
    origMass: number,
    replayMass: number,
    envelope: ReproducibilityEnvelope
  ): { readonly massDiff: number; readonly isWithinTolerance: boolean } {
    const massDiff = Math.abs(origMass - replayMass);
    return {
      massDiff,
      isWithinTolerance: massDiff <= envelope.conservationToleranceAbs
    };
  }
}
