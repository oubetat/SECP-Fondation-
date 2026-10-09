/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-062: RANS Mean Flow Representations
 */

import { Vector3D } from '../laminar/LaminarSolverTypes';
import { RansFieldState } from './RansSolverTypes';

export class RansMeanFlow {
  /**
   * Evaluates the mean strain-rate tensor S_ij for a given field cell.
   * S_ij = 0.5 * (dU_i/dx_j + dU_j/dx_i)
   */
  public static computeStrainRateTensor(
    cellId: number,
    state: RansFieldState,
    gradients: readonly [Vector3D, Vector3D, Vector3D][]
  ): number[][] {
    const gradU = gradients[cellId]; // [grad(U_x), grad(U_y), grad(U_z)]
    const S = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        S[i][j] = 0.5 * (gradU[i][j] + gradU[j][i]);
      }
    }
    return S;
  }
}
