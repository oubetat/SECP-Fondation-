/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-062: RANS Reynolds Averaging Operators
 */

import { Vector3D } from '../laminar/LaminarSolverTypes';

export class RansAveraging {
  /**
   * Decomposes an instantaneous velocity vector into Mean (U) and Fluctuation (u')
   * u = U + u'
   */
  public static decomposeVelocity(
    instantaneous: Vector3D,
    mean: Vector3D
  ): Vector3D {
    return [
      instantaneous[0] - mean[0],
      instantaneous[1] - mean[1],
      instantaneous[2] - mean[2]
    ];
  }

  /**
   * Decomposes an instantaneous pressure into Mean (P) and Fluctuation (p')
   * p = P + p'
   */
  public static decomposePressure(
    instantaneous: number,
    mean: number
  ): number {
    return instantaneous - mean;
  }
}
