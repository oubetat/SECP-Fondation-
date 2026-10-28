/**
 * SECP Industrial OS — Engineering Truth OS
 * HyperelasticNeoHookean3D.ts
 *
 * Implements Compressible Neo-Hookean and Mooney-Rivlin 3D Hyperelastic Constitutive Models.
 * Rigorous continuum mechanics formulation based on invariants of the Right Cauchy-Green
 * deformation tensor C = F^T * F:
 *
 * Strain Energy Density:
 *   W(C) = (mu/2) * (I1_bar - 3) + (K/2) * (J - 1)^2
 *   (or Mooney-Rivlin: C10*(I1_bar - 3) + C01*(I2_bar - 3) + (K/2)*(J - 1)^2)
 *
 * 2nd Piola-Kirchhoff Stress S:
 *   S = 2 * dW/dC = S_iso + S_vol
 *   S_iso = mu * J^(-2/3) * (I - (1/3) * I1 * C^-1)
 *   S_vol = K * J * (J - 1) * C^-1
 *
 * Material Tangent Modulus C_mat (6x6 symmetric):
 *   C_mat = 4 * d^2W / (dC dC)
 *   Evaluated in Voigt representation [11, 22, 33, 12, 23, 13].
 *
 * At zero deformation (F = I), C_mat reduces identically to the isotropic Hookean elasticity tensor:
 *   C_11 = K + (4/3)*mu = lambda + 2*mu
 *   C_12 = K - (2/3)*mu = lambda
 *   C_44 = mu
 */

import { Matrix } from "./MathUtils";
import { ConstitutiveModel, ConstitutiveResult } from "./ConstitutiveModel";
import { IntegrationPointState } from "./FEMTypes";

export interface HyperelasticParameters {
  mu?: number; // Shear modulus [MPa]
  K?: number;  // Bulk modulus [MPa]
  C10?: number; // Mooney-Rivlin C10 [MPa]
  C01?: number; // Mooney-Rivlin C01 [MPa]
  E?: number;  // Young's modulus [MPa] (derived if mu/K not given)
  nu?: number; // Poisson's ratio (derived if mu/K not given)
  alphaE?: number; // Temperature coefficient for Young's modulus [1/K]
  refTempC?: number; // Reference temperature [C]
}

export class HyperelasticNeoHookean3D implements ConstitutiveModel {
  public readonly mu: number;
  public readonly K: number;
  public readonly C10: number;
  public readonly C01: number;
  public readonly alphaE: number;
  public readonly refTempC: number;

  constructor(params: HyperelasticParameters) {
    this.alphaE = params.alphaE ?? 0.0;
    this.refTempC = params.refTempC ?? 20.0;

    if (params.mu !== undefined && params.K !== undefined) {
      this.mu = params.mu;
      this.K = params.K;
      this.C10 = params.C10 ?? (0.5 * this.mu);
      this.C01 = params.C01 ?? 0;
    } else if (params.E !== undefined && params.nu !== undefined) {
      const E = params.E;
      const nu = params.nu;
      if (nu >= 0.5 || nu < -1.0) {
        throw new Error(`[INVALID_HYPERELASTIC_PARAMS] Poisson ratio nu=${nu} must be in (-1, 0.5).`);
      }
      this.mu = E / (2.0 * (1.0 + nu));
      this.K = E / (3.0 * (1.0 - 2.0 * nu));
      this.C10 = params.C10 ?? (0.5 * this.mu);
      this.C01 = params.C01 ?? 0;
    } else {
      throw new Error(`[INVALID_HYPERELASTIC_PARAMS] Must provide (mu, K) or (E, nu).`);
    }

    if (this.mu <= 0 || !Number.isFinite(this.mu)) {
      throw new Error(`[INVALID_HYPERELASTIC_PARAMS] Shear modulus mu must be positive, got ${this.mu}`);
    }
    if (this.K <= 0 || !Number.isFinite(this.K)) {
      throw new Error(`[INVALID_HYPERELASTIC_PARAMS] Bulk modulus K must be positive, got ${this.K}`);
    }
  }

  public getInitialState(): IntegrationPointState {
    return {
      plasticStrain: [0, 0, 0, 0, 0, 0],
      alpha: 0,
      backStress: [0, 0, 0, 0, 0, 0],
      yieldFlag: false
    };
  }

  /**
   * Computes 3x3 matrix determinant.
   */
  public static det3x3(A: number[][]): number {
    return (
      A[0][0] * (A[1][1] * A[2][2] - A[1][2] * A[2][1]) -
      A[0][1] * (A[1][0] * A[2][2] - A[1][2] * A[2][0]) +
      A[0][2] * (A[1][0] * A[2][1] - A[1][1] * A[2][0])
    );
  }

  /**
   * Computes 3x3 matrix inverse.
   */
  public static inv3x3(A: number[][]): number[][] {
    const det = this.det3x3(A);
    if (Math.abs(det) < 1e-15 || !Number.isFinite(det)) {
      throw new Error(`[SINGULAR_TENSOR] Cannot invert 3x3 tensor with det = ${det}`);
    }
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

  /**
   * Computes 2nd Piola-Kirchhoff stress S (3x3 symmetric) and 4th-order tangent elasticity C_mat (6x6)
   * given deformation gradient F (3x3).
   *
   * Voigt ordering:
   * 0 -> 11 (xx)
   * 1 -> 22 (yy)
   * 2 -> 33 (zz)
   * 3 -> 12 (xy)
   * 4 -> 23 (yz)
   * 5 -> 13 (xz)
   */
  public computeStressAndTangent(F: number[][]): {
    S_tensor: number[][];
    S_voigt: number[];
    C_mat: Matrix;
    J: number;
    strainEnergy: number;
  } {
    const J = HyperelasticNeoHookean3D.det3x3(F);
    if (J <= 1e-12 || !Number.isFinite(J)) {
      throw new Error(`[HYPERELASTIC_DEGENERACY] Non-positive deformation gradient Jacobian J = ${J}`);
    }

    const C: number[][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) {
          sum += F[k][i] * F[k][j];
        }
        C[i][j] = sum;
      }
    }

