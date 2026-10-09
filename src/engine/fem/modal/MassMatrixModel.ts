import { Matrix } from "../core/MathUtils";
import { MassFormulation } from "./types";

export class MassMatrixModel {
  /**
   * Computes the consistent mass matrix for a 1D BAR element.
   * Me = (rho * A * L / 6) * [2, 1; 1, 2]
   */
  static computeBarConsistentMass(rho: number, A: number, L: number): Matrix {
    const factor = (rho * A * L) / 6.0;
    return new Matrix(2, 2, [
      [2 * factor, factor],
      [factor, 2 * factor]
    ]);
  }

  /**
   * Computes the lumped mass matrix for a 1D BAR element.
   * Me = (rho * A * L / 2) * [1, 0; 0, 1]
   */
  static computeBarLumpedMass(rho: number, A: number, L: number): Matrix {
    const factor = (rho * A * L) / 2.0;
    return new Matrix(2, 2, [
      [factor, 0],
      [0, factor]
    ]);
  }

  /**
   * General mass matrix for a TRI3 element (consistent).
   * Me = (rho * t * Area / 12) * [2, 1, 1; 1, 2, 1; 1, 1, 2] * I_dim
   */
  static computeTri3ConsistentMass(rho: number, thickness: number, area: number, dim: number = 2): Matrix {
    const factor = (rho * thickness * area) / 12.0;
    const nodeCount = 3;
    const totalDofs = nodeCount * dim;
    const M = Matrix.zeros(totalDofs, totalDofs);

    for (let a = 0; a < nodeCount; a++) {
      for (let b = 0; b < nodeCount; b++) {
        const val = (a === b ? 2 : 1) * factor;
        for (let d = 0; d < dim; d++) {
          M.set(a * dim + d, b * dim + d, val);
        }
      }
    }
    return M;
  }
}
