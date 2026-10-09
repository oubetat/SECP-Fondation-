/**
 * SECP Industrial OS v2 — Industrial J2 Plasticity Constitutive Model
 * Phase 18 (PATCH-178: Materials Benchmark → Industrial Materials Engine)
 *
 * Implements:
 * - 3D Voigt Stress/Strain Tensor Operations
 * - Von Mises Yield Criterion: f(sigma - alpha) - sigma_y(p, T) = 0
 * - Isotropic Hardening: Linear, Voce Exponential, Swift Power Law
 * - Kinematic Hardening: Armstrong-Frederick Nonlinear Backstress, Ziegler-Prager
 * - Combined Isotropic-Kinematic Hardening & Bauschinger Effect
 * - Radial Return Mapping Algorithm (Newton-Raphson on Delta gamma)
 * - Consistent Algorithmic Elastoplastic Tangent Tensor C^ep (6x6)
 */

import { J2PlasticityParams, MaterialState } from '../types/IndustrialMaterialTypes';

export interface J2StressUpdateResult {
  stressVoigt: number[];              // [sig11, sig22, sig33, sig23, sig13, sig12]
  plasticStrainVoigt: number[];
  equivalentPlasticStrain: number;
  backStressVoigt: number[];
  deltaGamma: number;
  yieldStatus: 'ELASTIC' | 'PLASTIC' | 'YIELDING';
  strainEnergyDensity: number;
  plasticDissipationIncrement: number;
  consistentTangent6x6: number[][];   // Algorithmic tangent C_ep
}

export class J2IndustrialPlasticityModel {
  private params: J2PlasticityParams;
  private E_Pa: number;
  private nu: number;
  private G_Pa: number;
  private K_Pa: number;
  private Ce: number[][]; // 6x6 Elastic compliance

  constructor(params: J2PlasticityParams, E_MPa: number, nu: number) {
    this.params = params;
    this.E_Pa = E_MPa * 1e6;
    this.nu = nu;
    this.G_Pa = this.E_Pa / (2 * (1 + nu));
    this.K_Pa = this.E_Pa / (3 * (1 - 2 * nu));
    this.Ce = this.buildElasticStiffnessMatrix();
  }

  private buildElasticStiffnessMatrix(): number[][] {
    const lambda = (this.E_Pa * this.nu) / ((1 + this.nu) * (1 - 2 * this.nu));
    const twoG = 2 * this.G_Pa;
    const G = this.G_Pa;

    return [
      [lambda + twoG, lambda, lambda, 0, 0, 0],
      [lambda, lambda + twoG, lambda, 0, 0, 0],
      [lambda, lambda, lambda + twoG, 0, 0, 0],
      [0, 0, 0, G, 0, 0],
      [0, 0, 0, 0, G, 0],
      [0, 0, 0, 0, 0, G]
    ];
  }

  /**
   * Computes isotropic current yield stress sigma_y(p, T).
   */
  public evaluateYieldStress(eqPlasticStrain: number, tempK: number = 293.15, tempSofteningFactor: number = 1.0): number {
    const sigma0 = this.params.initialYieldStressMPa * 1e6 * tempSofteningFactor;

    switch (this.params.hardeningLaw) {
      case 'LINEAR_ISOTROPIC': {
        const H = (this.params.isotropicHardeningModulusMPa || 0) * 1e6;
        return sigma0 + H * eqPlasticStrain;
      }
      case 'VOCE_NONLINEAR': {
        const Q = (this.params.saturationYieldStressMPa || 0) * 1e6;
        const b = this.params.saturationHardeningRate || 10;
        return sigma0 + Q * (1 - Math.exp(-b * eqPlasticStrain));
      }
      case 'SWIFT_POWER_LAW': {
        const K = (this.params.swiftStrengthCoefficientK_MPa || this.params.initialYieldStressMPa * 1.5) * 1e6;
        const n = this.params.swiftHardeningExponentN || 0.2;
        const eps0 = this.params.swiftInitialStrainEps0 || Math.pow(sigma0 / K, 1 / n);
        return K * Math.pow(eps0 + eqPlasticStrain, n);
      }
      case 'COMBINED_ISOTROPIC_KINEMATIC': {
        const H = (this.params.isotropicHardeningModulusMPa || 0) * 1e6;
        const Q = (this.params.saturationYieldStressMPa || 0) * 1e6;
        const b = this.params.saturationHardeningRate || 10;
        return sigma0 + 0.5 * (H * eqPlasticStrain + Q * (1 - Math.exp(-b * eqPlasticStrain)));
      }
      case 'PERFECT_PLASTIC':
      default:
        return sigma0;
    }
  }

