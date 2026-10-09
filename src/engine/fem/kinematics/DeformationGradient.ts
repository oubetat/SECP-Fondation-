import { Matrix } from "../core/MathUtils";
import { DeformationGradientResult, LargeDeformationFailureType } from "./types";

export class DeformationGradient {
  /**
   * Computes the deformation gradient tensor F = dx/dX.
   * @param referenceCoords Reference nodal coordinates (X) [nodeCount][dim]
   * @param currentCoords Current nodal coordinates (x) [nodeCount][dim]
   * @param dNdX Shape function derivatives with respect to reference coordinates [nodeCount][dim]
   */
  static compute(
    referenceCoords: number[][],
    currentCoords: number[][],
    dNdX: number[][]
  ): DeformationGradientResult {
    const dim = referenceCoords[0].length;
    const nodeCount = referenceCoords.length;

    const F = Matrix.zeros(dim, dim);

    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        let sum = 0;
        for (let a = 0; a < nodeCount; a++) {
          sum += currentCoords[a][i] * dNdX[a][j];
        }
        F.set(i, j, sum);
      }
    }

    const J = F.determinant();

    if (J <= 0) {
      // In physical cases, J must be positive.
      // Negative J implies element inversion.
    }

    return {
      F: F.data,
      J
    };
  }

  /**
   * Simple 1D stretch for BAR elements
   */
  static computeBar1D(referenceLength: number, currentLength: number): DeformationGradientResult {
    const F_val = currentLength / referenceLength;
    return {
      F: [[F_val]],
      J: F_val
    };
  }

  /**
   * Helper to validate Jacobian
   */
  static validateJacobian(J: number): void {
    if (J <= 0) {
      throw new Error(LargeDeformationFailureType.NEGATIVE_JACOBIAN);
    }
  }
}
