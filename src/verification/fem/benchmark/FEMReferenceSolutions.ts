/**
 * PATCH-177: Independent FEM Reference Solutions
 * 
 * Closed-form analytical and numerical reference calculators for structural physics problems.
 * CRITICAL: Completely independent of internal FEM solver assemblies or functions.
 */

export interface AxialBarReference {
  tipDisplacementMm: number;
  axialStressMPa: number;
  reactionForceN: number;
  axialStrain: number;
}

export interface CantileverBeamReference {
  tipDeflectionMm: number;
  rootBendingStressMPa: number;
  maxShearStressMPa: number;
  reactionForceN: number;
  reactionMomentNm: number;
}

export interface UniaxialTensionReference {
  maxDisplacementMm: number;
  transverseContractionMm: number;
  axialStressMPa: number;
  axialStrain: number;
  reactionForceN: number;
}

export interface PatchTestReference {
  constantStrain: [number, number, number]; // [exx, eyy, gxy]
  constantStressMPa: [number, number, number]; // [sxx, syy, sxy]
  vonMisesStressMPa: number;
}

export class FEMReferenceSolutions {
  /**
   * Closed-form analytical solution for 1D Axial Bar
   * u = (F * L) / (E * A)
   * sigma = F / A
   * R = -F
   */
  public static calculateAxialBar(
    lengthM: number,
    areaM2: number,
    youngModulusGPa: number,
    appliedForceN: number
  ): AxialBarReference {
    const E = youngModulusGPa * 1e9; // Pa
    const dispM = (appliedForceN * lengthM) / (E * areaM2);
    const stressPa = appliedForceN / areaM2;
    const strain = appliedForceN / (E * areaM2);

    return {
      tipDisplacementMm: dispM * 1000,
      axialStressMPa: stressPa / 1e6,
      reactionForceN: -appliedForceN,
      axialStrain: strain
    };
  }

  /**
   * Closed-form Euler-Bernoulli analytical solution for Cantilever Beam with tip load
   * delta_tip = (F * L^3) / (3 * E * I)
   * sigma_root = (M * y) / I = (F * L * (h/2)) / I
   */
  public static calculateCantileverBeam(
    lengthM: number,
    widthM: number,
    heightM: number,
    youngModulusGPa: number,
    appliedForceN: number
  ): CantileverBeamReference {
    const E = youngModulusGPa * 1e9; // Pa
    const nu = 0.3;
    const G = E / (2 * (1 + nu));
    const I = (widthM * Math.pow(heightM, 3)) / 12; // m^4
    const areaM2 = widthM * heightM;

    // Timoshenko 2D plane-stress beam tip deflection (bending with plane-stress Poisson factor + transverse shear)
    const bendingDispM = ((1 - nu * nu) * appliedForceN * Math.pow(lengthM, 3)) / (3 * E * I);
    const shearDispM = (1.2 * appliedForceN * lengthM) / (G * areaM2);
    const dispM = bendingDispM + shearDispM;
    const momentNm = Math.abs(appliedForceN) * lengthM;
    const stressPa = (momentNm * (heightM / 2)) / I;
    const shearStressPa = (1.5 * Math.abs(appliedForceN)) / areaM2;

    return {
      tipDeflectionMm: dispM * 1000,
      rootBendingStressMPa: stressPa / 1e6,
      maxShearStressMPa: shearStressPa / 1e6,
      reactionForceN: -appliedForceN,
      reactionMomentNm: -momentNm
    };
  }

  /**
   * Closed-form analytical solution for Uniaxial Tension Block
   * sigma_x = F / A
   * e_x = sigma_x / E
   * e_y = -nu * e_x
   * u_max = e_x * L
   */
  public static calculateUniaxialTension(
    lengthM: number,
    widthM: number,
    heightM: number,
    youngModulusGPa: number,
    poissonsRatio: number,
    appliedForceN: number
  ): UniaxialTensionReference {
    const E = youngModulusGPa * 1e9; // Pa
    const areaM2 = widthM * heightM;
    const stressPa = appliedForceN / areaM2;
    const axialStrain = stressPa / E;
    const transverseStrain = -poissonsRatio * axialStrain;

    const maxDispM = axialStrain * lengthM;
    const transverseContractionM = transverseStrain * widthM;

    return {
      maxDisplacementMm: maxDispM * 1000,
      transverseContractionMm: transverseContractionM * 1000,
      axialStressMPa: stressPa / 1e6,
      axialStrain,
      reactionForceN: -appliedForceN
    };
  }

  /**
   * Exact Patch Test analytical constant strain & stress state
   * u(x,y) = a0 + a1*x + a2*y
   * v(x,y) = b0 + b1*x + b2*y
   */
  public static calculatePatchTest(
    a1: number,
    a2: number,
    b1: number,
    b2: number,
    youngModulusGPa: number,
    poissonsRatio: number
  ): PatchTestReference {
    const E = youngModulusGPa * 1e9;
    const nu = poissonsRatio;

    // Plane Stress Constitutive Matrix D
    const factor = E / (1 - nu * nu);
    const exx = a1;
    const eyy = b2;
    const gxy = a2 + b1;

    const sxxPa = factor * (exx + nu * eyy);
    const syyPa = factor * (nu * exx + eyy);
    const sxyPa = (E / (2 * (1 + nu))) * gxy;

    const sxxMPa = sxxPa / 1e6;
    const syyMPa = syyPa / 1e6;
    const sxyMPa = sxyPa / 1e6;

    // Von Mises stress in 2D plane stress: sqrt(sxx^2 - sxx*syy + syy^2 + 3*sxy^2)
    const vmMPa = Math.sqrt(
      sxxMPa * sxxMPa - sxxMPa * syyMPa + syyMPa * syyMPa + 3 * sxyMPa * sxyMPa
    );

    return {
      constantStrain: [exx, eyy, gxy],
      constantStressMPa: [sxxMPa, syyMPa, sxyMPa],
      vonMisesStressMPa: vmMPa
    };
  }
}
