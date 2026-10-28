/**
 * SECP Industrial OS — Engineering Truth OS
 * HyperelasticMooneyRivlin3D.ts
 *
 * SECP-PHYSICS-EXPANSION-002: Compressible Mooney-Rivlin 3D Hyperelastic Model.
 *
 * Strain Energy Density Potential W(C):
 *   W(C) = C10 * (I1_bar - 3) + C01 * (I2_bar - 3) + 0.5 * K * (J - 1)^2
 *
 * Admissibility Conditions:
 *   - C10 + C01 > 0
 *   - C10 >= 0, C01 >= 0
 *   - K > 0 (bulk modulus)
 *   - J > 0 (non-inverted deformation)
 *
 * 2nd Piola-Kirchhoff Stress S:
 *   S = 2 * dW/dC = S_iso + S_vol
 *   S_iso = 2 * J^(-2/3) * [ (C10 + C01 * I1_bar)*I - C01*C_bar - (1/3)*(C10*I1_bar + 2*C01*I2_bar)*C^-1 ]
 *   S_vol = K * J * (J - 1) * C^-1
 *
 * Material Tangent Elasticity Tensor C_mat = 4 * d^2W / (dC dC)
 */

import { Matrix } from "./MathUtils";
import { ConstitutiveModel, ConstitutiveResult } from "./ConstitutiveModel";
import { IntegrationPointState } from "./FEMTypes";
import { HyperelasticNeoHookean3D } from "./HyperelasticNeoHookean3D";

export interface MooneyRivlinParameters {
  C10: number; // [MPa]
  C01: number; // [MPa]
  K: number;   // Bulk modulus [MPa]
  alphaE?: number; // Temperature coefficient [1/K]
  refTempC?: number; // Reference temperature [C]
}

export class HyperelasticMooneyRivlin3D implements ConstitutiveModel {
  public readonly C10: number;
  public readonly C01: number;
  public readonly K: number;
  public readonly mu: number;
  public readonly alphaE: number;
  public readonly refTempC: number;

  constructor(params: MooneyRivlinParameters) {
    this.alphaE = params.alphaE ?? 0.0;
    this.refTempC = params.refTempC ?? 20.0;

    if (params.C10 < 0 || !Number.isFinite(params.C10)) {
      throw new Error(`[INVALID_MOONEY_RIVLIN_PARAM] C10 must be >= 0, got ${params.C10}`);
    }
    if (params.C01 < 0 || !Number.isFinite(params.C01)) {
      throw new Error(`[INVALID_MOONEY_RIVLIN_PARAM] C01 must be >= 0, got ${params.C01}`);
    }
    if (params.C10 + params.C01 <= 0) {
      throw new Error(`[INVALID_MOONEY_RIVLIN_PARAM] C10 + C01 must be strictly positive.`);
    }
    if (params.K <= 0 || !Number.isFinite(params.K)) {
      throw new Error(`[INVALID_MOONEY__PARAM] Bulk modulus K must be > 0, got ${params.K}`);
    }

    this.C10 = params.C10;
    this.C01 = params.C01;
    this.K = params.K;
    this.mu = 2.0 * (params.C10 + params.C01); // Initial shear modulus
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
   * Evaluates strain energy W, 2nd PK stress S, and 6x6 tangent elasticity matrix C_mat.
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
        for (let k = 0; k < 3; k++) sum += F[k][i] * F[k][j];
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

    const C10_eff = this.C10 * factor;
    const C01_eff = this.C01 * factor;
    const K_eff = this.K * factor;

    const J23 = Math.pow(J, -2.0 / 3.0);
    const J43 = Math.pow(J, -4.0 / 3.0);

    const I1 = C[0][0] + C[1][1] + C[2][2];
    const I1_bar = J23 * I1;

    let C_sq_tr = 0;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        C_sq_tr += C[i][j] * C[j][i];
      }
    }
    const I2 = 0.5 * (I1 * I1 - C_sq_tr);
    const I2_bar = J43 * I2;

    const W_iso = C10_eff * (I1_bar - 3.0) + C01_eff * (I2_bar - 3.0);
    const W_vol = 0.5 * K_eff * Math.pow(J - 1.0, 2);
    const strainEnergy = W_iso + W_vol;

    const dWdI1b = C10_eff;
    const dWdI2b = C01_eff;

    const S_iso: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const delta = (i === j) ? 1.0 : 0.0;
        const dI1b_dC = J23 * (delta - (1.0 / 3.0) * I1 * C_inv[i][j]);
        const dI2b_dC = J43 * (I1 * delta - C[i][j] - (2.0 / 3.0) * I2 * C_inv[i][j]);
        S_iso[i][j] = 2.0 * (dWdI1b * dI1b_dC + dWdI2b * dI2b_dC);
      }
    }

    const p_vol = K_eff * J * (J - 1.0);
    const S_tensor: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        S_tensor[i][j] = S_iso[i][j] + p_vol * C_inv[i][j];
      }
    }

    const S_voigt = [
      S_tensor[0][0], S_tensor[1][1], S_tensor[2][2],
      S_tensor[0][1], S_tensor[1][2], S_tensor[0][2]
    ];

    const voigtPairs: [number, number][] = [[0, 0], [1, 1], [2, 2], [0, 1], [1, 2], [0, 2]];
    const C_mat = new Matrix(6, 6);
    const II_sym = (i: number, j: number, k: number, l: number) => 0.5 * (C_inv[i][k] * C_inv[j][l] + C_inv[i][l] * C_inv[j][k]);

    for (let a = 0; a < 6; a++) {
      const [i, j] = voigtPairs[a];
      for (let b = 0; b < 6; b++) {
        const [k, l] = voigtPairs[b];
        const delta_ij = (i === j) ? 1.0 : 0.0;
        const delta_kl = (k === l) ? 1.0 : 0.0;
        const delta_ik = (i === k) ? 1.0 : 0.0;
        const delta_jl = (j === l) ? 1.0 : 0.0;
        const delta_il = (i === l) ? 1.0 : 0.0;
        const delta_jk = (j === k) ? 1.0 : 0.0;
        const I_sym_ikjl = 0.5 * (delta_ik * delta_jl + delta_il * delta_jk);

        const d2Wvol = K_eff * J * (2 * J - 1) * C_inv[i][j] * C_inv[k][l] - 2.0 * K_eff * J * (J - 1) * II_sym(i, j, k, l);
        const d2I1b = J23 * ((1.0 / 9.0) * I1 * C_inv[i][j] * C_inv[k][l] - (1.0 / 3.0) * delta_ij * C_inv[k][l] - (1.0 / 3.0) * C_inv[i][j] * delta_kl + (1.0 / 3.0) * I1 * II_sym(i, j, k, l));
        const d2I2b = J43 * ((4.0 / 9.0) * I2 * C_inv[i][j] * C_inv[k][l] - (2.0 / 3.0) * (I1 * delta_ij - C[i][j]) * C_inv[k][l] - (2.0 / 3.0) * C_inv[i][j] * (I1 * delta_kl - C[k][l]) + (2.0 / 3.0) * I2 * II_sym(i, j, k, l) + delta_ij * delta_kl - I_sym_ikjl);

        C_mat.set(a, b, 4.0 * (dWdI1b * d2I1b + dWdI2b * d2I2b) + d2Wvol);
      }
    }

    return {
      S_tensor, S_voigt, C_mat, J, strainEnergy
    };
  }

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
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) sum += F[k][i] * F[k][j];
      C[i][j] = sum;
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
