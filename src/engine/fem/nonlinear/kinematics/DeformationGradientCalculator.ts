/**
 * SECP Industrial OS v2 — Deformation Gradient & Finite Strain Engine
 * Phase 17 (PATCH-177: FEM Benchmark → Nonlinear FEM 2.0)
 *
 * Computes:
 * - Deformation Gradient tensor F = dx/dX
 * - Jacobian determinant J = det(F) with strict J > 0 inversion validation
 * - Inverse F^(-1) and transpose F^T
 * - Right Cauchy-Green deformation tensor C = F^T * F
 * - Left Cauchy-Green deformation tensor B = F * F^T
 * - Green-Lagrange strain tensor E = 0.5 * (C - I)
 * - Euler-Almansi strain tensor e = 0.5 * (I - B^(-1))
 * - Spectral / invariant measures (I1, I2, I3)
 */

import { DeformationGradientTensor } from '../types/NonlinearFEMTypes';

export class DeformationGradientCalculator {
  /**
   * Computes the 3D deformation gradient from reference nodal coordinates and displacement gradients.
   * F_ij = delta_ij + du_i / dX_j = sum(x_a_i * dN_a / dX_j)
   */
  public static compute3D(
    currentCoords: number[][],    // [nodeCount x 3]
    dNdX: number[][]             // [nodeCount x 3] shape function derivatives w.r.t reference coords
  ): DeformationGradientTensor {
    const nodeCount = currentCoords.length;
    const F: number[][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let sum = 0;
        for (let a = 0; a < nodeCount; a++) {
          sum += currentCoords[a][i] * dNdX[a][j];
        }
        F[i][j] = sum;
      }
    }

    const J = this.determinant3x3(F);
    const isDistorted = J <= 1e-9 || !Number.isFinite(J);

    const Finv = isDistorted ? this.identity3x3() : this.invert3x3(F, J);
    const FT = this.transpose3x3(F);

    // C = F^T * F
    const C = this.multiply3x3(FT, F);
    // B = F * F^T
    const B = this.multiply3x3(F, FT);

    // E = 0.5 * (C - I)
    const GreenLagrangeStrain: number[][] = [
      [0.5 * (C[0][0] - 1.0), 0.5 * C[0][1], 0.5 * C[0][2]],
      [0.5 * C[1][0], 0.5 * (C[1][1] - 1.0), 0.5 * C[1][2]],
      [0.5 * C[2][0], 0.5 * C[2][1], 0.5 * (C[2][2] - 1.0)]
    ];

    // e = 0.5 * (I - B^(-1))
    const Binv = isDistorted ? this.identity3x3() : this.invert3x3(B, J * J);
    const AlmansiStrain: number[][] = [
      [0.5 * (1.0 - Binv[0][0]), -0.5 * Binv[0][1], -0.5 * Binv[0][2]],
      [-0.5 * Binv[1][0], 0.5 * (1.0 - Binv[1][1]), -0.5 * Binv[1][2]],
      [-0.5 * Binv[2][0], -0.5 * Binv[2][1], 0.5 * (1.0 - Binv[2][2])]
    ];

