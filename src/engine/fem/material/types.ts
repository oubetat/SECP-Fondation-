import { Matrix } from "../core/MathUtils";

export type MaterialStatus =
  | 'ELASTIC'
  | 'YIELDING'
  | 'PLASTIC'
  | 'UNLOADING'
  | 'INVALID'
  | 'FAILED';

export type MaterialModelType =
  | 'LINEAR_ELASTIC'
  | 'J2_ISOTROPIC_ELASTOPLASTIC'
  | 'J2_PERFECT_PLASTICITY';

export type StressTensorType = '1D' | '2D_PLANE_STRESS' | '2D_PLANE_STRAIN' | '3D';

export type MaterialConvergenceVerdict =
  | 'CONVERGED'
  | 'NOT_CONVERGED'
  | 'INVALID_STATE'
  | 'INVALID_PARAMETERS'
  | 'NUMERICAL_FAILURE'
  | 'PHYSICS_FAILURE';

export interface J2MaterialParameters {
  E: number;                // Young's modulus (Pa > 0)
  nu: number;               // Poisson's ratio (-1 < nu < 0.5)
  yieldStress: number;      // Initial yield stress sigma_y0 (Pa > 0)
  hardeningModulus: number; // Isotropic hardening modulus H (Pa >= 0)
  planeState?: StressTensorType; // Default '3D'
  density?: number;         // kg/m^3
}

export interface MaterialParameters {
  materialId?: string;
  modelType: MaterialModelType;
  E: number;
  nu?: number;
  yieldStress?: number;
  hardeningModulus?: number;
  planeState?: StressTensorType;
  area?: number;
  thickness?: number;
  density?: number;
  [key: string]: any;
}

export interface ParameterValidationResult {
  isValid: boolean;
  errors: string[];
  bulkModulus?: number;
  shearModulus?: number;
  lameFirstParam?: number;
}

export interface MaterialStateData {
  stress: number[];                   // [sxx, syy, szz, tyz, txz, txy] in 3D or appropriate dimension
  totalStrain: number[];              // [exx, eyy, ezz, gyz, gxz, gxy]
  elasticStrain: number[];
  plasticStrain: number[];
  equivalentPlasticStrain: number;    // kappa >= 0
  plasticDissipation: number;         // Cumulative plastic work W_p >= 0
  elasticEnergy: number;              // Elastic strain energy W_e >= 0
  internalVariables: Record<string, number>;
  materialStatus: MaterialStatus;
  stepId: number;
  incrementId: number;
  stateHash?: string;
  version: string;
}

export interface ConstitutiveUpdateResult {
  stress: number[];
  elasticStrain: number[];
  plasticStrain: number[];
  equivalentPlasticStrain: number;
  plasticMultiplier: number;          // Delta gamma >= 0
  yieldFunctionValue: number;         // f(sigma, kappa)
  materialStatus: MaterialStatus;
  tangent: Matrix;
  plasticDissipationIncrement: number;
  elasticEnergy: number;
  iterations: number;
  initialResidual: number;
  finalResidual: number;
  converged: boolean;
  verdict: MaterialConvergenceVerdict;
  diagnostics?: string;
}

export interface MaterialIncrement {
  strainIncrement: number[];
  timeIncrement?: number;
  previousState: MaterialStateData;
  trialState?: MaterialStateData;
  tolerance?: number;
  incrementId: number;
  stepId?: number;
}
