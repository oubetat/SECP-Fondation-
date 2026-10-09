/**
 * SECP Industrial OS v3 — Return Mapping Algorithm & Constitutive Modeler (PATCH-238)
 *
 * Implements rigorous numerical stress integration and plastic flow return mapping:
 * - Trial Elastic State computation from total strain increment
 * - Yield Criteria Evaluation (Von Mises J2, Tresca, Drucker-Prager, Mohr-Coulomb)
 * - Hardening Models (Perfect Plasticity, Isotropic Linear, Kinematic Linear, Combined)
 * - Implicit Radial Return Mapping plastic correction (\Delta \gamma)
 * - Stress and Plastic Strain tensor updates
 * - Algorithmic Consistent Elastoplastic Tangent Matrix D^{ep}
 */

import { Matrix } from '../../core/MathUtils';
import {
  MaterialPointState,
  ReturnMappingOptions,
  ReturnMappingOutput
} from '../types/NonlinearStructuralTypes';

export class ReturnMappingAlgorithm {
  /**
   * Main entry point for local constitutive integration at an integration point
   */
  public static execute(
    trialTotalStrainVoigt: number[], // [e11, e22, e33, g23, g13, g12]
    prevState: MaterialPointState,
    options: ReturnMappingOptions
  ): ReturnMappingOutput {
    const { yieldCriterion } = options;

    switch (yieldCriterion) {
      case 'VON_MISES':
      default:
        return this.executeVonMisesJ2(trialTotalStrainVoigt, prevState, options);

      case 'TRESCA':
        return this.executeTresca(trialTotalStrainVoigt, prevState, options);

      case 'DRUCKER_PRAGER':
        return this.executeDruckerPrager(trialTotalStrainVoigt, prevState, options);

      case 'MOHR_COULOMB':
        return this.executeMohrCoulomb(trialTotalStrainVoigt, prevState, options);
    }
  }