  /**
   * Computes derivative of isotropic yield stress d(sigma_y)/d(p) for Newton solver.
   */
  public evaluateHardeningSlope(eqPlasticStrain: number, tempSofteningFactor: number = 1.0): number {
    switch (this.params.hardeningLaw) {
      case 'LINEAR_ISOTROPIC':
        return (this.params.isotropicHardeningModulusMPa || 0) * 1e6;
      case 'VOCE_NONLINEAR': {
        const Q = (this.params.saturationYieldStressMPa || 0) * 1e6;
        const b = this.params.saturationHardeningRate || 10;
        return Q * b * Math.exp(-b * eqPlasticStrain);
      }
      case 'SWIFT_POWER_LAW': {
        const K = (this.params.swiftStrengthCoefficientK_MPa || this.params.initialYieldStressMPa * 1.5) * 1e6;
        const n = this.params.swiftHardeningExponentN || 0.2;
        const eps0 = this.params.swiftInitialStrainEps0 || 0.002;
        return K * n * Math.pow(eps0 + eqPlasticStrain, n - 1);
      }
      case 'COMBINED_ISOTROPIC_KINEMATIC': {
        const H = (this.params.isotropicHardeningModulusMPa || 0) * 1e6;
        const Q = (this.params.saturationYieldStressMPa || 0) * 1e6;
        const b = this.params.saturationHardeningRate || 10;
        return 0.5 * (H + Q * b * Math.exp(-b * eqPlasticStrain));
      }
      case 'PERFECT_PLASTIC':
      default:
        return 0.0;
    }
  }

