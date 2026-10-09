/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-063: Turbulence Realizability Checker
 */

import { TurbulenceModelState } from './TurbulenceModelContract';
import { TurbulenceModelFailureCode } from './TurbulenceModelFailure';

export class RealizabilityChecker {
  public static check(state: TurbulenceModelState): { realizable: boolean; error?: TurbulenceModelFailureCode; detail?: string } {
    if (!state.reynoldsStress) {
      return { realizable: true };
    }

    const { Rxx, Ryy, Rzz, Rxy, Rxz, Ryz } = state.reynoldsStress;
    const len = Rxx.length;

    for (let i = 0; i < len; i++) {
      // 1. Diagonal terms must be real and positive (or zero for positive semi-definiteness)
      if (Rxx[i] < 0 || Ryy[i] < 0 || Rzz[i] < 0) {
        return {
          realizable: false,
          error: TurbulenceModelFailureCode.NON_REALIZABLE_STRESS,
          detail: `Diagonal stress elements must be non-negative: Rxx=${Rxx[i]}, Ryy=${Ryy[i]}, Rzz=${Rzz[i]} at cell index ${i}`
        };
      }

      // 2. Schwarz inequalities: |R_ij|^2 <= R_ii * R_jj
      if (Rxy[i] * Rxy[i] > Rxx[i] * Ryy[i]) {
        return {
          realizable: false,
          error: TurbulenceModelFailureCode.NON_REALIZABLE_STRESS,
          detail: `Schwarz inequality violation for Rxy: Rxy^2 (${Rxy[i] * Rxy[i]}) > Rxx * Ryy (${Rxx[i] * Ryy[i]}) at cell index ${i}`
        };
      }
      if (Rxz[i] * Rxz[i] > Rxx[i] * Rzz[i]) {
        return {
          realizable: false,
          error: TurbulenceModelFailureCode.NON_REALIZABLE_STRESS,
          detail: `Schwarz inequality violation for Rxz: Rxz^2 (${Rxz[i] * Rxz[i]}) > Rxx * Rzz (${Rxx[i] * Rzz[i]}) at cell index ${i}`
        };
      }
      if (Ryz[i] * Ryz[i] > Ryy[i] * Rzz[i]) {
        return {
          realizable: false,
          error: TurbulenceModelFailureCode.NON_REALIZABLE_STRESS,
          detail: `Schwarz inequality violation for Ryz: Ryz^2 (${Ryz[i] * Ryz[i]}) > Ryy * Rzz (${Ryy[i] * Rzz[i]}) at cell index ${i}`
        };
      }
    }

    return { realizable: true };
  }
}
