/**
 * SECP Industrial OS — Engineering Truth OS
 * ProgressiveDamageJ2Plasticity3D.ts
 *
 * SECP-PHYSICS-EXPANSION-007: Progressive Damage, Fatigue & Remaining Useful Life Physics.
 *
 * Implements J2 Plasticity coupled with Isotropic Scalar Damage D.
 * Stiffness Softening: E_eff = E * (1 - D).
 * Damage Evolution: Delta D = (cyclesPerStep) / Nf(sigma_a).
 */

import { Matrix } from "../../core/MathUtils";
import { IntegrationPointState, FEMMaterial } from "../../core/FEMTypes";
import { ConstitutiveModel, ConstitutiveResult } from "../../core/ConstitutiveModel";

export interface DamageOptions {
  cyclesPerStep?: number; // How many fatigue cycles are simulated per FEM increment
  damageThreshold?: number; // Damage at which the element is considered failed (e.g. 0.99)
}

export class ProgressiveDamageJ2Plasticity3D implements ConstitutiveModel {
  constructor(
    public readonly material: FEMMaterial,
    public readonly options: DamageOptions = { cyclesPerStep: 1, damageThreshold: 0.99 }
  ) {
    if (!material.fatigueParams) {
      throw new Error("[INVALID_MATERIAL] ProgressiveDamage model requires fatigueParams (UTS, sf_prime, b)");
    }
  }

  public getInitialState(): IntegrationPointState {
    return {
      stress: new Array(6).fill(0),
      plasticStrain: new Array(6).fill(0),
      equivalentPlasticStrain: 0,
      yieldStress: this.material.yieldStress ?? 350.0,
      damage: 0,
      accumulatedCycles: 0
    };
  }

  /**
   * Calculates Cycles to Failure N_f using Basquin's equation:
   * sigma_a = sf_prime * (2 * N_f)^b
   */
  private calculateNf(sigma_a: number): number {
    const { sf_prime, b, enduranceLimit } = this.material.fatigueParams!;
    
    if (!sf_prime || !b) return Infinity;
    if (enduranceLimit && sigma_a < enduranceLimit) return Infinity;
    if (sigma_a <= 0) return Infinity;

    // (2 * N_f) = (sigma_a / sf_prime)^(1/b)
    const ratio = sigma_a / sf_prime;
    const reversals = Math.pow(ratio, 1.0 / b);
    return reversals / 2.0;
  }

  public update(
    strainIncrement: number[],
    previousState: IntegrationPointState,
    temperature?: number
  ): ConstitutiveResult {
    const { E, nu, yieldStress, tangentModulus, fatigueParams } = this.material;
    const H = tangentModulus ?? 0;
    const D_n = previousState.damage ?? 0;
    
    // Stiffness Softening
    const E_eff = E * (1.0 - D_n);
    const mu = E_eff / (2.0 * (1.0 + nu));
    const lambda = (E_eff * nu) / ((1.0 + nu) * (1.0 - 2.0 * nu));

    // 1. Elastic Matrix D_e (Damaged)
    const De = new Matrix(6, 6, [
      [lambda + 2 * mu, lambda, lambda, 0, 0, 0],
      [lambda, lambda + 2 * mu, lambda, 0, 0, 0],
      [lambda, lambda, lambda + 2 * mu, 0, 0, 0],
      [0, 0, 0, mu, 0, 0],
      [0, 0, 0, 0, mu, 0],
      [0, 0, 0, 0, 0, mu]
    ]);

    // 2. Trial Stress
    const sigma_n = previousState.stress;
    const sigma_trial = new Array(6);
    for (let i = 0; i < 6; i++) {
      let sum = 0;
      for (let j = 0; j < 6; j++) sum += De.get(i, j) * strainIncrement[j];
      sigma_trial[i] = sigma_n[i] + sum;
    }

    // 3. Radial Return
    const p_trial = (sigma_trial[0] + sigma_trial[1] + sigma_trial[2]) / 3.0;
    const s_trial = [
      sigma_trial[0] - p_trial,
      sigma_trial[1] - p_trial,
      sigma_trial[2] - p_trial,
      sigma_trial[3],
      sigma_trial[4],
      sigma_trial[5]
    ];
    const s_norm_sq = s_trial[0] ** 2 + s_trial[1] ** 2 + s_trial[2] ** 2 + 
                      2 * (s_trial[3] ** 2 + s_trial[4] ** 2 + s_trial[5] ** 2);
    const q_trial = Math.sqrt(1.5 * s_norm_sq);

    const currentYield = (yieldStress ?? 350.0) + H * previousState.equivalentPlasticStrain;
    const f_trial = q_trial - currentYield;

    let sigma_final = [...sigma_trial];
    let p_final = previousState.equivalentPlasticStrain;
    let plasticStrain_final = [...previousState.plasticStrain];
    let tangent = De;

    if (f_trial > 1e-10) {
      const delta_gamma = f_trial / (3.0 * mu + H);
      const factor = 1.0 - (3.0 * mu * delta_gamma) / q_trial;
      
      for (let i = 0; i < 3; i++) sigma_final[i] = s_trial[i] * factor + p_trial;
      for (let i = 3; i < 6; i++) sigma_final[i] = s_trial[i] * factor;

      p_final += delta_gamma;
      
      // Update plastic strain tensor
      const flowDir = s_trial.map(v => 1.5 * v / q_trial);
      for (let i = 0; i < 6; i++) plasticStrain_final[i] += delta_gamma * flowDir[i];

      // Note: Real D_alg would need to account for damage change, but for small increments 
      // we use the softened elastoplastic tangent.
    }

    // 4. Damage Evolution (Fatigue)
    // Assume von Mises stress represents the effective amplitude for this block
    const vonMises = Math.sqrt(0.5 * (
      (sigma_final[0] - sigma_final[1]) ** 2 +
      (sigma_final[1] - sigma_final[2]) ** 2 +
      (sigma_final[2] - sigma_final[0]) ** 2 +
      6 * (sigma_final[3] ** 2 + sigma_final[4] ** 2 + sigma_final[5] ** 2)
    ));

    const Nf = this.calculateNf(vonMises);
    const cyclesPerStep = this.options?.cyclesPerStep ?? 1;
    const damageThreshold = this.options?.damageThreshold ?? 0.99;
    const deltaD = isFinite(Nf) ? (cyclesPerStep / Nf) : 0;
    
    let D_next = Math.min(damageThreshold, D_n + deltaD);

    // Fail-Closed: If damage is negative or NaN
    if (isNaN(D_next) || D_next < 0) {
      throw new Error(`[NUMERICAL_FAILURE] Invalid damage state D=${D_next} detected at integration point`);
    }

    return {
      stress: sigma_final,
      tangent: tangent,
      state: {
        stress: sigma_final,
        plasticStrain: plasticStrain_final,
        equivalentPlasticStrain: p_final,
        yieldStress: currentYield,
        damage: D_next,
        accumulatedCycles: (previousState.accumulatedCycles ?? 0) + this.options.cyclesPerStep!
      }
    };
  }
}
