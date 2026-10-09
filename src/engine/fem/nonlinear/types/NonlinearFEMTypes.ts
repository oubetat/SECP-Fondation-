/**
 * SECP Industrial OS v2 — Nonlinear FEM 2.0 Framework Types
 * Phase 17 (PATCH-177: FEM Benchmark → Nonlinear FEM 2.0)
 *
 * Core architectural types for:
 * - Geometric Nonlinearity (Total Lagrangian, Updated Lagrangian)
 * - Material Nonlinearity (J2 Plasticity, Neo-Hookean, Mooney-Rivlin)
 * - Surface-to-Surface Contact 2.0 (Penalty, Augmented Lagrangian, Coulomb Friction)
 * - Nonlinear Newton-Raphson Solver & Adaptive Step Controller
 * - Energy Conservation & Stability Monitors
 */

import { Matrix } from '../../core/MathUtils';

// ==========================================
// 1. Kinematics & Strain Types
// ==========================================

export type NonlinearKinematicsType = 'TOTAL_LAGRANGIAN' | 'UPDATED_LAGRANGIAN' | 'SMALL_STRAIN';

export interface DeformationGradientTensor {
  F: number[][];           // Deformation gradient tensor dx/dX (3x3 or 2x2)
  J: number;               // Jacobian determinant det(F)
  Finv: number[][];        // Inverse deformation gradient F^(-1)
  FT: number[][];          // Transpose F^T
  C: number[][];           // Right Cauchy-Green deformation tensor C = F^T * F
  B: number[][];           // Left Cauchy-Green deformation tensor B = F * F^T
  GreenLagrangeStrain: number[][]; // E = 0.5 * (C - I)
  AlmansiStrain: number[][];       // e = 0.5 * (I - B^(-1))
  volumetricRatio: number; // J
  isDistorted: boolean;    // J <= 0 or extreme distortion
}

export interface CoordinateState {
  referenceCoords: number[][]; // Material / Initial Coordinates X_a [nodeCount x dim]
  currentCoords: number[][];   // Spatial / Current Coordinates x_a [nodeCount x dim]
  displacements: number[][];   // Displacement u_a = x_a - X_a [nodeCount x dim]
}

export interface NonlinearKinematicsUpdateResult {
  kinematicsType: NonlinearKinematicsType;
  defGrad: DeformationGradientTensor;
  strainVector: number[];      // Voigt strain vector [E11, E22, E33, 2E23, 2E13, 2E12]
  spatialGradN: number[][];    // dN/dx or dN/dX [nodeCount x dim]
  volumeWeight: number;       // dV or dV0 * det(J_iso) * weight
}

// ==========================================
// 2. Material & Constitutive Model Types
// ==========================================

export type MaterialModelIdentity = 
  | 'LINEAR_ELASTIC'
  | 'J2_PLASTICITY'
  | 'NEO_HOOKEAN'
  | 'MOONEY_RIVLIN'
  | 'OGDEN'
  | 'YEOH';

export interface MaterialParametersBase {
  modelIdentity: MaterialModelIdentity;
  density: number;
}

export interface LinearElasticParameters extends MaterialParametersBase {
  modelIdentity: 'LINEAR_ELASTIC';
  E: number;   // Young's Modulus (Pa)
  nu: number;  // Poisson's Ratio
}

export interface J2PlasticityParameters extends MaterialParametersBase {
  modelIdentity: 'J2_PLASTICITY';
  E: number;
  nu: number;
  initialYieldStress: number;   // sigma_y0 (Pa)
  isotropicHardeningModulus: number; // H_iso (Pa)
  kinematicHardeningModulus?: number; // H_kin (Pa)
  saturationHardeningStress?: number; // Q_inf (Pa)
  saturationHardeningRate?: number;   // b_rate
}

export interface NeoHookeanParameters extends MaterialParametersBase {
  modelIdentity: 'NEO_HOOKEAN';
  mu: number;      // Shear modulus (Pa)
  bulkK: number;   // Bulk modulus K (Pa)
}

export interface MooneyRivlinParameters extends MaterialParametersBase {
  modelIdentity: 'MOONEY_RIVLIN';
  C10: number;     // Material parameter C10 (Pa)
  C01: number;     // Material parameter C01 (Pa)
  bulkK: number;   // Bulk modulus K (Pa)
}

export type AnyMaterialParameters =
  | LinearElasticParameters
  | J2PlasticityParameters
  | NeoHookeanParameters
  | MooneyRivlinParameters;

export interface MaterialInternalState {
  plasticStrainVoigt: number[];       // Plastic strain tensor in Voigt
  equivalentPlasticStrain: number;    // Accumulated plastic strain p
  backStressVoigt?: number[];         // Kinematic back stress alpha
  yieldStatus: 'ELASTIC' | 'PLASTIC' | 'YIELDING';
  damageVariable?: number;
  energyDensity: number;              // Strain energy density W
  plasticDissipation: number;         // Accumulated plastic dissipation
}

