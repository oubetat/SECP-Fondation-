/**
 * SECP CAD/CAE Platform - PATCH-233: Isotropic Linear Elastic Model
 *
 * Implements 3D Isotropic Linear Elastic constitutive law:
 * sigma = C_el : epsilon
 * where C_el is the 6x6 isotropic elasticity tensor in Voigt notation.
 */

import { ConstitutiveResponse, MaterialConstitutiveDefinition, MaterialPointState } from './ConstitutiveTypes';
import { MaterialConstitutiveValidator } from './MaterialConstitutiveValidator';

export class IsotropicLinearElasticModel {
  public readonly E: number;
  public readonly nu: number;
  public readonly G: number;
  public readonly K: number;
  public readonly lambda: number;
  public readonly C_el: number[][];

  constructor(definition: MaterialConstitutiveDefinition) {
    const val = MaterialConstitutiveValidator.validate(definition);
    if (!val.isValid) {
      throw new Error(`Invalid Isotropic Elastic Material definition: ${val.errors.map(e => e.reason).join('; ')}`);
    }

    this.E = definition.elastic.E!;
    this.nu = definition.elastic.nu!;

    // Derived engineering constants
    this.G = this.E / (2.0 * (1.0 + this.nu));
    this.K = this.E / (3.0 * (1.0 - 2.0 * this.nu));
    this.lambda = (this.E * this.nu) / ((1.0 + this.nu) * (1.0 - 2.0 * this.nu));

    // Construct 6x6 Isotropic Stiffness Matrix in Voigt notation:
    // [s11, s22, s33, s23, s13, s12]^T = C_el * [e11, e22, e33, g23, g13, g12]^T
    // (Note: shear strains are engineering strains gamma_ij = 2 * epsilon_ij)
    const c1 = this.lambda + 2.0 * this.G;
    const c2 = this.lambda;
    const c3 = this.G;

    this.C_el = [
      [c1, c2, c2, 0, 0, 0],
      [c2, c1, c2, 0, 0, 0],
      [c2, c2, c1, 0, 0, 0],
      [0, 0, 0, c3, 0, 0],
      [0, 0, 0, 0, c3, 0],
      [0, 0, 0, 0, 0, c3]
    ];
  }

  /**
   * Computes stress and consistent tangent given total strain increment
   */
  public updateStress(
    strainIncrement: number[],
    state: MaterialPointState
  ): ConstitutiveResponse {
    if (strainIncrement.length !== 6) {
      return {
        stress: [...state.stress],
        tangent: this.C_el,
        plasticStrain: [...state.plasticStrain],
        equivalentPlasticStrain: state.equivalentPlasticStrain,
        backStress: [...state.backStress],
        elasticEnergyDensity: state.elasticEnergyDensity,
        plasticDissipationIncrement: 0,
        updatedState: state,
        converged: false,
        failure: {
          code: 'ERR_INVALID_PARAMETERS',
          location: 'IsotropicLinearElasticModel.updateStress',
          reason: `Strain increment must have 6 Voigt components, got ${strainIncrement.length}`
        }
      };
    }

    // Total updated strain = previous total strain + strain increment
    const newTotalStrain = state.totalStrain.map((e, i) => e + strainIncrement[i]);

    // Compute stress: sigma_i = C_ij * epsilon_j
    const newStress: number[] = new Array(6).fill(0);
    for (let i = 0; i < 6; i++) {
      let sum = 0;
      for (let j = 0; j < 6; j++) {
        sum += this.C_el[i][j] * newTotalStrain[j];
      }
      newStress[i] = sum;
    }

    // Elastic strain energy density W_e = 0.5 * sigma : epsilon
    let energyDensity = 0;
    for (let i = 0; i < 6; i++) {
      energyDensity += 0.5 * newStress[i] * newTotalStrain[i];
    }

    const updatedState: MaterialPointState = {
      ...state,
      totalStrain: newTotalStrain,
      stress: newStress,
      elasticEnergyDensity: Math.max(0, energyDensity),
      status: 'ELASTIC'
    };

    return {
      stress: newStress,
      tangent: this.C_el,
      plasticStrain: [...state.plasticStrain],
      equivalentPlasticStrain: state.equivalentPlasticStrain,
      backStress: [...state.backStress],
      elasticEnergyDensity: Math.max(0, energyDensity),
      plasticDissipationIncrement: 0,
      updatedState,
      converged: true
    };
  }
}
