export interface UniaxialAnalyticalResult {
  strain: number;
  stress: number;
  elasticStrain: number;
  plasticStrain: number;
  equivalentPlasticStrain: number;
  yieldPointPassed: boolean;
  tangentModulus: number;
}

export interface PureShearAnalyticalResult {
  gamma: number;
  tau: number;
  tauYield: number;
  plasticShearStrain: number;
  equivalentPlasticStrain: number;
  yieldPointPassed: boolean;
}

export class IndependentPlasticityReference {
  /**
   * Completely independent closed-form solution for 1D / Uniaxial J2 Elastoplasticity with Isotropic Linear Hardening.
   */
  static solveUniaxialTension(
    totalStrain: number,
    E: number,
    yieldStress: number,
    H: number
  ): UniaxialAnalyticalResult {
    const yieldStrain = yieldStress / E;

    if (Math.abs(totalStrain) <= yieldStrain) {
      // Linear elastic region
      return {
        strain: totalStrain,
        stress: E * totalStrain,
        elasticStrain: totalStrain,
        plasticStrain: 0.0,
        equivalentPlasticStrain: 0.0,
        yieldPointPassed: false,
        tangentModulus: E
      };
    }

    // Elastoplastic region
    const sgn = totalStrain >= 0 ? 1.0 : -1.0;
    const absStrain = Math.abs(totalStrain);
    const plasticStrainMag = (E / (E + H)) * (absStrain - yieldStrain);
    const stressMag = yieldStress + H * plasticStrainMag;
    const elasticStrainMag = absStrain - plasticStrainMag;
    const Et = (E * H) / (E + H);

    return {
      strain: totalStrain,
      stress: stressMag * sgn,
      elasticStrain: elasticStrainMag * sgn,
      plasticStrain: plasticStrainMag * sgn,
      equivalentPlasticStrain: plasticStrainMag,
      yieldPointPassed: true,
      tangentModulus: Et
    };
  }

  /**
   * Analytical solution for Uniaxial Tension -> Unloading -> Reverse Loading (Isotropic Hardening).
   */
  static solveUniaxialCycle(
    maxTensionStrain: number,
    unloadedStrain: number,
    E: number,
    yieldStress: number,
    H: number
  ): {
    stateAtPeak: UniaxialAnalyticalResult;
    stateAfterUnload: {
      strain: number;
      stress: number;
      elasticStrain: number;
      plasticStrain: number;
      equivalentPlasticStrain: number;
      isElasticUnloading: boolean;
    };
    reverseYieldStress: number;
    modelLimitation: string;
  } {
    const peak = this.solveUniaxialTension(maxTensionStrain, E, yieldStress, H);
    const plasticStrainFrozen = peak.plasticStrain;
    const kappaFrozen = peak.equivalentPlasticStrain;

    // Unloading slope is purely elastic E
    const dEps = unloadedStrain - maxTensionStrain;
    const stressUnloaded = peak.stress + E * dEps;
    const elasticStrainUnloaded = stressUnloaded / E;

    // For isotropic hardening, reverse yield is at - (yieldStress + H * kappa)
    const currentYieldRadius = yieldStress + H * kappaFrozen;
    const isElasticUnloading = Math.abs(stressUnloaded) <= currentYieldRadius;

    return {
      stateAtPeak: peak,
      stateAfterUnload: {
        strain: unloadedStrain,
        stress: stressUnloaded,
        elasticStrain: elasticStrainUnloaded,
        plasticStrain: plasticStrainFrozen,
        equivalentPlasticStrain: kappaFrozen,
        isElasticUnloading
      },
      reverseYieldStress: -currentYieldRadius,
      modelLimitation: "ISOTROPIC_HARDENING_NO_BAUSCHINGER: Yield surface expands uniformly without kinematic backstress translation."
    };
  }

  /**
   * Closed-form analytical solution for Pure Shear in 3D J2 Plasticity.
   * Yield stress in pure shear: tau_y = sigma_y0 / sqrt(3)
   */
  static solvePureShear(
    engineeringShearGamma: number,
    G: number,
    yieldStress: number,
    H: number
  ): PureShearAnalyticalResult {
    const tauYield = yieldStress / Math.sqrt(3.0);
    const gammaYield = tauYield / G;
    const absGamma = Math.abs(engineeringShearGamma);
    const sgn = engineeringShearGamma >= 0 ? 1.0 : -1.0;

    if (absGamma <= gammaYield) {
      return {
        gamma: engineeringShearGamma,
        tau: G * engineeringShearGamma,
        tauYield,
        plasticShearStrain: 0.0,
        equivalentPlasticStrain: 0.0,
        yieldPointPassed: false
      };
    }

    // Equivalent plastic strain: Delta kappa = Delta gamma_plastic / sqrt(3)
    // tau = tauYield + (H / 3) * gamma_plastic
    // gamma = gamma_elastic + gamma_plastic = tau/G + gamma_plastic
    // gamma_plastic = (absGamma - gammaYield) / (1 + H / (3G))
    const denominator = 1.0 + H / (3.0 * G);
    const gammaPlastic = (absGamma - gammaYield) / denominator;
    const tauMag = tauYield + (H / 3.0) * gammaPlastic;
    const kappa = gammaPlastic / Math.sqrt(3.0);

    return {
      gamma: engineeringShearGamma,
      tau: tauMag * sgn,
      tauYield,
      plasticShearStrain: gammaPlastic * sgn,
      equivalentPlasticStrain: kappa,
      yieldPointPassed: true
    };
  }

  /**
   * Evaluates pure hydrostatic state invariance:
   * Hydrostatic stress tensor: sigma = [p, p, p, 0, 0, 0]
   * Deviatoric stress = 0, von Mises = 0, yield function = -sigma_y0 < 0
   */
  static verifyHydrostaticInvariance(pressure: number, yieldStress: number): {
    p: number;
    deviatoricNorm: number;
    vonMises: number;
    yieldFunctionValue: number;
    yieldsUnderPurePressure: boolean;
  } {
    const p = pressure;
    const sxx = p - p;
    const syy = p - p;
    const szz = p - p;
    const devNorm = Math.sqrt(sxx * sxx + syy * syy + szz * szz);
    const vonMises = 0.0;
    const yieldFunctionValue = -yieldStress;

    return {
      p,
      deviatoricNorm: devNorm,
      vonMises,
      yieldFunctionValue,
      yieldsUnderPurePressure: false
    };
  }
}