export interface ConstitutiveResponse {
  stressVoigt: number[];              // 2nd PK stress S (TL) or Cauchy stress sigma (UL)
  tangentModulus: Matrix;             // Consistent algorithmic tangent C_tangent (6x6)
  internalState: MaterialInternalState;
  strainEnergyDensity: number;
  isValid: boolean;
  message?: string;
}

export interface NonlinearConstitutiveModel {
  readonly identity: MaterialModelIdentity;
  readonly name: string;
  computeStressAndTangent(
    strainVoigt: number[],
    defGrad: DeformationGradientTensor,
    previousState: MaterialInternalState
  ): ConstitutiveResponse;
  computeEnergy(strainVoigt: number[], defGrad: DeformationGradientTensor): number;
  createInitialState(): MaterialInternalState;
  validateParameters(): { isValid: boolean; errors: string[] };
}

// ==========================================
// 3. Contact 2.0 & Surface Types
// ==========================================

export type ContactEnforcementMethod = 'PENALTY' | 'AUGMENTED_LAGRANGIAN' | 'LAGRANGE_MULTIPLIER';

export type ContactStatus = 'OPEN' | 'CLOSING' | 'CONTACT' | 'SEPARATING' | 'PENETRATING';

export interface SurfaceFacet2D {
  facetId: string;
  surfaceId: string;
  nodeIds: [string, string];
  normal: [number, number];
  length: number;
}

export interface SurfaceFacet3D {
  facetId: string;
  surfaceId: string;
  nodeIds: [string, string, string] | [string, string, string, string];
  normal: [number, number, number];
  area: number;
}

export interface ContactPairDefinition {
  pairId: string;
  masterSurfaceName: string;
  slaveSurfaceName: string;
  enforcement: ContactEnforcementMethod;
  penaltyStiffness: number;       // k_N (N/m or N/m^2)
  tangentialPenaltyStiffness?: number; // k_T
  frictionCoefficient: number;    // mu
  searchTolerance: number;        // distance for broad phase
  penetrationTolerance: number;   // allowed penetration
}

export interface ContactPointEvaluation {
  slaveNodeId: string;
  masterFacetId: string;
  status: ContactStatus;
  normalGap: number;              // g_N (positive = open, negative = penetrating)
  tangentialSlip: number;         // delta_u_T
  normalPressure: number;         // p_N
  frictionTraction: number;       // tau_T
  isSticking: boolean;
  contactForceVector: number[];   // [Fx, Fy, Fz]
  contactTangentMatrix?: Matrix;  // Local contribution to K_contact
}

export interface GlobalContactResult {
  contactForce: number[];          // F_contact [totalDOFs]
  contactTangent: Matrix;          // K_contact [totalDOFs x totalDOFs]
  activeContactsCount: number;
  maxPenetration: number;
  totalContactEnergy: number;
  contactEvaluations: ContactPointEvaluation[];
}

// ==========================================
// 4. Nonlinear Step, Solver & Energy Types
// ==========================================

export interface NonlinearStepOptions {
  stepIndex: number;
  totalSteps: number;
  loadFactor: number;             // lambda in [0, 1]
  deltaLoad: number;              // delta_lambda
  minDeltaLoad: number;
  maxDeltaLoad: number;
  maxIterations: number;
  convergenceTolerance: {
    forceResidual: number;        // ||R|| / ||F_ext|| (default 1e-4)
    displacementIncrement: number;// ||du|| / ||u|| (default 1e-4)
    energyNorm: number;           // du^T * R (default 1e-6)
    contactResidual: number;      // contact gap tolerance
  };
  enableLineSearch: boolean;
  enableAutomaticCutback: boolean;
  kinematics: NonlinearKinematicsType;
}

export interface NonlinearConvergenceState {
  iteration: number;
  forceResidualNorm: number;
  relativeForceResidual: number;
  displacementIncrementNorm: number;
  energyNorm: number;
  contactPenetrationMax: number;
  lineSearchStepAlpha: number;
  isConverged: boolean;
  isDiverging: boolean;
  statusMessage: string;
}

export interface EnergyBalanceState {
  externalWork: number;           // W_ext
  internalStrainEnergy: number;   // U_strain
  contactEnergy: number;          // W_contact
  plasticDissipation: number;     // D_plastic
  energyResidual: number;         // |W_ext - (U_strain + W_contact + D_plastic)|
  energyConservationErrorPercent: number;
}

export interface NonlinearStepResult {
  stepIndex: number;
  loadFactor: number;
  converged: boolean;
  iterationsCount: number;
  displacements: number[];        // Global u vector
  reactionForces: number[];       // F_reaction
  stressState: {
    vonMisesMax: number;
    hydrostaticMax: number;
    maxPrincipal: number;
  };
  plasticState: {
    maxEquivalentPlasticStrain: number;
    yieldedElementsCount: number;
  };
  contactState: {
    activePoints: number;
    maxPenetration: number;
  };
  energy: EnergyBalanceState;
  convergenceHistory: NonlinearConvergenceState[];
}
