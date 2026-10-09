import { Matrix } from "../core/MathUtils";
import { PolarDecompositionResult } from "./types";

export class PolarDecomposition {
  /**
   * Performs polar decomposition F = RU.
   * Currently optimized for 2x2.
   */
  static decompose(F_data: number[][]): PolarDecompositionResult {
    const dim = F_data.length;
    const F = new Matrix(dim, dim, F_data);

    if (dim === 2) {
      return this.decompose2D(F);
    } else if (dim === 1) {
      const f = F.get(0, 0);
      const r = f >= 0 ? 1 : -1;
      const u = Math.abs(f);
      return {
        R: [[r]],
        U: [[u]],
        V: [[u]]
      };
    }

    // Default fallback: return identity if not implemented for dim > 2
    return {
      R: Matrix.zeros(dim, dim).data,
      U: Matrix.zeros(dim, dim).data,
      V: Matrix.zeros(dim, dim).data
    };
  }

  private static decompose2D(F: Matrix): PolarDecompositionResult {
    // C = F^T * F = U^2
    const FT = F.transpose();
    const C = FT.multiply(F);

    const c11 = C.get(0, 0);
    const c12 = C.get(0, 1);
    const c22 = C.get(1, 1);

    // Eigenvalues of C: lambda^2
    const trace = c11 + c22;
    const det = c11 * c22 - c12 * c12;
    const disc = Math.sqrt(trace * trace / 4 - det);
    
    const eig1 = trace / 2 + disc;
    const eig2 = trace / 2 - disc;

    const s1 = Math.sqrt(Math.max(0, eig1));
    const s2 = Math.sqrt(Math.max(0, eig2));

    // Principal stretches U in principal basis
    // We can compute U = sqrt(C) using Cayley-Hamilton for 2x2:
    // sqrt(C) = 1/(s1 + s2) * (C + s1*s2*I)
    const sSum = s1 + s2;
    const sProd = s1 * s2;

    const U = Matrix.zeros(2, 2);
    if (sSum > 1e-15) {
      const invSum = 1 / sSum;
      U.set(0, 0, (c11 + sProd) * invSum);
      U.set(0, 1, c12 * invSum);
      U.set(1, 0, c12 * invSum);
      U.set(1, 1, (c22 + sProd) * invSum);
    } else {
      // Degenerate
      U.set(0, 0, 0);
      U.set(1, 1, 0);
    }

    // R = F * U^-1
    let R: Matrix;
    try {
      const Uinv = U.inverse();
      R = F.multiply(Uinv);
    } catch (e) {
      // Fallback for singular U
      R = Matrix.zeros(2, 2);
      R.set(0, 0, 1);
      R.set(1, 1, 1);
    }

    // V = R * U * R^T
    const V = R.multiply(U).multiply(R.transpose());

    return {
      R: R.data,
      U: U.data,
      V: V.data
    };
  }

  static validateRotation(R_data: number[][], tolerance = 1e-6): void {
    const dim = R_data.length;
    const R = new Matrix(dim, dim, R_data);
    const RT = R.transpose();
    const RTR = RT.multiply(R);

    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        const expected = i === j ? 1 : 0;
        if (Math.abs(RTR.get(i, j) - expected) > tolerance) {
          throw new Error("KINEMATIC_INVALID: Rotation matrix is not orthogonal");
        }
      }
    }

    const det = R.determinant();
    if (Math.abs(det - 1.0) > tolerance) {
      throw new Error("KINEMATIC_INVALID: Rotation matrix determinant is not 1");
    }
  }
}
