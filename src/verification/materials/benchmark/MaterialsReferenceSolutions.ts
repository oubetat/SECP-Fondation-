/**
 * PATCH-178: Independent Materials Reference Solutions
 *
 * Provides closed-form analytical equations and independent reference solutions
 * for elastic, plastic, volumetric, thermal, and unit-system material benchmarks.
 * Does NOT reuse any application or solver code under test.
 */

export interface ElasticConstantsReference {
  youngModulusPa: number;
  poissonsRatio: number;
  shearModulusPa: number;
  bulkModulusPa: number;
  lameFirstParamPa: number;
  source: string;
}

export interface UniaxialElasticReference {
  forceN: number;
  lengthM: number;
  areaM2: number;
  youngModulusPa: number;
  stressPa: number;
  strain: number;
  displacementM: number;
  source: string;
}

export interface PoissonResponseReference {
  axialForceN: number;
  lengthM: number;
  widthM: number;
  areaM2: number;
  youngModulusPa: number;
  poissonsRatio: number;
  axialStrain: number;
  transverseStrain: number;
  transverseDisplacementM: number;
  source: string;
}

export interface ShearResponseReference {
  shearForceN: number;
  shearAreaM2: number;
  shearModulusPa: number;
  shearStressPa: number;
  shearStrain: number;
  source: string;
}

export interface VolumetricResponseReference {
  hydrostaticPressurePa: number;
  youngModulusPa: number;
  poissonsRatio: number;
  bulkModulusPa: number;
  volumetricStrain3D: number;
  volumetricStrainPlaneStress: number;
  source: string;
}

export interface UnitConversionReference {
  systemA: {
    systemName: string;
    E_Pa: number;
    density_kg_m3: number;
    length_m: number;
    area_m2: number;
    force_N: number;
    displacement_m: number;
  };
  systemB: {
    systemName: string;
    E_MPa: number;
    density_tonne_mm3: number;
    length_mm: number;
    area_mm2: number;
    force_N: number;
    displacement_mm: number;
  };
  source: string;
}

export interface DensityMassReference {
  densityKgM3: number;
  volumeM3: number;
  gravityMPerS2: number;
  massKg: number;
  weightN: number;
  stiffnessNPerM: number;
  firstNaturalFreqHz: number;
  source: string;
}

export interface PlasticityJ2Reference {
  youngModulusPa: number;
  yieldStrengthPa: number;
  tangentModulusPa: number;
  appliedStrain: number;
  stressPa: number;
  plasticStrain: number;
  residualStrain: number;
  source: string;
}

export class MaterialsReferenceSolutions {
  /**
   * Calculates independent isotropic elastic constants from E and nu.
   */
  public static calculateElasticConstants(
    E: number,
    nu: number
  ): ElasticConstantsReference {
    const G = E / (2 * (1 + nu));
    const K = E / (3 * (1 - 2 * nu));
    const lambda = (E * nu) / ((1 + nu) * (1 - 2 * nu));

    return {
      youngModulusPa: E,
      poissonsRatio: nu,
      shearModulusPa: G,
      bulkModulusPa: K,
      lameFirstParamPa: lambda,
      source: 'Independent Isotropic Linear Elasticity Theory (Hooke Law)'
    };
  }

  /**
   * Closed-form analytical 1D uniaxial elastic tension response.
   */
  public static calculateUniaxialElastic(
    forceN: number,
    lengthM: number,
    areaM2: number,
    E: number
  ): UniaxialElasticReference {
    const stressPa = forceN / areaM2;
    const strain = stressPa / E;
    const displacementM = strain * lengthM;

    return {
      forceN,
      lengthM,
      areaM2,
      youngModulusPa: E,
      stressPa,
      strain,
      displacementM,
      source: 'Closed-form Uniaxial Bar Mechanics (sigma = E*epsilon, u = F*L/(A*E))'
    };
  }

  /**
   * Analytical transverse Poisson deformation response.
   */
  public static calculatePoissonDeformation(
    axialForceN: number,
    lengthM: number,
    widthM: number,
    areaM2: number,
    E: number,
    nu: number
  ): PoissonResponseReference {
    const stressPa = axialForceN / areaM2;
    const axialStrain = stressPa / E;
    const transverseStrain = -nu * axialStrain;
    const transverseDisplacementM = transverseStrain * widthM;

    return {
      axialForceN,
      lengthM,
      widthM,
      areaM2,
      youngModulusPa: E,
      poissonsRatio: nu,
      axialStrain,
      transverseStrain,
      transverseDisplacementM,
      source: 'Closed-form Isotropic Poisson Effect (epsilon_trans = -nu * epsilon_axial)'
    };
  }

