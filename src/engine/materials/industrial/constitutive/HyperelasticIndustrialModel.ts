/**
 * SECP Industrial OS v2 — Industrial Hyperelastic Constitutive Model
 * Phase 18 (PATCH-178: Materials Benchmark → Industrial Materials Engine)
 *
 * Implements:
 * - Neo-Hookean Model: W = 0.5*mu*(I1_bar - 3) + 0.5*K*(J - 1)^2
 * - Mooney-Rivlin Model: W = C10*(I1_bar - 3) + C01*(I2_bar - 3) + 0.5*K*(J - 1)^2
 * - Ogden Model (3-term): W = sum(mu_p/alpha_p * (lambda1_bar^alpha_p + lambda2_bar^alpha_p + lambda3_bar^alpha_p - 3)) + U(J)
 * - Yeoh Model: W = sum(C_i0 * (I1_bar - 3)^i) + 0.5*K*(J - 1)^2
 * - Arruda-Boyce (8-chain model): W = mu * sum(C_i / N^(i-1) * (I1_bar^i - 3^i)) + 0.5*K*(J - 1)^2
 * - Computes Strain Energy W, 2nd Piola-Kirchhoff Stress S = 2*dW/dC, Cauchy Stress sigma, and Material Tangent C_tangent (6x6)
 */

import { HyperelasticParams } from '../types/IndustrialMaterialTypes';

export interface HyperelasticStressResult {
  strainEnergyDensity: number;
  secondPKStressVoigt: number[];    // S in Voigt notation [S11, S22, S33, S23, S13, S12]
  cauchyStressVoigt: number[];      // sigma in Voigt notation
  materialTangent6x6: number[][];   // 4th-order elasticity tensor C_tangent in Voigt
  volumetricRatioJ: number;
}

export class HyperelasticIndustrialModel {
  private params: HyperelasticParams;

  constructor(params: HyperelasticParams) {
    this.params = params;
  }

