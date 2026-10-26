/**
 * SECP Industrial OS — Nonlinear Material Mechanics (SECP-FEM-UPGRADE-010)
 * J2Plasticity3D.ts
 * 
 * Small-strain, rate-independent J2 (von Mises) elastoplasticity with isotropic hardening.
 * Uses Radial Return algorithm for constitutive update.
 */

import { Matrix } from "./MathUtils";
import { IntegrationPointState } from "./FEMTypes";
import { ConstitutiveModel, ConstitutiveResult } from "./ConstitutiveModel";

export class J2Plasticity3D implements ConstitutiveModel {
  constructor(
    public readonly E: number,
    public readonly nu: number,
    public readonly sigma_y0: number,
    public readonly H: number
  ) {
    if (E <= 0) throw new Error("[INVALID_MATERIAL] E must be > 0");
    if (nu <= -1 || nu >= 0.5) throw new Error("[INVALID_MATERIAL] nu must be in (-1, 0.5)");
    if (sigma_y0 <= 0) throw new Error("[INVALID_MATERIAL] sigma_y0 must be > 0");
    if (H < 0) throw new Error("[INVALID_MATERIAL] H must be >= 0");
  }

  getInitialState(): IntegrationPointState {
    return {
      stress: new Array(6).fill(0),
      plasticStrain: new Array(6).fill(0),
      equivalentPlasticStrain: 0,
      yieldStress: this.sigma_y0
    };
  }

