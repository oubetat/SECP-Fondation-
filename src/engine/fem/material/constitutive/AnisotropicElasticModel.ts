/**
 * SECP CAD/CAE Platform - PATCH-233: Anisotropic Elastic Model Framework
 *
 * Implements general 6x6 Anisotropic Elasticity framework with strict:
 * - Symmetry checks (C_ij = C_ji)
 * - Positive-definiteness verification (Sylvester's criterion)
 * - Numerical conditioning diagnostics (Condition number kappa <= 1e12)
 * - Rejection of invalid matrices prior to FEM execution
 */

import { ConstitutiveResponse, MaterialConstitutiveDefinition, MaterialPointState } from './ConstitutiveTypes';
import { MaterialConstitutiveValidator, ValidationReport } from './MaterialConstitutiveValidator';

export class AnisotropicElasticModel {
  public readonly C_anisotropic: number[][];
  public readonly validationReport: ValidationReport;

  constructor(definition: MaterialConstitutiveDefinition) {
    if (!definition.elastic.C6x6) {
      throw new Error('Anisotropic material requires explicit 6x6 C6x6 stiffness matrix.');
    }

    this.C_anisotropic = definition.elastic.C6x6;

    // Strict pre-execution validation
    this.validationReport = MaterialConstitutiveValidator.validateStiffnessMatrix6x6(this.C_anisotropic);
    if (!this.validationReport.isValid) {
      throw new Error(
        `Anisotropic Stiffness Matrix rejected prior to FEM execution: ${this.validationReport.errors.map(e => e.reason).join('; ')}`
      );
    }
  }

  public updateStress(
    strainIncrement: number[],
    state: MaterialPointState
  ): ConstitutiveResponse {
    if (strainIncrement.length !== 6) {
      return {
        stress: [...state.stress],
        tangent: this.C_anisotropic,
        plasticStrain: [...state.plasticStrain],
        equivalentPlasticStrain: state.equivalentPlasticStrain,
        backStress: [...state.backStress],
        elasticEnergyDensity: state.elasticEnergyDensity,
        plasticDissipationIncrement: 0,
        updatedState: state,
        converged: false,
        failure: {
          code: 'ERR_INVALID_PARAMETERS',
          location: 'AnisotropicElasticModel.updateStress',
          reason: `Strain increment must have 6 Voigt components, got ${strainIncrement.length}`
        }
      };
    }

    const newTotalStrain = state.totalStrain.map((e, i) => e + strainIncrement[i]);
    const newStress: number[] = new Array(6).fill(0);

    for (let i = 0; i < 6; i++) {
      let sum = 0;
      for (let j = 0; j < 6; j++) {
        sum += this.C_anisotropic[i][j] * newTotalStrain[j];
      }
      newStress[i] = sum;
    }

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
      tangent: this.C_anisotropic,
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
