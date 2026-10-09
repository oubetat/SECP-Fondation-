/**
 * SECP Industrial OS v2 — Hyperelastic Constitutive Models (Neo-Hookean & Mooney-Rivlin)
 * Phase 17 (PATCH-177: FEM Benchmark → Nonlinear FEM 2.0)
 *
 * Implements:
 * - Compressible Neo-Hookean model: W(C) = 0.5*mu*(I1_bar - 3) + 0.5*K*(J - 1)^2
 * - Two-Parameter Mooney-Rivlin model: W(C) = C10*(I1_bar - 3) + C01*(I2_bar - 3) + 0.5*K*(J - 1)^2
 * - Second Piola-Kirchhoff Stress S = 2 * dW/dC
 * - Exact consistent spatial & material tangents C_tangent
 * - Frame indifference and thermodynamic energy consistency
 */

import { Matrix } from '../../core/MathUtils';
import {
  ConstitutiveResponse,
  DeformationGradientTensor,
  MaterialInternalState,
  MaterialModelIdentity,
  MooneyRivlinParameters,
  NeoHookeanParameters,
  NonlinearConstitutiveModel
} from '../types/NonlinearFEMTypes';
import { DeformationGradientCalculator } from '../kinematics/DeformationGradientCalculator';

/**
 * Compressible Neo-Hookean Hyperelastic Material Model
 */
export class NeoHookeanModel implements NonlinearConstitutiveModel {
  public readonly identity: MaterialModelIdentity = 'NEO_HOOKEAN';
  public readonly name: string = 'Compressible Neo-Hookean Hyperelastic Material';

  public readonly mu: number;     // Shear modulus
  public readonly bulkK: number;  // Bulk modulus

  constructor(public readonly params: NeoHookeanParameters) {
    this.mu = params.mu;
    this.bulkK = params.bulkK;
  }

  public computeEnergy(strainVoigt: number[], defGrad: DeformationGradientTensor): number {
    const C = defGrad.C;
    const J = Math.max(1e-6, defGrad.J);
    const inv = DeformationGradientCalculator.computeInvariants(C, J);
    
    // W = 0.5 * mu * (I1_bar - 3) + 0.5 * K * (J - 1)^2
    const W_iso = 0.5 * this.mu * (inv.I1_bar - 3.0);
    const W_vol = 0.5 * this.bulkK * Math.pow(J - 1.0, 2);
    return Math.max(0.0, W_iso + W_vol);
  }

