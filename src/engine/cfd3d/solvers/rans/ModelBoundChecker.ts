/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-063: Turbulence Boundedness Checker
 */

import { TurbulenceModelState } from './TurbulenceModelContract';
import { TurbulenceModelFailureCode } from './TurbulenceModelFailure';

export class ModelBoundChecker {
  public static check(state: TurbulenceModelState): { valid: boolean; error?: TurbulenceModelFailureCode; detail?: string } {
    if (state.fields['k']) {
      for (let i = 0; i < state.fields['k'].length; i++) {
        const val = state.fields['k'][i];
        if (val < 0) {
          return { valid: false, error: TurbulenceModelFailureCode.NEGATIVE_K, detail: `k value is negative: ${val} at cell index ${i}` };
        }
        if (!Number.isFinite(val)) {
          return { valid: false, error: TurbulenceModelFailureCode.NAN_DETECTED, detail: `k value is non-finite: ${val} at cell index ${i}` };
        }
      }
    }

    if (state.fields['omega']) {
      for (let i = 0; i < state.fields['omega'].length; i++) {
        const val = state.fields['omega'][i];
        if (val <= 0) {
          return { valid: false, error: TurbulenceModelFailureCode.INVALID_OMEGA, detail: `omega value must be positive: ${val} at cell index ${i}` };
        }
        if (!Number.isFinite(val)) {
          return { valid: false, error: TurbulenceModelFailureCode.NAN_DETECTED, detail: `omega value is non-finite: ${val} at cell index ${i}` };
        }
      }
    }

    if (state.fields['epsilon']) {
      for (let i = 0; i < state.fields['epsilon'].length; i++) {
        const val = state.fields['epsilon'][i];
        if (val <= 0) {
          return { valid: false, error: TurbulenceModelFailureCode.INVALID_EPSILON, detail: `epsilon value must be positive: ${val} at cell index ${i}` };
        }
        if (!Number.isFinite(val)) {
          return { valid: false, error: TurbulenceModelFailureCode.NAN_DETECTED, detail: `epsilon value is non-finite: ${val} at cell index ${i}` };
        }
      }
    }

    return { valid: true };
  }
}
