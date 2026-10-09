/**
 * PATCH-SECP-075.1: Constitutive Matrix Engine
 * Formulates the material stiffness matrix [D] for different physical behaviors.
 * Includes physical validation of material parameters.
 */
import { MaterialProperties } from './StructuralPhysicsTypes';

export class ConstitutiveMatrixEngine {
  /**
   * Validates material properties to ensure physical realism.
   */
  public static validateMaterial(material: MaterialProperties): void {
    if (typeof material.youngsModulus !== 'number' || isNaN(material.youngsModulus) || material.youngsModulus <= 0) {
      throw new Error(`Invalid Young's Modulus: ${material.youngsModulus}`);
    }
    if (typeof material.poissonsRatio !== 'number' || isNaN(material.poissonsRatio) || material.poissonsRatio <= -1 || material.poissonsRatio >= 0.5) {
      throw new Error(`Invalid Poisson's Ratio: ${material.poissonsRatio}. Must be in (-1, 0.5)`);
    }
    if (material.density !== undefined && (isNaN(material.density) || material.density <= 0)) {
      throw new Error(`Invalid Density: ${material.density}`);
    }
    if (material.yieldStrength !== undefined && (isNaN(material.yieldStrength) || material.yieldStrength <= 0)) {
      throw new Error(`Invalid Yield Strength: ${material.yieldStrength}`);
    }
  }

  /**
   * Computes the [D] matrix for Plane Stress conditions (e.g., thin plates, TRI_2D, QUAD_2D).
   */
  public static getPlaneStressMatrix(material: MaterialProperties): number[][] {
    this.validateMaterial(material);
    const E = material.youngsModulus;
    const v = material.poissonsRatio;
    const c = E / (1 - v * v);

    return [
      [c, c * v, 0],
      [c * v, c, 0],
      [0, 0, c * ((1 - v) / 2)]
    ];
  }

  /**
   * Computes the [D] matrix for Plane Strain conditions (e.g., thick dams, long pipes).
   */
  public static getPlaneStrainMatrix(material: MaterialProperties): number[][] {
    this.validateMaterial(material);
    const E = material.youngsModulus;
    const v = material.poissonsRatio;
    const c = E / ((1 + v) * (1 - 2 * v));

    return [
      [c * (1 - v), c * v, 0],
      [c * v, c * (1 - v), 0],
      [0, 0, c * ((1 - 2 * v) / 2)]
    ];
  }

  /**
   * Computes the [D] matrix for 3D Isotropic Solids (e.g., HEX8, TET4).
   * Uses Engineering Shear Strain convention.
   */
  public static getIsotropic3DMatrix(material: MaterialProperties): number[][] {
    this.validateMaterial(material);
    const E = material.youngsModulus;
    const v = material.poissonsRatio;
    
    const lambda = (E * v) / ((1 + v) * (1 - 2 * v));
    const mu = E / (2 * (1 + v));

    return [
      [lambda + 2 * mu, lambda, lambda, 0, 0, 0],
      [lambda, lambda + 2 * mu, lambda, 0, 0, 0],
      [lambda, lambda, lambda + 2 * mu, 0, 0, 0],
      [0, 0, 0, mu, 0, 0],
      [0, 0, 0, 0, mu, 0],
      [0, 0, 0, 0, 0, mu]
    ];
  }
}