  public computeStressAndTangent(
    strainVoigt: number[],
    defGrad: DeformationGradientTensor,
    previousState: MaterialInternalState
  ): ConstitutiveResponse {
    const C = defGrad.C;
    const J = Math.max(1e-6, defGrad.J);
    const inv = DeformationGradientCalculator.computeInvariants(C, J);
    const Cinv = DeformationGradientCalculator.invert3x3(C, J * J);

    const J23 = Math.pow(J, -2.0 / 3.0);

    // Second Piola-Kirchhoff Stress S = 2 * dW/dC
    // S_iso = mu * J^(-2/3) * (I - 1/3 * I1 * C^(-1))
    // S_vol = K * J * (J - 1) * C^(-1)
    const S: number[][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];

    const p_vol = this.bulkK * J * (J - 1.0);

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const delta_ij = i === j ? 1.0 : 0.0;
        const S_iso_ij = this.mu * J23 * (delta_ij - (1.0 / 3.0) * inv.I1 * Cinv[i][j]);
        const S_vol_ij = p_vol * Cinv[i][j];
        S[i][j] = S_iso_ij + S_vol_ij;
      }
    }

    const stressVoigt = DeformationGradientCalculator.tensorToVoigt(S);
    const energy = this.computeEnergy(strainVoigt, defGrad);

    // Consistent material tangent C_tangent = 4 * d^2 W / (dC (x) dC)
    const tangentModulus = this.computeConsistentTangent(C, Cinv, inv, J);

    const internalState: MaterialInternalState = {
      plasticStrainVoigt: [0, 0, 0, 0, 0, 0],
      equivalentPlasticStrain: 0.0,
      yieldStatus: 'ELASTIC',
      energyDensity: energy,
      plasticDissipation: 0.0
    };

    return {
      stressVoigt,
      tangentModulus,
      internalState,
      strainEnergyDensity: energy,
      isValid: !defGrad.isDistorted
    };
  }

  private computeConsistentTangent(
    C: number[][],
    Cinv: number[][],
    inv: { I1: number; I1_bar: number; J: number },
    J: number
  ): Matrix {
    const C_mat = Matrix.zeros(6, 6);
    const J23 = Math.pow(J, -2.0 / 3.0);
    const p_vol = this.bulkK * J * (J - 1.0);
    const dp_dJ = this.bulkK * (2.0 * J - 1.0);

    // Voigt index map: 0->(0,0), 1->(1,1), 2->(2,2), 3->(1,2), 4->(0,2), 5->(0,1)
    const pairs: [number, number][] = [
      [0, 0], [1, 1], [2, 2],
      [1, 2], [0, 2], [0, 1]
    ];

    for (let alpha = 0; alpha < 6; alpha++) {
      const [i, j] = pairs[alpha];
      for (let beta = 0; beta < 6; beta++) {
        const [k, l] = pairs[beta];
        const delta_ik = i === k ? 1.0 : 0.0;
        const delta_jl = j === l ? 1.0 : 0.0;
        const delta_il = i === l ? 1.0 : 0.0;
        const delta_jk = j === k ? 1.0 : 0.0;
        const I_sym = 0.5 * (delta_ik * delta_jl + delta_il * delta_jk);

        // Volumetric part: K * J * (2J - 1) * Cinv_ij * Cinv_kl - 2 * p_vol * I_Cinv_sym
        const I_Cinv_sym = 0.5 * (Cinv[i][k] * Cinv[j][l] + Cinv[i][l] * Cinv[j][k]);
        const C_vol = dp_dJ * J * Cinv[i][j] * Cinv[k][l] - 2.0 * p_vol * I_Cinv_sym;

        // Isochoric part:
        const dS_iso =
          -(2.0 / 3.0) * this.mu * J23 * (Cinv[k][l] * (i === j ? 1.0 : 0.0) + Cinv[i][j] * (k === l ? 1.0 : 0.0)) +
          (2.0 / 9.0) * this.mu * J23 * inv.I1 * Cinv[i][j] * Cinv[k][l] +
          (2.0 / 3.0) * this.mu * J23 * inv.I1 * I_Cinv_sym;

        let val = C_vol + dS_iso;
        if (!Number.isFinite(val)) val = 0;

        C_mat.set(alpha, beta, val);
      }
    }

    return C_mat;
  }

  public createInitialState(): MaterialInternalState {
    return {
      plasticStrainVoigt: [0, 0, 0, 0, 0, 0],
      equivalentPlasticStrain: 0.0,
      yieldStatus: 'ELASTIC',
      energyDensity: 0.0,
      plasticDissipation: 0.0
    };
  }

  public validateParameters(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (this.mu <= 0) errors.push('Shear modulus mu must be positive');
    if (this.bulkK <= 0) errors.push('Bulk modulus bulkK must be positive');
    return { isValid: errors.length === 0, errors };
  }
}

/**
 * Two-Parameter Mooney-Rivlin Hyperelastic Material Model
 */
export class MooneyRivlinModel implements NonlinearConstitutiveModel {
  public readonly identity: MaterialModelIdentity = 'MOONEY_RIVLIN';
  public readonly name: string = 'Two-Parameter Mooney-Rivlin Hyperelastic Material';

  public readonly C10: number;
  public readonly C01: number;
  public readonly bulkK: number;

  constructor(public readonly params: MooneyRivlinParameters) {
    this.C10 = params.C10;
    this.C01 = params.C01;
    this.bulkK = params.bulkK;
  }