    return {
      F,
      J,
      Finv,
      FT,
      C,
      B,
      GreenLagrangeStrain,
      AlmansiStrain,
      volumetricRatio: J,
      isDistorted
    };
  }

  /**
   * Computes 2D plane strain / plane stress deformation gradient tensor
   */
  public static compute2D(
    currentCoords: number[][],    // [nodeCount x 2]
    dNdX: number[][],            // [nodeCount x 2]
    thicknessStretch: number = 1.0
  ): DeformationGradientTensor {
    const nodeCount = currentCoords.length;
    const F2: number[][] = [
      [0, 0],
      [0, 0]
    ];

    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        let sum = 0;
        for (let a = 0; a < nodeCount; a++) {
          sum += currentCoords[a][i] * dNdX[a][j];
        }
        F2[i][j] = sum;
      }
    }

    const J2D = F2[0][0] * F2[1][1] - F2[0][1] * F2[1][0];
    const J = J2D * thicknessStretch;
    const isDistorted = J <= 1e-9 || !Number.isFinite(J);

    const F3: number[][] = [
      [F2[0][0], F2[0][1], 0],
      [F2[1][0], F2[1][1], 0],
      [0, 0, thicknessStretch]
    ];

    const Finv = isDistorted ? this.identity3x3() : this.invert3x3(F3, J);
    const FT = this.transpose3x3(F3);
    const C = this.multiply3x3(FT, F3);
    const B = this.multiply3x3(F3, FT);

    const GreenLagrangeStrain: number[][] = [
      [0.5 * (C[0][0] - 1.0), 0.5 * C[0][1], 0],
      [0.5 * C[1][0], 0.5 * (C[1][1] - 1.0), 0],
      [0, 0, 0.5 * (C[2][2] - 1.0)]
    ];

    const Binv = isDistorted ? this.identity3x3() : this.invert3x3(B, J * J);
    const AlmansiStrain: number[][] = [
      [0.5 * (1.0 - Binv[0][0]), -0.5 * Binv[0][1], 0],
      [-0.5 * Binv[1][0], 0.5 * (1.0 - Binv[1][1]), 0],
      [0, 0, 0.5 * (1.0 - Binv[2][2])]
    ];

    return {
      F: F3,
      J,
      Finv,
      FT,
      C,
      B,
      GreenLagrangeStrain,
      AlmansiStrain,
      volumetricRatio: J,
      isDistorted
    };
  }

  /**
   * Converts 3x3 strain tensor to 6-entry Voigt vector:
   * [E11, E22, E33, 2E23, 2E13, 2E12] (engineering shear components)
   */
  public static tensorToVoigt(E: number[][]): number[] {
    return [
      E[0][0],
      E[1][1],
      E[2][2],
      2.0 * E[1][2],
      2.0 * E[0][2],
      2.0 * E[0][1]
    ];
  }

  /**
   * Converts 6-entry Voigt vector back to 3x3 symmetric tensor
   */
  public static voigtToTensor(v: number[]): number[][] {
    return [
      [v[0], 0.5 * v[5], 0.5 * v[4]],
      [0.5 * v[5], v[1], 0.5 * v[3]],
      [0.5 * v[4], 0.5 * v[3], v[2]]
    ];
  }

  /**
   * Calculates strain invariants of C (I1, I2, I3) and isochoric invariants (I1_bar, I2_bar)
   */
  public static computeInvariants(C: number[][], J: number) {
    const I1 = C[0][0] + C[1][1] + C[2][2];
    
    // I2 = 0.5 * ((tr C)^2 - tr(C^2))
    const C2_00 = C[0][0]*C[0][0] + C[0][1]*C[1][0] + C[0][2]*C[2][0];
    const C2_11 = C[1][0]*C[0][1] + C[1][1]*C[1][1] + C[1][2]*C[2][1];
    const C2_22 = C[2][0]*C[0][2] + C[2][1]*C[1][2] + C[2][2]*C[2][2];
    const trC2 = C2_00 + C2_11 + C2_22;
    const I2 = 0.5 * (I1 * I1 - trC2);
    
    const I3 = J * J;

    const J23 = Math.pow(J, -2.0 / 3.0);
    const J43 = Math.pow(J, -4.0 / 3.0);
    const I1_bar = J23 * I1;
    const I2_bar = J43 * I2;

    return { I1, I2, I3, I1_bar, I2_bar, J };
  }

  // --- Matrix Helpers ---

  public static determinant3x3(A: number[][]): number {
    return (
      A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
      A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
      A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])
    );
  }

  public static invert3x3(A: number[][], det: number): number[][] {
    if (Math.abs(det) < 1e-15) return this.identity3x3();
    const invDet = 1.0 / det;
    return [
      [
        (A[1][1] * A[2][2] - A[1][2] * A[2][1]) * invDet,
        (A[0][2] * A[2][1] - A[0][1] * A[2][2]) * invDet,
        (A[0][1] * A[1][2] - A[0][2] * A[1][1]) * invDet
      ],
      [
        (A[1][2] * A[2][0] - A[1][0] * A[2][2]) * invDet,
        (A[0][0] * A[2][2] - A[0][2] * A[2][0]) * invDet,
        (A[0][2] * A[1][0] - A[0][0] * A[1][2]) * invDet
      ],
      [
        (A[1][0] * A[2][1] - A[1][1] * A[2][0]) * invDet,
        (A[0][1] * A[2][0] - A[0][0] * A[2][1]) * invDet,
        (A[0][0] * A[1][1] - A[0][1] * A[1][0]) * invDet
      ]
    ];
  }

  public static transpose3x3(A: number[][]): number[][] {
    return [
      [A[0][0], A[1][0], A[2][0]],
      [A[0][1], A[1][1], A[2][1]],
      [A[0][2], A[1][2], A[2][2]]
    ];
  }

  public static multiply3x3(A: number[][], B: number[][]): number[][] {
    const C = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        C[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
      }
    }
    return C;
  }

  public static identity3x3(): number[][] {
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
  }
}
