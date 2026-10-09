/**
 * SECP Industrial OS v2 — Industrial Constitutive Model Registry
 * Phase 18 (PATCH-178: Materials Benchmark → Industrial Materials Engine)
 *
 * Implements:
 * - Unified IIndustrialConstitutiveModel contract
 * - Dynamic constitutive model registration & instantiation
 * - Multi-model dispatch for FEM, CFD, and Multiphysics solvers
 */

import { ConstitutiveModelType, MaterialState } from '../types/IndustrialMaterialTypes';
import { J2IndustrialPlasticityModel, J2StressUpdateResult } from './J2IndustrialPlasticityModel';
import { HyperelasticIndustrialModel, HyperelasticStressResult } from './HyperelasticIndustrialModel';
import { FatigueIndustrialEngine } from './FatigueIndustrialEngine';
import { CreepIndustrialEngine } from './CreepIndustrialEngine';
import { FractureIndustrialEngine } from './FractureIndustrialEngine';

export interface ConstitutiveResponse {
  stressVoigt: number[];
  consistentTangent6x6: number[][];
  strainEnergyDensity: number;
  plasticDissipationIncrement: number;
  internalState: MaterialState;
  isValid: boolean;
  message?: string;
}

export interface IIndustrialConstitutiveModel {
  modelType: ConstitutiveModelType;
  updateStress(
    strainIncrementVoigt: number[],
    dtSeconds: number,
    temperatureK: number,
    state: MaterialState
  ): ConstitutiveResponse;
  computeTangent(state: MaterialState): number[][];
  computeEnergy(state: MaterialState): number;
  validateState(state: MaterialState): { isValid: boolean; warnings: string[] };
}

export class LinearElasticConstitutiveModel implements IIndustrialConstitutiveModel {
  public modelType: ConstitutiveModelType = 'ISOTROPIC_ELASTIC';
  private E_Pa: number;
  private nu: number;
  private Ce: number[][];

  constructor(E_GPa: number, nu: number) {
    this.E_Pa = E_GPa * 1e9;
    this.nu = nu;
    const lambda = (this.E_Pa * nu) / ((1 + nu) * (1 - 2 * nu));
    const twoG = this.E_Pa / (1 + nu);
    const G = this.E_Pa / (2 * (1 + nu));

    this.Ce = [
      [lambda + twoG, lambda, lambda, 0, 0, 0],
      [lambda, lambda + twoG, lambda, 0, 0, 0],
      [lambda, lambda, lambda + twoG, 0, 0, 0],
      [0, 0, 0, G, 0, 0],
      [0, 0, 0, 0, G, 0],
      [0, 0, 0, 0, 0, G]
    ];
  }

  public updateStress(
    strainIncrementVoigt: number[],
    dtSeconds: number,
    temperatureK: number,
    state: MaterialState
  ): ConstitutiveResponse {
    const updatedStrain = state.totalStrainVoigt.map((e, i) => e + strainIncrementVoigt[i]);
    const stress: number[] = new Array(6).fill(0);

    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        stress[i] += this.Ce[i][j] * updatedStrain[j];
      }
    }

    const energy = 0.5 * (
      stress[0] * updatedStrain[0] +
      stress[1] * updatedStrain[1] +
      stress[2] * updatedStrain[2] +
      stress[3] * updatedStrain[3] +
      stress[4] * updatedStrain[4] +
      stress[5] * updatedStrain[5]
    );

    const updatedState: MaterialState = {
      ...state,
      temperatureK,
      totalStrainVoigt: updatedStrain,
      stressVoigt: stress,
      strainEnergyDensity: energy,
      yieldStatus: 'ELASTIC'
    };

    return {
      stressVoigt: stress,
      consistentTangent6x6: this.Ce,
      strainEnergyDensity: energy,
      plasticDissipationIncrement: 0,
      internalState: updatedState,
      isValid: true
    };
  }

  public computeTangent(state: MaterialState): number[][] {
    return this.Ce;
  }

  public computeEnergy(state: MaterialState): number {
    return state.strainEnergyDensity;
  }

  public validateState(state: MaterialState): { isValid: boolean; warnings: string[] } {
    return { isValid: true, warnings: [] };
  }
}

export class J2PlasticityConstitutiveAdapter implements IIndustrialConstitutiveModel {
  public modelType: ConstitutiveModelType = 'J2_PLASTICITY';
  private j2Model: J2IndustrialPlasticityModel;

  constructor(j2Model: J2IndustrialPlasticityModel) {
    this.j2Model = j2Model;
  }

  public updateStress(
    strainIncrementVoigt: number[],
    dtSeconds: number,
    temperatureK: number,
    state: MaterialState
  ): ConstitutiveResponse {
    const result = this.j2Model.updateStress(strainIncrementVoigt, state);

    const updatedState: MaterialState = {
      ...state,
      temperatureK,
      totalStrainVoigt: state.totalStrainVoigt.map((e, i) => e + strainIncrementVoigt[i]),
      stressVoigt: result.stressVoigt,
      plasticStrainVoigt: result.plasticStrainVoigt,
      equivalentPlasticStrain: result.equivalentPlasticStrain,
      backStressVoigt: result.backStressVoigt,
      strainEnergyDensity: result.strainEnergyDensity,
      plasticDissipation: state.plasticDissipation + result.plasticDissipationIncrement,
      yieldStatus: result.yieldStatus
    };

    return {
      stressVoigt: result.stressVoigt,
      consistentTangent6x6: result.consistentTangent6x6,
      strainEnergyDensity: result.strainEnergyDensity,
      plasticDissipationIncrement: result.plasticDissipationIncrement,
      internalState: updatedState,
      isValid: true
    };
  }

  public computeTangent(state: MaterialState): number[][] {
    // Zero strain increment update to retrieve current tangent
    const res = this.j2Model.updateStress([0, 0, 0, 0, 0, 0], state);
    return res.consistentTangent6x6;
  }

  public computeEnergy(state: MaterialState): number {
    return state.strainEnergyDensity;
  }

  public validateState(state: MaterialState): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    if (state.equivalentPlasticStrain < 0) {
      warnings.push('Negative equivalent plastic strain detected.');
    }
    return { isValid: warnings.length === 0, warnings };
  }
}

export class IndustrialConstitutiveModelRegistry {
  private static registeredModels: Map<string, (config: any) => IIndustrialConstitutiveModel> = new Map();

  static {
    this.register('ISOTROPIC_ELASTIC', cfg => new LinearElasticConstitutiveModel(cfg.E_GPa, cfg.nu));
  }

  public static register(type: string, factory: (config: any) => IIndustrialConstitutiveModel): void {
    this.registeredModels.set(type, factory);
  }

  public static create(type: string, config: any): IIndustrialConstitutiveModel {
    const factory = this.registeredModels.get(type);
    if (!factory) {
      throw new Error(`Constitutive model '${type}' is not registered in IndustrialConstitutiveModelRegistry.`);
    }
    return factory(config);
  }

  public static getRegisteredTypes(): string[] {
    return Array.from(this.registeredModels.keys());
  }
}
