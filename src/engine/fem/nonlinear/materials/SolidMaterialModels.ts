/**
 * SECP Industrial OS v2 — Linear Elastic & J2 Plasticity Constitutive Models
 * Phase 17 (PATCH-177: FEM Benchmark → Nonlinear FEM 2.0)
 *
 * Implements:
 * - LinearElasticModel (Baseline Hookean model with 3D/plane support)
 * - J2PlasticityModel (Elastoplasticity with von Mises yield & radial return mapping)
 */

import { Matrix } from '../../core/MathUtils';
import {
  ConstitutiveResponse,
  DeformationGradientTensor,
  J2PlasticityParameters,
  LinearElasticParameters,
  MaterialInternalState,
  MaterialModelIdentity,
  NonlinearConstitutiveModel
} from '../types/NonlinearFEMTypes';
import { PlasticIntegrationEngine } from './PlasticIntegrationEngine';

export class LinearElasticModel implements NonlinearConstitutiveModel {
  public readonly identity: MaterialModelIdentity = 'LINEAR_ELASTIC';
  public readonly name: string = 'Isotropic Linear Elastic Material';

  public readonly E: number;
  public readonly nu: number;
  public readonly G: number;
  public readonly K: number;
  public readonly lambda: number;

  constructor(public readonly params: LinearElasticParameters) {
    this.E = params.E;
    this.nu = params.nu;
    this.G = this.E / (2.0 * (1.0 + this.nu));
    this.K = this.E / (3.0 * (1.0 - 2.0 * this.nu));
    this.lambda = this.K - (2.0 / 3.0) * this.G;
  }

  public computeStressAndTangent(
    strainVoigt: number[],
    defGrad: DeformationGradientTensor,
    previousState: MaterialInternalState
  ): ConstitutiveResponse {
    const C = PlasticIntegrationEngine.buildElasticTangent(this.lambda, this.G);
    const stressVoigt: number[] = new Array(6).fill(0);

    for (let i = 0; i < 6; i++) {
      let sum = 0;
      for (let j = 0; j < 6; j++) {
        sum += C.get(i, j) * strainVoigt[j];
      }
      stressVoigt[i] = sum;
    }

    const energy = 0.5 * (
      stressVoigt[0] * strainVoigt[0] +
      stressVoigt[1] * strainVoigt[1] +
      stressVoigt[2] * strainVoigt[2] +
      stressVoigt[3] * strainVoigt[3] +
      stressVoigt[4] * strainVoigt[4] +
      stressVoigt[5] * strainVoigt[5]
    );

    const internalState: MaterialInternalState = {
      plasticStrainVoigt: [0, 0, 0, 0, 0, 0],
      equivalentPlasticStrain: 0.0,
      yieldStatus: 'ELASTIC',
      energyDensity: energy,
      plasticDissipation: 0.0
    };

    return {
      stressVoigt,
      tangentModulus: C,
      internalState,
      strainEnergyDensity: energy,
      isValid: true
    };
  }

  public computeEnergy(strainVoigt: number[], defGrad: DeformationGradientTensor): number {
    const resp = this.computeStressAndTangent(strainVoigt, defGrad, this.createInitialState());
    return resp.strainEnergyDensity;
  }

  public createInitialState(): MaterialInternalState {
    return {
      plasticStrainVoigt: [0, 0, 0, 0, 0, 0],
      equivalentPlasticStrain: 0.0,
      yieldStatus: 'ELASTIC',
      energyDensity: 0.0,
      plasticDissipation: 0.0
    };
  }

  public validateParameters(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (this.E <= 0 || !Number.isFinite(this.E)) errors.push('Young modulus E must be positive and finite');
    if (this.nu <= -1.0 || this.nu >= 0.5) errors.push('Poisson ratio nu must be in (-1.0, 0.5)');
    return { isValid: errors.length === 0, errors };
  }
}

export class J2PlasticityModel implements NonlinearConstitutiveModel {
  public readonly identity: MaterialModelIdentity = 'J2_PLASTICITY';
  public readonly name: string = 'J2 von Mises Elastoplastic Material';

  public readonly E: number;
  public readonly nu: number;
  public readonly initialYieldStress: number;
  public readonly H_iso: number;
  public readonly H_kin: number;

  constructor(public readonly params: J2PlasticityParameters) {
    this.E = params.E;
    this.nu = params.nu;
    this.initialYieldStress = params.initialYieldStress;
    this.H_iso = params.isotropicHardeningModulus;
    this.H_kin = params.kinematicHardeningModulus || 0.0;
  }

  public computeStressAndTangent(
    strainVoigt: number[],
    defGrad: DeformationGradientTensor,
    previousState: MaterialInternalState
  ): ConstitutiveResponse {
    const res = PlasticIntegrationEngine.integrateJ2(
      strainVoigt,
      previousState,
      this.E,
      this.nu,
      this.initialYieldStress,
      this.H_iso,
      this.H_kin
    );

    return {
      stressVoigt: res.stressVoigt,
      tangentModulus: res.tangentModulus,
      internalState: res.newState,
      strainEnergyDensity: res.newState.energyDensity,
      isValid: true
    };
  }

  public computeEnergy(strainVoigt: number[], defGrad: DeformationGradientTensor): number {
    const res = this.computeStressAndTangent(strainVoigt, defGrad, this.createInitialState());
    return res.strainEnergyDensity;
  }

  public createInitialState(): MaterialInternalState {
    return {
      plasticStrainVoigt: [0, 0, 0, 0, 0, 0],
      equivalentPlasticStrain: 0.0,
      backStressVoigt: [0, 0, 0, 0, 0, 0],
      yieldStatus: 'ELASTIC',
      energyDensity: 0.0,
      plasticDissipation: 0.0
    };
  }

  public validateParameters(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (this.E <= 0) errors.push('Young modulus E must be positive');
    if (this.nu <= -1.0 || this.nu >= 0.5) errors.push('Poisson ratio nu must be in (-1.0, 0.5)');
    if (this.initialYieldStress <= 0) errors.push('Initial yield stress must be positive');
    if (this.H_iso < 0) errors.push('Isotropic hardening modulus must be non-negative');
    if (this.H_kin < 0) errors.push('Kinematic hardening modulus must be non-negative');
    return { isValid: errors.length === 0, errors };
  }
}