  /**
   * Radial return mapping algorithm for J2 plasticity under 3D stress state.
   */
  public updateStress(
    strainIncrementVoigt: number[],
    state: MaterialState,
    tempSofteningFactor: number = 1.0
  ): J2StressUpdateResult {
    // 1. Elastic trial strain & stress
    const totalStrain = state.totalStrainVoigt.map((e, i) => e + strainIncrementVoigt[i]);
    const plasticStrain = [...state.plasticStrainVoigt];
    const backStress = [...state.backStressVoigt];
    let eqPlastic = state.equivalentPlasticStrain;

    // Elastic trial strain = totalStrain - old plasticStrain
    const elasticTrialStrain: number[] = [
      totalStrain[0] - plasticStrain[0],
      totalStrain[1] - plasticStrain[1],
      totalStrain[2] - plasticStrain[2],
      totalStrain[3] - plasticStrain[3],
      totalStrain[4] - plasticStrain[4],
      totalStrain[5] - plasticStrain[5]
    ];

    // Compute elastic trial stress: sigma_trial = C_e * eps_e_trial
    const trialStress: number[] = new Array(6).fill(0);
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        trialStress[i] += this.Ce[i][j] * elasticTrialStrain[j];
      }
    }

    // Relative stress: eta_trial = trialStress - backStress
    const etaTrial: number[] = trialStress.map((s, i) => s - backStress[i]);

    // Deviatoric relative stress: s_trial = eta_trial - (1/3) * tr(eta_trial) * I
    const trEta = (etaTrial[0] + etaTrial[1] + etaTrial[2]) / 3;
    const sTrial: number[] = [
      etaTrial[0] - trEta,
      etaTrial[1] - trEta,
      etaTrial[2] - trEta,
      etaTrial[3], // engineering shear in Voigt
      etaTrial[4],
      etaTrial[5]
    ];

    // Von Mises effective relative stress: q_trial = sqrt(3/2 * s_ij * s_ij)
    const normDeviatorSq =
      sTrial[0] * sTrial[0] +
      sTrial[1] * sTrial[1] +
      sTrial[2] * sTrial[2] +
      2 * (sTrial[3] * sTrial[3] + sTrial[4] * sTrial[4] + sTrial[5] * sTrial[5]);
    const qTrial = Math.sqrt(1.5 * normDeviatorSq);

    // Current yield radius
    const sigmaY = this.evaluateYieldStress(eqPlastic, state.temperatureK, tempSofteningFactor);

    // Yield condition: f_trial = q_trial - sigma_y
    const fTrial = qTrial - sigmaY;

    if (fTrial <= 1e-7 || qTrial < 1e-12) {
      // Elastic step
      const W = 0.5 * (
        trialStress[0] * elasticTrialStrain[0] +
        trialStress[1] * elasticTrialStrain[1] +
        trialStress[2] * elasticTrialStrain[2] +
        trialStress[3] * elasticTrialStrain[3] +
        trialStress[4] * elasticTrialStrain[4] +
        trialStress[5] * elasticTrialStrain[5]
      );

      return {
        stressVoigt: trialStress,
        plasticStrainVoigt: plasticStrain,
        equivalentPlasticStrain: eqPlastic,
        backStressVoigt: backStress,
        deltaGamma: 0,
        yieldStatus: 'ELASTIC',
        strainEnergyDensity: W,
        plasticDissipationIncrement: 0,
        consistentTangent6x6: this.Ce
      };
    }

    // Plastic step: Radial Return Mapping (solve for deltaGamma)
    const C_kin = (this.params.kinematicModulusC_MPa || 0) * 1e6;
    const gamma_kin = this.params.kinematicRecallGamma || 0;

    let deltaGamma = 0;
    const maxIter = 50;
    const tol = 1e-8 * sigmaY;

    for (let iter = 0; iter < maxIter; iter++) {
      const currentEqPl = eqPlastic + deltaGamma;
      const currentSigmaY = this.evaluateYieldStress(currentEqPl, state.temperatureK, tempSofteningFactor);
      const H_iso = this.evaluateHardeningSlope(currentEqPl, tempSofteningFactor);

      // Residual: g(dGamma) = q_trial - 3*G*dGamma - C_kin*dGamma - sigma_y(p + dGamma)
      const res = qTrial - (3 * this.G_Pa + C_kin) * deltaGamma - currentSigmaY;

      if (Math.abs(res) < tol) break;

      // Derivative: dg/d(dGamma) = -(3*G + C_kin + H_iso)
      const dRes = -(3 * this.G_Pa + C_kin + H_iso);
      const dDeltaGamma = -res / dRes;
      deltaGamma += dDeltaGamma;

      if (deltaGamma < 0) deltaGamma = 0;
    }

    // Flow normal direction N = sqrt(3/2) * s_trial / ||s_trial|| = 1.5 * s_trial / q_trial
    const N_dir: number[] = sTrial.map(s => (1.5 * s) / qTrial);

    // Plastic strain increment: d_eps_p = deltaGamma * N_dir (with factor 2 on shear for engineering tensor)
    const deltaEpsP: number[] = [
      deltaGamma * N_dir[0],
      deltaGamma * N_dir[1],
      deltaGamma * N_dir[2],
      2 * deltaGamma * N_dir[3],
      2 * deltaGamma * N_dir[4],
      2 * deltaGamma * N_dir[5]
    ];

    const updatedPlasticStrain = plasticStrain.map((p, i) => p + deltaEpsP[i]);
    const updatedEqPlastic = eqPlastic + deltaGamma;

    // Update kinematic back stress: alpha = alpha_old + (2/3)*C_kin*deltaEpsP - gamma_kin*alpha_old*deltaGamma
    const updatedBackStress = backStress.map((a, i) => {
      const flow = (2 / 3) * C_kin * deltaEpsP[i];
      const recall = gamma_kin * a * deltaGamma;
      return a + flow - recall;
    });

    // Updated stress: sigma = sigma_trial - 2*G*deltaGamma*N_dir
    const updatedStress: number[] = [
      trialStress[0] - 2 * this.G_Pa * deltaGamma * N_dir[0],
      trialStress[1] - 2 * this.G_Pa * deltaGamma * N_dir[1],
      trialStress[2] - 2 * this.G_Pa * deltaGamma * N_dir[2],
      trialStress[3] - 2 * this.G_Pa * deltaGamma * N_dir[3],
      trialStress[4] - 2 * this.G_Pa * deltaGamma * N_dir[4],
      trialStress[5] - 2 * this.G_Pa * deltaGamma * N_dir[5]
    ];

    // Compute consistent elastoplastic tangent C^ep
    const Cep = this.computeConsistentTangent(deltaGamma, qTrial, N_dir, updatedEqPlastic, tempSofteningFactor, C_kin);

    // Dissipation = sigma_y * deltaGamma
    const plasticDissipationInc = this.evaluateYieldStress(updatedEqPlastic, state.temperatureK, tempSofteningFactor) * deltaGamma;

    return {
      stressVoigt: updatedStress,
      plasticStrainVoigt: updatedPlasticStrain,
      equivalentPlasticStrain: updatedEqPlastic,
      backStressVoigt: updatedBackStress,
      deltaGamma,
      yieldStatus: 'PLASTIC',
      strainEnergyDensity: 0.5 * (
        updatedStress[0] * (totalStrain[0] - updatedPlasticStrain[0]) +
        updatedStress[1] * (totalStrain[1] - updatedPlasticStrain[1]) +
        updatedStress[2] * (totalStrain[2] - updatedPlasticStrain[2])
      ),
      plasticDissipationIncrement: plasticDissipationInc,
      consistentTangent6x6: Cep
    };
  }

  private computeConsistentTangent(
    deltaGamma: number,
    qTrial: number,
    N_dir: number[],
    eqPlastic: number,
    tempFactor: number,
    C_kin: number
  ): number[][] {
    const H_iso = this.evaluateHardeningSlope(eqPlastic, tempFactor);
    const twoG = 2 * this.G_Pa;
    const gammaFactor = (twoG * deltaGamma) / qTrial;
    const betaFactor = 1 / (1 + (H_iso + C_kin) / (3 * this.G_Pa));

    const Cep: number[][] = Array.from({ length: 6 }, () => new Array(6).fill(0));

    // Deviatoric projector trace
    const Idev: number[][] = [
      [2 / 3, -1 / 3, -1 / 3, 0, 0, 0],
      [-1 / 3, 2 / 3, -1 / 3, 0, 0, 0],
      [-1 / 3, -1 / 3, 2 / 3, 0, 0, 0],
      [0, 0, 0, 1 / 2, 0, 0],
      [0, 0, 0, 0, 1 / 2, 0],
      [0, 0, 0, 0, 0, 1 / 2]
    ];

    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        // Hydrostatic component: K * (I tensor product I)
        const hydro = (i < 3 && j < 3) ? this.K_Pa : 0;
        // Deviatoric consistent part
        const devPart = twoG * (1 - gammaFactor) * Idev[i][j];
        // Plastic flow dyadic: -2G * (betaFactor - gammaFactor) * (N_i * N_j)
        const flowPart = twoG * (gammaFactor - betaFactor) * (N_dir[i] * N_dir[j]);

        Cep[i][j] = hydro + devPart + flowPart;
      }
    }

    return Cep;
  }
}