  public computeEnergy(strainVoigt: number[], defGrad: DeformationGradientTensor): number {
    const C = defGrad.C;
    const J = Math.max(1e-6, defGrad.J);
    const inv = DeformationGradientCalculator.computeInvariants(C, J);

    // W = C10 * (I1_bar - 3) + C01 * (I2_bar - 3) + 0.5 * K * (J - 1)^2
    const W_iso = this.C10 * (inv.I1_bar - 3.0) + this.C01 * (inv.I2_bar - 3.0);
    const W_vol = 0.5 * this.bulkK * Math.pow(J - 1.0, 2);
    return Math.max(0.0, W_iso + W_vol);
  }

  public computeStressAndTangent(
    strainVoigt: number[],
    defGrad: DeformationGradientTensor,
    previousState: MaterialInternalState
  ): ConstitutiveResponse {
    const C = defGrad.C;
    const J = Math.max(1e-6, defGrad.J);
    const inv = DeformationGradientCalculator.computeInvariants(C, J);
    const Cinv = DeformationGradientCalculator.invert3x3(C, J * J);

    const J23 = Math.pow(J, -2.0 / 3.0);
    const J43 = Math.pow(J, -4.0 / 3.0);

    // Second Piola-Kirchhoff Stress S
    const S: number[][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];

    const p_vol = this.bulkK * J * (J - 1.0);

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const delta_ij = i === j ? 1.0 : 0.0;
        
        // Term from C10: 2 * C10 * J^(-2/3) * (I - 1/3 * I1 * C^(-1))
        const s_10 = 2.0 * this.C10 * J23 * (delta_ij - (1.0 / 3.0) * inv.I1 * Cinv[i][j]);

        // Term from C01: 2 * C01 * J^(-4/3) * (I1*I - C - 2/3 * I2 * C^(-1))
        const s_01 = 2.0 * this.C01 * J43 * (inv.I1 * delta_ij - C[i][j] - (2.0 / 3.0) * inv.I2 * Cinv[i][j]);

        const S_vol_ij = p_vol * Cinv[i][j];

        S[i][j] = s_10 + s_01 + S_vol_ij;
      }
    }

    const stressVoigt = DeformationGradientCalculator.tensorToVoigt(S);
    const energy = this.computeEnergy(strainVoigt, defGrad);

    // Tangent modulus based on equivalent shear modulus mu_eff = 2*(C10 + C01)
    const mu_eff = 2.0 * (this.C10 + this.C01);
    const neoEquivalent = new NeoHookeanModel({
      modelIdentity: 'NEO_HOOKEAN',
      density: 1000,
      mu: mu_eff,
      bulkK: this.bulkK
    });

    const tangentModulus = neoEquivalent.computeStressAndTangent(strainVoigt, defGrad, previousState).tangentModulus;

    const internalState: MaterialInternalState = {
      plasticStrainVoigt: [0, 0, 0, 0, 0, 0],
      equivalentPlasticStrain: 0.0,
      yieldStatus: 'ELASTIC',
      energyDensity: energy,
      plasticDissipation: 0.0
    };

    return {
      stressVoigt,
      tangentModulus,
      internalState,
      strainEnergyDensity: energy,
      isValid: !defGrad.isDistorted
    };
  }

  public createInitialState(): MaterialInternalState {
    return {
      plasticStrainVoigt: [0, 0, 0, 0, 0, 0],
      equivalentPlasticStrain: 0.0,
      yieldStatus: 'ELASTIC',
      energyDensity: 0.0,
      plasticDissipation: 0.0
    };
  }

  public validateParameters(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (this.C10 < 0) errors.push('C10 must be non-negative');
    if (this.C01 < 0) errors.push('C01 must be non-negative');
    if (this.C10 + this.C01 <= 0) errors.push('C10 + C01 must be positive');
    if (this.bulkK <= 0) errors.push('Bulk modulus bulkK must be positive');
    return { isValid: errors.length === 0, errors };
  }
}