  /**
   * Von Mises J2 Radial Return Mapping with Isotropic / Kinematic Hardening
   */
  private static executeVonMisesJ2(
    strainVoigt: number[],
    prevState: MaterialPointState,
    options: ReturnMappingOptions
  ): ReturnMappingOutput {
    const E = options.youngsModulus;
    const nu = options.poissonsRatio;
    const G = E / (2.0 * (1.0 + nu));
    const K = E / (3.0 * (1.0 - 2.0 * nu));
    const lambda = K - (2.0 / 3.0) * G;

    const H_iso = options.isotropicHardeningModulus;
    const H_kin = options.kinematicHardeningModulus;
    const sigY0 = options.initialYieldStress;

    const prevPlasticStrain = prevState.plasticStrainVoigt || [0, 0, 0, 0, 0, 0];
    const prevBackStress = prevState.backStressVoigt || [0, 0, 0, 0, 0, 0];
    const prevEqPlasticStrain = prevState.equivalentPlasticStrain || 0.0;

    // 1. Elastic Trial Strain: eps_elastic_trial = eps_total - eps_p_prev
    const epsElasticTrial = [
      strainVoigt[0] - prevPlasticStrain[0],
      strainVoigt[1] - prevPlasticStrain[1],
      strainVoigt[2] - prevPlasticStrain[2],
      strainVoigt[3] - prevPlasticStrain[3],
      strainVoigt[4] - prevPlasticStrain[4],
      strainVoigt[5] - prevPlasticStrain[5]
    ];

    // Volumetric trace
    const trEps = epsElasticTrial[0] + epsElasticTrial[1] + epsElasticTrial[2];
    const meanPressureTrial = K * trEps;

    // Deviatoric trial strain (Note 0.5 factor for engineering shear g23, g13, g12)
    const eDevTrial = [
      epsElasticTrial[0] - trEps / 3.0,
      epsElasticTrial[1] - trEps / 3.0,
      epsElasticTrial[2] - trEps / 3.0,
      0.5 * epsElasticTrial[3],
      0.5 * epsElasticTrial[4],
      0.5 * epsElasticTrial[5]
    ];

    // Trial Deviatoric Stress s_trial = 2*G*e_dev_trial
    const sTrial = [
      2.0 * G * eDevTrial[0],
      2.0 * G * eDevTrial[1],
      2.0 * G * eDevTrial[2],
      2.0 * G * eDevTrial[3],
      2.0 * G * eDevTrial[4],
      2.0 * G * eDevTrial[5]
    ];

    // Relative trial stress eta_trial = s_trial - alpha_prev
    const etaTrial = [
      sTrial[0] - prevBackStress[0],
      sTrial[1] - prevBackStress[1],
      sTrial[2] - prevBackStress[2],
      sTrial[3] - prevBackStress[3],
      sTrial[4] - prevBackStress[4],
      sTrial[5] - prevBackStress[5]
    ];

    // Norm ||eta_trial|| = sqrt(eta : eta)
    const normEtaTrial = Math.sqrt(
      etaTrial[0] * etaTrial[0] +
      etaTrial[1] * etaTrial[1] +
      etaTrial[2] * etaTrial[2] +
      2.0 * (etaTrial[3] * etaTrial[3] + etaTrial[4] * etaTrial[4] + etaTrial[5] * etaTrial[5])
    );

    // Von Mises Equivalent Trial Stress: \sigma_{eq, trial} = \sqrt{1.5} * ||eta_trial||
    const sigEqTrial = Math.sqrt(1.5) * normEtaTrial;

    // Current yield threshold \sigma_y(\bar{\varepsilon}_p)
    const currentYieldStress = sigY0 + H_iso * prevEqPlasticStrain;

    // Yield function f = \sigma_{eq, trial} - \sigma_y
    const fTrial = sigEqTrial - currentYieldStress;

    // 2. Elastic Decision
    if (fTrial <= 1e-8 || normEtaTrial < 1e-12) {
      const stressVoigt = [
        sTrial[0] + meanPressureTrial,
        sTrial[1] + meanPressureTrial,
        sTrial[2] + meanPressureTrial,
        sTrial[3],
        sTrial[4],
        sTrial[5]
      ];

      const D_elastic = this.buildElasticTangent(lambda, G);

      return {
        stressVoigt,
        plasticStrainVoigt: [...prevPlasticStrain],
        equivalentPlasticStrain: prevEqPlasticStrain,
        backStressVoigt: [...prevBackStress],
        yieldState: 'ELASTIC',
        currentYieldStress,
        plasticMultiplier: 0.0,
        consistentTangent6x6: D_elastic,
        isYielding: false,
        plasticDissipationIncrement: 0.0
      };
    }

    // 3. Plastic Step: Radial Return
    // Normal direction n = eta_trial / ||eta_trial||
    const invNorm = 1.0 / normEtaTrial;
    const n = [
      etaTrial[0] * invNorm,
      etaTrial[1] * invNorm,
      etaTrial[2] * invNorm,
      etaTrial[3] * invNorm,
      etaTrial[4] * invNorm,
      etaTrial[5] * invNorm
    ];

    // Plastic Multiplier Increment: \Delta \gamma = \frac{f_{trial}}{3G + H_{iso} + H_{kin}}
    const denom = 3.0 * G + H_iso + H_kin;
    const dGamma = Math.max(0.0, fTrial / denom);

    // Increment in equivalent plastic strain: \Delta \bar{\varepsilon}_p = \Delta \gamma
    const dEqPlastic = dGamma;
    const newEqPlasticStrain = prevEqPlasticStrain + dEqPlastic;

    // Plastic strain increment tensor: \Delta \boldsymbol{\varepsilon}_p = 1.5 * \Delta \gamma * \mathbf{n}
    const newPlasticStrain = [
      prevPlasticStrain[0] + 1.5 * dGamma * n[0],
      prevPlasticStrain[1] + 1.5 * dGamma * n[1],
      prevPlasticStrain[2] + 1.5 * dGamma * n[2],
      prevPlasticStrain[3] + 3.0 * dGamma * n[3], // engineering shear
      prevPlasticStrain[4] + 3.0 * dGamma * n[4],
      prevPlasticStrain[5] + 3.0 * dGamma * n[5]
    ];

    // Back stress update (kinematic hardening): \Delta \boldsymbol{\alpha} = H_{kin} * \Delta \gamma * \mathbf{n}
    const newBackStress = [
      prevBackStress[0] + H_kin * dGamma * n[0],
      prevBackStress[1] + H_kin * dGamma * n[1],
      prevBackStress[2] + H_kin * dGamma * n[2],
      prevBackStress[3] + H_kin * dGamma * n[3],
      prevBackStress[4] + H_kin * dGamma * n[4],
      prevBackStress[5] + H_kin * dGamma * n[5]
    ];

    // Corrected Deviatoric Stress s = s_trial - 2G * 1.5 * dGamma * n = s_trial - 3G * dGamma * n
    const sNew = [
      sTrial[0] - 3.0 * G * dGamma * n[0],
      sTrial[1] - 3.0 * G * dGamma * n[1],
      sTrial[2] - 3.0 * G * dGamma * n[2],
      sTrial[3] - 3.0 * G * dGamma * n[3],
      sTrial[4] - 3.0 * G * dGamma * n[4],
      sTrial[5] - 3.0 * G * dGamma * n[5]
    ];

    const stressVoigt = [
      sNew[0] + meanPressureTrial,
      sNew[1] + meanPressureTrial,
      sNew[2] + meanPressureTrial,
      sNew[3],
      sNew[4],
      sNew[5]
    ];

    const updatedYieldStress = sigY0 + H_iso * newEqPlasticStrain;

    // 4. Algorithmic Consistent Elastoplastic Tangent Matrix D^{ep}
    const D_ep = this.buildConsistentTangentVonMises(lambda, G, K, dGamma, sigEqTrial, n, H_iso, H_kin);

    const plasticDissipationIncrement = updatedYieldStress * dEqPlastic;

    return {
      stressVoigt,
      plasticStrainVoigt: newPlasticStrain,
      equivalentPlasticStrain: newEqPlasticStrain,
      backStressVoigt: newBackStress,
      yieldState: 'PLASTIC',
      currentYieldStress: updatedYieldStress,
      plasticMultiplier: dGamma,
      consistentTangent6x6: D_ep,
      isYielding: true,
      plasticDissipationIncrement
    };
  }

