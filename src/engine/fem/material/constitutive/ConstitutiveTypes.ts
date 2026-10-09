/**
 * SECP CAD/CAE Platform - PATCH-233: Material Constitutive Engine Types
 *
 * Defines the unified Material Schema, Units, Material Point State, Provenance,
 * Error Handling, and Constitutive Interfaces.
 */

export type UnitSystemType = 'SI' | 'US_CUSTOMARY';

export interface MaterialUnits {
  system: UnitSystemType;
  stressUnit: string;        // 'Pa', 'MPa', 'GPa', 'psi', 'ksi'
  strainUnit: string;        // 'dimensionless', 'm/m', 'mm/mm'
  densityUnit: string;       // 'kg/m^3', 'g/cm^3', 'lb/in^3'
  temperatureUnit: string;   // 'K', 'C', 'F'
}

export interface MaterialIdentity {
  materialId: string;
  name: string;
  family: 'STEEL' | 'ALUMINUM' | 'TITANIUM' | 'POLYMERS' | 'CERAMICS' | 'COMPOSITES' | 'CONCRETE';
  source: string;
  isTestBenchmarkReference: boolean; // Must be flagged for audit integrity
}

export interface ElasticProperties {
  type: 'ISOTROPIC' | 'ORTHOTROPIC' | 'ANISOTROPIC';
  // Isotropic
  E?: number;                // Young's modulus (Pa)
  nu?: number;               // Poisson's ratio
  G?: number;                // Derived Shear modulus (Pa)
  K?: number;                // Derived Bulk modulus (Pa)
  
  // Orthotropic
  E1?: number; E2?: number; E3?: number;
  nu12?: number; nu23?: number; nu13?: number;
  G12?: number; G23?: number; G13?: number;

  // Anisotropic 6x6 Stiffness Matrix (Pa)
  C6x6?: number[][];
}

export interface ThermalProperties {
  expansionCoeffAlpha?: number;   // 1/K
  thermalConductivity?: number;    // W/(m K)
  specificHeat?: number;           // J/(kg K)
  temperaturePointsK?: number[];
  temperatureDependentE?: number[];
  temperatureDependentYield?: number[];
}

export type HardeningType = 'PERFECT' | 'ISOTROPIC' | 'KINEMATIC' | 'COMBINED';

export interface HardeningCurvePoint {
  plasticStrain: number;    // bar_eps_p
  yieldStress: number;      // sigma_y (Pa)
}

export interface PlasticProperties {
  initialYieldStress: number;    // sigma_y0 (Pa)
  hardeningType: HardeningType;
  isotropicHardeningModulus?: number; // H_iso (Pa)
  kinematicHardeningModulus?: number; // C_kin (Pa)
  kinematicRecallGamma?: number;      // gamma_kin
  hardeningCurve?: HardeningCurvePoint[];
}

export interface FailureProperties {
  ultimateTensileStrength?: number; // Pa
  failureStrain?: number;
  yieldCriterion: 'VON_MISES' | 'MAX_STRESS' | 'TSAI_WU' | 'CONCRETE_DRUCKER_PRAGER';
}

export type ConstitutiveModelType = 
  | 'ISOTROPIC_LINEAR_ELASTIC'
  | 'ORTHOTROPIC_LINEAR_ELASTIC'
  | 'ANISOTROPIC_LINEAR_ELASTIC'
  | 'J2_PLASTICITY';

export interface MaterialProvenance {
  revision: number;
  provenanceHash: string; // SHA-256 equivalent parameter fingerprint
  author: string;
  timestamp: string;
  sourceReference: string;
}

export interface MaterialConstitutiveDefinition {
  identity: MaterialIdentity;
  units: MaterialUnits;
  density: number; // kg/m^3
  elastic: ElasticProperties;
  thermal?: ThermalProperties;
  plastic?: PlasticProperties;
  failure?: FailureProperties;
  constitutiveType: ConstitutiveModelType;
  provenance: MaterialProvenance;
}

/**
 * State tracked at every individual Gauss / Integration Point
 */
export interface MaterialPointState {
  elementId: string;
  integrationPointId: number;
  temperatureK: number;
  totalStrain: number[];            // 6 Voigt components [e11, e22, e33, g23, g13, g12]
  stress: number[];                 // 6 Voigt components [s11, s22, s33, s23, s13, s12] (Pa)
  plasticStrain: number[];          // 6 Voigt components
  equivalentPlasticStrain: number; // bar_eps_p
  backStress: number[];             // 6 Voigt components (for kinematic hardening)
  elasticEnergyDensity: number;     // J/m^3
  plasticDissipation: number;       // J/m^3
  internalVariables: Record<string, number>;
  status: 'ELASTIC' | 'YIELDING' | 'PLASTIC' | 'UNLOADING' | 'FAILED';
  stepId: number;
  iterationId: number;
}

export type MaterialErrorCode =
  | 'ERR_INVALID_PARAMETERS'
  | 'ERR_POOR_CONDITIONING'
  | 'ERR_NON_POSITIVE_DEFINITE'
  | 'ERR_PLASTIC_CONVERGENCE_FAILED'
  | 'ERR_UNSUPPORTED_RATE_MODEL'
  | 'ERR_TEMPERATURE_OUT_OF_BOUNDS'
  | 'ERR_UNSUPPORTED_MODEL'
  | 'ERR_MATRIX_SINGULAR'
  | 'ERR_UNIT_MISMATCH';

export interface MaterialFailureDetail {
  code: MaterialErrorCode;
  location: string;
  elementId?: string;
  integrationPointId?: number;
  iteration?: number;
  reason: string;
}

export interface ConstitutiveResponse {
  stress: number[];                 // 6 Voigt components
  tangent: number[][];              // 6x6 Algorithmic Consistent Tangent C_tangent
  plasticStrain: number[];
  equivalentPlasticStrain: number;
  backStress: number[];
  elasticEnergyDensity: number;
  plasticDissipationIncrement: number;
  updatedState: MaterialPointState;
  converged: boolean;
  failure?: MaterialFailureDetail;
}