  update(
    strainIncrement: number[], // [exx, eyy, ezz, gxy, gyz, gxz]
    previousState: IntegrationPointState
  ): ConstitutiveResult {
    const { E, nu, H } = this;
    const mu = E / (2 * (1 + nu));
    const lambda = (E * nu) / ((1 + nu) * (1 - 2 * nu));

    // 1. Elastic Matrix D_e
    const De = new Matrix(6, 6, [
      [lambda + 2 * mu, lambda, lambda, 0, 0, 0],
      [lambda, lambda + 2 * mu, lambda, 0, 0, 0],
      [lambda, lambda, lambda + 2 * mu, 0, 0, 0],
      [0, 0, 0, mu, 0, 0],
      [0, 0, 0, 0, mu, 0],
      [0, 0, 0, 0, 0, mu]
    ]);

    // 2. Trial Stress: sigma_trial = sigma_n + D_e * delta_epsilon
    const sigma_n = previousState.stress;
    const sigma_trial = new Float64Array(6);
    for (let i = 0; i < 6; i++) {
      let sum = 0;
      for (let j = 0; j < 6; j++) {
        sum += De.get(i, j) * strainIncrement[j];
      }
      sigma_trial[i] = sigma_n[i] + sum;
    }

    // 3. Yield Function Evaluation
    // Deviatoric Stress s = sigma - p*I
    const p_trial = (sigma_trial[0] + sigma_trial[1] + sigma_trial[2]) / 3;
    const s_trial = [
      sigma_trial[0] - p_trial,
      sigma_trial[1] - p_trial,
      sigma_trial[2] - p_trial,
      sigma_trial[3],
      sigma_trial[4],
      sigma_trial[5]
    ];

    // J2 = 1/2 * s:s = 1/2 * (s1^2 + s2^2 + s3^2 + 2*s4^2 + 2*s5^2 + 2*s6^2)
    // Note: s4, s5, s6 are tau_xy, tau_yz, tau_xz
    const s_norm_sq = s_trial[0] ** 2 + s_trial[1] ** 2 + s_trial[2] ** 2 + 
                      2 * (s_trial[3] ** 2 + s_trial[4] ** 2 + s_trial[5] ** 2);
    const q_trial = Math.sqrt(1.5 * s_norm_sq);

    const currentYieldStress = this.sigma_y0 + H * previousState.equivalentPlasticStrain;
    const f_trial = q_trial - currentYieldStress;

    if (f_trial <= 1e-10) {
      // ELASTIC BRANCH
      return {
        stress: Array.from(sigma_trial),
        tangent: De,
        state: { ...previousState, stress: Array.from(sigma_trial) }
      };
    }

    // PLASTIC BRANCH (Radial Return)
    // 4. Compute plastic multiplier delta_gamma
    // delta_gamma = f_trial / (3 * mu + H)
    const delta_gamma = f_trial / (3 * mu + H);

    // 5. Update Stress
    const factor = 1 - (3 * mu * delta_gamma) / q_trial;
    const sigma_final = new Float64Array(6);
    sigma_final[0] = p_trial + factor * s_trial[0];
    sigma_final[1] = p_trial + factor * s_trial[1];
    sigma_final[2] = p_trial + factor * s_trial[2];
    sigma_final[3] = factor * s_trial[3];
    sigma_final[4] = factor * s_trial[4];
    sigma_final[5] = factor * s_trial[5];

    // 6. Update State Variables
    const eq_plastic_strain_new = previousState.equivalentPlasticStrain + delta_gamma;
    const yield_stress_new = this.sigma_y0 + H * eq_plastic_strain_new;

    // Plastic strain increment: delta_ep = delta_gamma * (3/2) * s_trial / q_trial
    const p_factor = (1.5 * delta_gamma) / q_trial;
    const plastic_strain_new = [...previousState.plasticStrain];
    plastic_strain_new[0] += p_factor * s_trial[0];
    plastic_strain_new[1] += p_factor * s_trial[1];
    plastic_strain_new[2] += p_factor * s_trial[2];
    plastic_strain_new[3] += p_factor * s_trial[3] * 2; // Engineering shear strain gamma = 2*epsilon
    plastic_strain_new[4] += p_factor * s_trial[4] * 2;
    plastic_strain_new[5] += p_factor * s_trial[5] * 2;

    const newState: IntegrationPointState = {
      stress: Array.from(sigma_final),
      plasticStrain: plastic_strain_new,
      equivalentPlasticStrain: eq_plastic_strain_new,
      yieldStress: yield_stress_new
    };

    // 7. Consistent Tangent Stiffness Matrix
    // Formula: D_alg = K*M_vol + 2*mu*beta*M_dev - 2*mu*gamma*(n x n)
    const K_bulk = lambda + (2 / 3) * mu;
    const beta = 1 - (3 * mu * delta_gamma) / q_trial;
    const gamma = (3 * mu) / (3 * mu + H) - (1 - beta);

    // s_norm = sqrt(s:s) = q_trial * sqrt(2/3)
    const s_norm = q_trial * Math.sqrt(2 / 3);
    // n_unit = s / ||s||.  Note: ||s||^2 = s1^2+s2^2+s3^2 + 2*s4^2...
    const n_unit = s_trial.map(val => val / s_norm);

    const D_alg = new Matrix(6, 6);
    
    // I_vol = 1 @ 1 (Voigt: 1s in 3x3 top-left)
    const I_vol = new Matrix(6, 6);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) I_vol.set(i, j, 1);

    // I_sym = Diag(1, 1, 1, 0.5, 0.5, 0.5)
    const I_sym = new Matrix(6, 6);
    for (let i = 0; i < 3; i++) I_sym.set(i, i, 1);
    for (let i = 3; i < 6; i++) I_sym.set(i, i, 0.5);

    // M_vol = 1/3 * I_vol
    const M_vol = I_vol.scale(1 / 3);
    // M_dev = I_sym - M_vol
    const M_dev = I_sym.clone().subtractMatrix(M_vol);

    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        // D_alg = K * (1x1) + 2*mu*beta*M_dev - 2*mu*gamma*(n x n)
        let val = K_bulk * I_vol.get(i, j) + 2 * mu * beta * M_dev.get(i, j);
        
        // n x n term.
        val -= 2 * mu * gamma * n_unit[i] * n_unit[j];
        
        D_alg.set(i, j, val);
      }
    }

    return {
      stress: Array.from(sigma_final),
      tangent: D_alg,
      state: newState
    };
  }
}