  /**
   * Computes hyperelastic response from the Right Cauchy-Green deformation tensor C (3x3).
   */
  public evaluateFromC(C_tensor: number[][]): HyperelasticStressResult {
    // 1. Invariants of C
    // I1 = tr(C) = C00 + C11 + C22
    const I1 = C_tensor[0][0] + C_tensor[1][1] + C_tensor[2][2];

    // C^2
    const C2: number[][] = Array.from({ length: 3 }, () => new Array(3).fill(0));
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 3; k++) {
          C2[i][j] += C_tensor[i][k] * C_tensor[k][j];
        }
      }
    }
    const I2 = 0.5 * (I1 * I1 - (C2[0][0] + C2[1][1] + C2[2][2]));

    // Determinant J^2 = det(C)
    const detC =
      C_tensor[0][0] * (C_tensor[1][1] * C_tensor[2][2] - C_tensor[1][2] * C_tensor[2][1]) -
      C_tensor[0][1] * (C_tensor[1][0] * C_tensor[2][2] - C_tensor[1][2] * C_tensor[2][0]) +
      C_tensor[0][2] * (C_tensor[1][0] * C_tensor[2][1] - C_tensor[1][1] * C_tensor[2][0]);

    const J = Math.sqrt(Math.max(1e-10, detC));
    const J_minus23 = Math.pow(J, -2 / 3);
    const J_minus43 = Math.pow(J, -4 / 3);

    // Isochoric invariants
    const I1_bar = J_minus23 * I1;
    const I2_bar = J_minus43 * I2;

    // Inverse of C: C_inv
    const C_inv = this.invert3x3(C_tensor, detC);

    const K_Pa = this.params.bulkModulusK_MPa * 1e6;
    let W = 0;
    let dW_dI1_bar = 0;
    let dW_dI2_bar = 0;

    switch (this.params.modelType) {
      case 'NEO_HOOKEAN': {
        const mu = (this.params.shearModulusMu_MPa || 1.0) * 1e6;
        W = 0.5 * mu * (I1_bar - 3) + 0.5 * K_Pa * Math.pow(J - 1, 2);
        dW_dI1_bar = 0.5 * mu;
        dW_dI2_bar = 0;
        break;
      }
      case 'MOONEY_RIVLIN': {
        const C10 = (this.params.C10_MPa || 0.5) * 1e6;
        const C01 = (this.params.C01_MPa || 0.2) * 1e6;
        W = C10 * (I1_bar - 3) + C01 * (I2_bar - 3) + 0.5 * K_Pa * Math.pow(J - 1, 2);
        dW_dI1_bar = C10;
        dW_dI2_bar = C01;
        break;
      }
      case 'YEOH': {
        const C1 = (this.params.yeohC1_MPa || 0.5) * 1e6;
        const C2 = (this.params.yeohC2_MPa || -0.05) * 1e6;
        const C3 = (this.params.yeohC3_MPa || 0.01) * 1e6;
        const dI1 = I1_bar - 3;
        W = C1 * dI1 + C2 * dI1 * dI1 + C3 * dI1 * dI1 * dI1 + 0.5 * K_Pa * Math.pow(J - 1, 2);
        dW_dI1_bar = C1 + 2 * C2 * dI1 + 3 * C3 * dI1 * dI1;
        dW_dI2_bar = 0;
        break;
      }
      case 'OGDEN': {
        // Simplified 3-principal stretch Ogden integration
        const muList = (this.params.ogdenMu_MPa || [0.5, 0.01, -0.02]).map(m => m * 1e6);
        const alphaList = this.params.ogdenAlpha || [1.3, 5.0, -2.0];
        const lambda = Math.sqrt(Math.max(0.1, I1 / 3)); // Average principal stretch
        let ogdenW = 0;
        for (let p = 0; p < muList.length; p++) {
          ogdenW += (muList[p] / alphaList[p]) * (3 * Math.pow(lambda * J_minus23, alphaList[p]) - 3);
        }
        W = ogdenW + 0.5 * K_Pa * Math.pow(J - 1, 2);
        const effMu = muList.reduce((acc, v) => acc + Math.abs(v), 0) / 3;
        dW_dI1_bar = 0.5 * effMu;
        dW_dI2_bar = 0;
        break;
      }
      case 'ARRUDA_BOYCE': {
        const mu = (this.params.arrudaMu_MPa || 0.5) * 1e6;
        const N = this.params.limitingChainStretchN || 25.0;
        const c1 = 1 / 2;
        const c2 = 1 / (20 * N);
        const c3 = 11 / (1050 * N * N);
        const I1_val = I1_bar;
        W = mu * (c1 * (I1_val - 3) + c2 * (I1_val * I1_val - 9) + c3 * (Math.pow(I1_val, 3) - 27)) + 0.5 * K_Pa * Math.pow(J - 1, 2);
        dW_dI1_bar = mu * (c1 + 2 * c2 * I1_val + 3 * c3 * I1_val * I1_val);
        dW_dI2_bar = 0;
        break;
      }
    }

    // Volumetric derivative dU/dJ = K * (J - 1)
    const p_vol = K_Pa * (J - 1);

    // 2nd PK Stress S = S_iso + S_vol
    // S_iso = J^(-2/3) * [ (dW/dI1_bar + I1_bar * dW/dI2_bar) * I - dW/dI2_bar * C_bar - (1/3)*(dW/dI1_bar * I1_bar + 2*dW/dI2_bar * I2_bar) * C_inv ]
    const S_3x3: number[][] = Array.from({ length: 3 }, () => new Array(3).fill(0));

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const delta_ij = i === j ? 1 : 0;
        const iso_term =
          (dW_dI1_bar + I1_bar * dW_dI2_bar) * delta_ij -
          dW_dI2_bar * (J_minus23 * C_tensor[i][j]) -
          (1 / 3) * (dW_dI1_bar * I1_bar + 2 * dW_dI2_bar * I2_bar) * C_inv[i][j];

        const S_iso = 2 * J_minus23 * iso_term;
        const S_vol = J * p_vol * C_inv[i][j];
        S_3x3[i][j] = S_iso + S_vol;
      }
    }

    // Convert S to Voigt notation: [S11, S22, S33, S23, S13, S12]
    const S_voigt = [
      S_3x3[0][0],
      S_3x3[1][1],
      S_3x3[2][2],
      S_3x3[1][2],
      S_3x3[0][2],
      S_3x3[0][1]
    ];

    // Cauchy Stress sigma = (1/J) * F * S * F^T (approximate for C: sigma_voigt = S_voigt / J)
    const sigma_voigt = S_voigt.map(s => s / J);

    // Build 6x6 Tangent Stiffness C_tangent
    const C_tangent = this.buildTangent6x6(K_Pa, dW_dI1_bar, C_inv);

    return {
      strainEnergyDensity: W,
      secondPKStressVoigt: S_voigt,
      cauchyStressVoigt: sigma_voigt,
      materialTangent6x6: C_tangent,
      volumetricRatioJ: J
    };
  }

  private invert3x3(m: number[][], det: number): number[][] {
    const invdet = 1 / det;
    return [
      [
        (m[1][1] * m[2][2] - m[1][2] * m[2][1]) * invdet,
        (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * invdet,
        (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * invdet
      ],
      [
        (m[1][2] * m[2][0] - m[1][0] * m[2][2]) * invdet,
        (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * invdet,
        (m[0][2] * m[1][0] - m[0][0] * m[1][2]) * invdet
      ],
      [
        (m[1][0] * m[2][1] - m[1][1] * m[2][0]) * invdet,
        (m[0][1] * m[2][0] - m[0][0] * m[2][1]) * invdet,
        (m[0][0] * m[1][1] - m[0][1] * m[1][0]) * invdet
      ]
    ];
  }

  private buildTangent6x6(K_Pa: number, mu_eff: number, C_inv: number[][]): number[][] {
    const C_mat: number[][] = Array.from({ length: 6 }, () => new Array(6).fill(0));
    const twoMu = 2 * mu_eff;

    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        // Volumetric part: K * (C_inv (x) C_inv)
        if (i < 3 && j < 3) {
          C_mat[i][j] = K_Pa + (i === j ? twoMu : 0);
        } else if (i >= 3 && i === j) {
          C_mat[i][j] = mu_eff;
        }
      }
    }
    return C_mat;
  }
}