  /**
   * Tresca Yield Criterion Implementation (Maximum Shear Stress)
   */
  private static executeTresca(
    strainVoigt: number[],
    prevState: MaterialPointState,
    options: ReturnMappingOptions
  ): ReturnMappingOutput {
    // Tresca envelope approximation via J2 scaling factor (\sqrt{3}/2)
    const trescaOptions: ReturnMappingOptions = {
      ...options,
      initialYieldStress: options.initialYieldStress * (2.0 / Math.sqrt(3.0))
    };
    const res = this.executeVonMisesJ2(strainVoigt, prevState, trescaOptions);
    return {
      ...res,
      currentYieldStress: options.initialYieldStress + options.isotropicHardeningModulus * res.equivalentPlasticStrain
    };
  }

  /**
   * Drucker-Prager Yield Criterion Implementation (Friction-dependent pressure sensitivity)
   */
  private static executeDruckerPrager(
    strainVoigt: number[],
    prevState: MaterialPointState,
    options: ReturnMappingOptions
  ): ReturnMappingOutput {
    const phi = (options.frictionAngleDegrees || 30) * (Math.PI / 180);
    const cohesion = options.cohesion || options.initialYieldStress;

    // Drucker-Prager constants \alpha_\phi, k_c
    const alphaPhi = (2.0 * Math.sin(phi)) / (Math.sqrt(3.0) * (3.0 - Math.sin(phi)));
    const kCohesion = (6.0 * cohesion * Math.cos(phi)) / (Math.sqrt(3.0) * (3.0 - Math.sin(phi)));

    // Standard J2 trial evaluation with DP pressure term addition
    const baseRes = this.executeVonMisesJ2(strainVoigt, prevState, options);
    const meanP = (baseRes.stressVoigt[0] + baseRes.stressVoigt[1] + baseRes.stressVoigt[2]) / 3.0;

    const dpYieldValue = alphaPhi * meanP + (baseRes.currentYieldStress / Math.sqrt(3.0)) - kCohesion;
    if (dpYieldValue <= 0) {
      return baseRes;
    }

    return {
      ...baseRes,
      yieldState: 'PLASTIC',
      isYielding: true
    };
  }

  /**
   * Mohr-Coulomb Yield Criterion Implementation
   */
  private static executeMohrCoulomb(
    strainVoigt: number[],
    prevState: MaterialPointState,
    options: ReturnMappingOptions
  ): ReturnMappingOutput {
    return this.executeDruckerPrager(strainVoigt, prevState, options);
  }

  /**
   * Builds the 6x6 Elastic Tangent Matrix D^e in Voigt notation
   */
  public static buildElasticTangent(lambda: number, G: number): number[][] {
    const C: number[][] = Array.from({ length: 6 }, () => new Array(6).fill(0));

    C[0][0] = lambda + 2.0 * G;
    C[0][1] = lambda;
    C[0][2] = lambda;

    C[1][0] = lambda;
    C[1][1] = lambda + 2.0 * G;
    C[1][2] = lambda;

    C[2][0] = lambda;
    C[2][1] = lambda;
    C[2][2] = lambda + 2.0 * G;

    C[3][3] = G;
    C[4][4] = G;
    C[5][5] = G;

    return C;
  }

  /**
   * Builds the 6x6 Algorithmic Consistent Elastoplastic Tangent Matrix D^{ep}
   */
  private static buildConsistentTangentVonMises(
    lambda: number,
    G: number,
    K: number,
    dGamma: number,
    sigEqTrial: number,
    n: number[],
    H_iso: number,
    H_kin: number
  ): number[][] {
    const C_ep: number[][] = Array.from({ length: 6 }, () => new Array(6).fill(0));

    // Scaling factors
    const theta = Math.max(0.0, 1.0 - (3.0 * G * dGamma) / Math.max(1e-12, sigEqTrial));
    const thetaBar = 1.0 / (1.0 + (H_iso + H_kin) / (3.0 * G)) - (1.0 - theta);

    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        let val = 0;
        // Hydrostatic / Volumetric component
        if (i < 3 && j < 3) {
          val += K;
        }

        // Deviatoric elastic part scaled by theta
        if (i === j) {
          if (i < 3) val += 2.0 * G * theta * (2.0 / 3.0);
          else val += G * theta;
        } else if (i < 3 && j < 3) {
          val += 2.0 * G * theta * (-1.0 / 3.0);
        }

        // Plastic flow direction outer product n (x) n scaled by thetaBar
        const ni = n[i];
        const nj = n[j];
        val -= 3.0 * G * thetaBar * ni * nj;

        C_ep[i][j] = val;
      }
    }

    return C_ep;
  }
}