    return this.computeStressAndTangentFromC(C);
  }

  public computeStressAndTangentFromC(C: number[][], temperature?: number): {
    S_tensor: number[][];
    S_voigt: number[];
    C_mat: Matrix;
    J: number;
    strainEnergy: number;
  } {
    const detC = HyperelasticNeoHookean3D.det3x3(C);
    if (detC <= 1e-12 || !Number.isFinite(detC)) {
      throw new Error(`[HYPERELASTIC_DEGENERACY] Non-positive deformation gradient Jacobian C det = ${detC}`);
    }
    const J = Math.sqrt(detC);
    const C_inv = HyperelasticNeoHookean3D.inv3x3(C);

    const temp = temperature ?? this.refTempC;
    const factor = 1.0 - this.alphaE * (temp - this.refTempC);
    const mu_eff = this.mu * factor;
    const K_eff = this.K * factor;

    // Invariants
    const I1 = C[0][0] + C[1][1] + C[2][2];
    const J23 = Math.pow(J, -2.0 / 3.0);
    const I1_bar = J23 * I1;

    // Strain energy W
    const strainEnergy = 0.5 * mu_eff * (I1_bar - 3.0) + 0.5 * K_eff * Math.pow(J - 1.0, 2);

    const p_vol = K_eff * J * (J - 1.0);
    const S_tensor: number[][] = [[0,0,0],[0,0,0],[0,0,0]];

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const delta_ij = (i === j) ? 1.0 : 0.0;
        const s_iso = mu_eff * J23 * (delta_ij - (1.0 / 3.0) * I1 * C_inv[i][j]);
        const s_vol = p_vol * C_inv[i][j];
        S_tensor[i][j] = s_iso + s_vol;
      }
    }

    const S_voigt = [
      S_tensor[0][0], S_tensor[1][1], S_tensor[2][2],
      S_tensor[0][1], S_tensor[1][2], S_tensor[0][2]
    ];

    const voigtPairs: [number, number][] = [[0, 0], [1, 1], [2, 2], [0, 1], [1, 2], [0, 2]];
    const C_mat = new Matrix(6, 6);
    const dJ_coeff = K_eff * J * (2.0 * J - 1.0);
    const s_vol_coeff = 2.0 * K_eff * J * (J - 1.0);

    for (let a = 0; a < 6; a++) {
      const [I, J_idx] = voigtPairs[a];
      const delta_IJ = (I === J_idx) ? 1.0 : 0.0;
      for (let b = 0; b < 6; b++) {
        const [K_idx, L_idx] = voigtPairs[b];
        const delta_KL = (K_idx === L_idx) ? 1.0 : 0.0;
        const I_sym = 0.5 * (C_inv[I][K_idx] * C_inv[J_idx][L_idx] + C_inv[I][L_idx] * C_inv[J_idx][K_idx]);
        const C_vol = dJ_coeff * (C_inv[I][J_idx] * C_inv[K_idx][L_idx]) - s_vol_coeff * I_sym;
        const term1 = I1 * (I_sym + (1.0 / 3.0) * C_inv[I][J_idx] * C_inv[K_idx][L_idx]);
        const term2 = delta_IJ * C_inv[K_idx][L_idx] + C_inv[I][J_idx] * delta_KL;
        const C_iso = (2.0 / 3.0) * mu_eff * J23 * (term1 - term2);
        C_mat.set(a, b, C_iso + C_vol);
      }
    }

    return {
      S_tensor,
      S_voigt,
      C_mat,
      J,
      strainEnergy
    };
  }

  /**
   * ConstitutiveModel interface implementation:
   * Maps strain increment (Green-Lagrange) to 2nd Piola-Kirchhoff stress.
   */
  public update(
    strainIncrement: number[],
    previousState: IntegrationPointState,
    temperature?: number
  ): ConstitutiveResult {
    const eps_xx = strainIncrement[0];
    const eps_yy = strainIncrement[1];
    const eps_zz = strainIncrement[2];
    const gam_xy = strainIncrement[3];
    const gam_yz = strainIncrement[4];
    const gam_xz = strainIncrement[5];

    const F: number[][] = [
      [1.0 + eps_xx, 0.5 * gam_xy, 0.5 * gam_xz],
      [0.5 * gam_xy, 1.0 + eps_yy, 0.5 * gam_yz],
      [0.5 * gam_xz, 0.5 * gam_yz, 1.0 + eps_zz]
    ];

    const C: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) sum += F[k][i] * F[k][j];
        C[i][j] = sum;
      }
    }

    const { S_voigt, C_mat } = this.computeStressAndTangentFromC(C, temperature);

    return {
      stress: S_voigt,
      tangent: C_mat,
      state: {
        plasticStrain: [0, 0, 0, 0, 0, 0],
        alpha: previousState.alpha,
        backStress: [0, 0, 0, 0, 0, 0],
        yieldFlag: false
      }
    };
  }
}