  /**
   * Analytical pure shear response.
   */
  public static calculateShearResponse(
    shearForceN: number,
    shearAreaM2: number,
    G: number
  ): ShearResponseReference {
    const shearStressPa = shearForceN / shearAreaM2;
    const shearStrain = shearStressPa / G;

    return {
      shearForceN,
      shearAreaM2,
      shearModulusPa: G,
      shearStressPa,
      shearStrain,
      source: 'Closed-form Pure Shear Mechanics (tau = G * gamma)'
    };
  }

  /**
   * Analytical volumetric response under hydrostatic pressure.
   */
  public static calculateVolumetricResponse(
    E: number,
    nu: number,
    hydrostaticPressurePa: number
  ): VolumetricResponseReference {
    const K = E / (3 * (1 - 2 * nu));
    // 3D hydrostatic volumetric strain: epsilon_v = -p / K
    const volumetricStrain3D = -hydrostaticPressurePa / K;
    // 2D plane stress volumetric strain under sigma_x = sigma_y = -p, sigma_z = 0:
    // epsilon_x = epsilon_y = (-p - nu(-p))/E = -p(1-nu)/E
    // epsilon_z = -nu(-p - p)/E = 2*nu*p/E
    // epsilon_v_2D_plane_stress = epsilon_x + epsilon_y + epsilon_z = -2*p*(1-nu)/E + 2*nu*p/E = -2*p*(1-2*nu)/E
    const volumetricStrainPlaneStress = (-2 * hydrostaticPressurePa * (1 - 2 * nu)) / E;

    return {
      hydrostaticPressurePa,
      youngModulusPa: E,
      poissonsRatio: nu,
      bulkModulusPa: K,
      volumetricStrain3D,
      volumetricStrainPlaneStress,
      source: 'Closed-form Volumetric Hydrostatic Deformation Theory'
    };
  }

  /**
   * Analytical equivalent multi-unit system conversions.
   */
  public static calculateUnitConversions(
    E_Pa: number,
    density_kg_m3: number,
    length_m: number,
    area_m2: number,
    force_N: number
  ): UnitConversionReference {
    const disp_m = (force_N * length_m) / (area_m2 * E_Pa);

    // System B: Engineering Units (mm, MPa, tonne)
    const E_MPa = E_Pa / 1e6;
    const density_tonne_mm3 = density_kg_m3 / 1e12;
    const length_mm = length_m * 1000;
    const area_mm2 = area_m2 * 1e6;
    const disp_mm = (force_N * length_mm) / (area_mm2 * E_MPa);

    return {
      systemA: {
        systemName: 'SI (Pa, kg/m3, m, m2, N)',
        E_Pa,
        density_kg_m3,
        length_m,
        area_m2,
        force_N,
        displacement_m: disp_m
      },
      systemB: {
        systemName: 'Engineering (MPa, tonne/mm3, mm, mm2, N)',
        E_MPa,
        density_tonne_mm3,
        length_mm,
        area_mm2,
        force_N,
        displacement_mm: disp_mm
      },
      source: 'SI to Engineering Unit Systems Analytical Conversion'
    };
  }

  /**
   * Density and mass dynamics reference.
   */
  public static calculateDensityMass(
    densityKgM3: number,
    volumeM3: number,
    gravityMPerS2: number = 9.80665,
    stiffnessNPerM: number = 1e7
  ): DensityMassReference {
    const massKg = densityKgM3 * volumeM3;
    const weightN = massKg * gravityMPerS2;
    const omega = Math.sqrt(stiffnessNPerM / massKg);
    const firstNaturalFreqHz = omega / (2 * Math.PI);

    return {
      densityKgM3,
      volumeM3,
      gravityMPerS2,
      massKg,
      weightN,
      stiffnessNPerM,
      firstNaturalFreqHz,
      source: 'Mass Dynamics & Single DOF Harmonic Oscillator Analytical Solution'
    };
  }

  /**
   * Closed-form Bilinear J2 Plasticity response.
   */
  public static calculateJ2PlasticityReference(
    E: number,
    Et: number,
    sigmaY: number,
    appliedStrain: number
  ): PlasticityJ2Reference {
    const elasticLimitStrain = sigmaY / E;
    let stressPa = 0;
    let plasticStrain = 0;

    if (Math.abs(appliedStrain) <= elasticLimitStrain) {
      stressPa = E * appliedStrain;
      plasticStrain = 0;
    } else {
      const sign = Math.sign(appliedStrain);
      const absStrain = Math.abs(appliedStrain);
      const absPlasticStrain = ((absStrain - elasticLimitStrain) * (E - Et)) / E;
      const absStress = sigmaY + Et * (absStrain - elasticLimitStrain);

      stressPa = sign * absStress;
      plasticStrain = sign * absPlasticStrain;
    }

    const residualStrain = plasticStrain;

    return {
      youngModulusPa: E,
      yieldStrengthPa: sigmaY,
      tangentModulusPa: Et,
      appliedStrain,
      stressPa,
      plasticStrain,
      residualStrain,
      source: 'Closed-form 1D Bilinear J2 Von Mises Hardening Theory'
    };
  }
}
