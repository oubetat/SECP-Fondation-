import { MaterialIdentity, MaterialProperty, PropertyProvenance } from "../types";
import { MaterialDBStatus } from "../dbTypes";

export interface PlasticMaterialState {
  stress: number[]; // 6 components for 3D tensor (Voigt notation: s11, s22, s33, s12, s23, s13)
  plasticStrain: number[];
  elasticStrain: number[];
  equivalentPlasticStrain: number;
  backStress: number[];
  hardeningVariables: Record<string, number>;
  temperature: number;
  revision: number;
  converged: boolean;
  timestamp: string;
}

export interface PlasticTrialState extends PlasticMaterialState {
  trialStress: number[];
  yieldValue: number;
}

export enum FlowRuleType {
  ASSOCIATED = 'ASSOCIATED',
  NON_ASSOCIATED = 'NON_ASSOCIATED'
}

export enum HardeningType {
  ISOTROPIC = 'ISOTROPIC',
  KINEMATIC = 'KINEMATIC',
  COMBINED = 'COMBINED'
}

export interface PlasticityModelConfig {
  modelId: string;
  name: string;
  family: string;
  flowRule: FlowRuleType;
  hardening: HardeningType;
  parameters: Record<string, number>;
  provenance: PropertyProvenance;
}

export enum ConstitutiveVerdict {
  ELASTIC = 'ELASTIC',
  PLASTIC = 'PLASTIC',
  RETURN_MAPPING_FAILURE = 'RETURN_MAPPING_FAILURE',
  NUMERICAL_INSTABILITY = 'NUMERICAL_INSTABILITY',
  INVALID_STATE = 'INVALID_STATE'
}
