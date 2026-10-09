/**
 * SECP Industrial OS v2 — Industrial Materials Engine Types
 * Phase 18 (PATCH-178: Materials Benchmark → Industrial Materials Engine)
 *
 * Comprehensive Type System:
 * - Material Identity, Specifications, Standards (ASTM, ISO, DIN, AMS, MMPDS)
 * - Temperature-Dependent Curves with explicit Interpolation & Extrapolation policies
 * - Constitutive Modeling (Elastic, J2 Plasticity, Hyperelastic, Creep, Fatigue, Fracture)
 * - Material State tracking (Internal variables, backstress, damage, dissipation)
 * - Uncertainty Quantification (Normal, Lognormal, Weibull, MMPDS A/B-Basis allowables)
 * - Provenance & Digital EN 10204 3.1 / 3.2 Mill Test Certificates
 * - Unit-Safe Property System
 * - Solver Material Adapters (FEM, CFD, Multiphysics)
 */

// ==========================================
// 1. Standards & Identification
// ==========================================

export enum StandardOrganization {
  ASTM = 'ASTM',
  ISO = 'ISO',
  DIN = 'DIN',
  EN = 'EN',
  SAE = 'SAE',
  AMS = 'AMS',
  JIS = 'JIS',
  GB = 'GB',
  ASME = 'ASME',
  MMPDS = 'MMPDS',
  SECP_INTERNAL = 'SECP_INTERNAL'
}

export enum IndustrialMaterialFamily {
  STEEL = 'STEEL',
  STAINLESS_STEEL = 'STAINLESS_STEEL',
  ALUMINUM = 'ALUMINUM',
  TITANIUM = 'TITANIUM',
  NICKEL_SUPERALLOY = 'NICKEL_SUPERALLOY',
  COPPER_ALLOY = 'COPPER_ALLOY',
  POLYMER = 'POLYMER',
  ELASTOMER = 'ELASTOMER',
  CERAMIC = 'CERAMIC',
  COMPOSITE = 'COMPOSITE',
  FLUID = 'FLUID'
}

export enum HeatTreatmentCondition {
  ANNEALED = 'ANNEALED',
  NORMALIZED = 'NORMALIZED',
  QUENCHED_TEMPERED = 'QUENCHED_TEMPERED',
  SOLUTION_TREATED_AGED = 'SOLUTION_TREATED_AGED',
  T6_TEMPER = 'T6_TEMPER',
  T73_TEMPER = 'T73_TEMPER',
  COLD_WORKED = 'COLD_WORKED',
  AS_ROLLED = 'AS_ROLLED',
  AS_CAST = 'AS_CAST',
  VULCANIZED = 'VULCANIZED',
  SINTERED = 'SINTERED'
}

export interface MaterialIdentity {
  materialId: string;
  canonicalName: string;
  family: IndustrialMaterialFamily;
  grade: string;
  condition: HeatTreatmentCondition;
  standardOrg: StandardOrganization;
  standardCode: string;             // e.g. "ASTM B348", "EN 10025-2"
  standardVersion: string;          // e.g. "2023a", "2019"
  unsNumber?: string;               // e.g. "R56400"
  dinEnNumber?: string;             // e.g. "3.7165" / "1.4404"
  supplier?: string;
  provenanceHash: string;
  description: string;
}

export interface ChemicalCompositionSpec {
  element: string;                  // e.g. "C", "Cr", "Ni", "Mo", "Ti", "Al", "V"
  minPercent: number;
  maxPercent: number;
}

export interface MaterialSpecification {
  specId: string;
  governingStandard: string;
  chemicalSpecs: ChemicalCompositionSpec[];
  minTensileYieldStrengthMPa: number;
  minTensileUltimateStrengthMPa: number;
  minElongationPercent: number;
  minReductionOfAreaPercent?: number;
  minImpactEnergyJoule?: number;
  hardnessRequirement?: string;
}

// ==========================================
// 2. Unit-Safe System & Temperature Curves
// ==========================================

export type PhysicalDimension = 
  | 'STRESS_PRESSURE'      // Pa, MPa, GPa, psi, ksi
  | 'MODULUS'              // Pa, GPa, psi, Msi
  | 'TEMPERATURE'          // K, °C, °F
  | 'DENSITY'              // kg/m³, g/cm³, lb/in³
  | 'THERMAL_CONDUCTIVITY' // W/(m·K), BTU/(hr·ft·°F)
  | 'SPECIFIC_HEAT'        // J/(kg·K)
  | 'THERMAL_EXPANSION'    // 1/K, 1/°C, 1/°F
  | 'VISCOSITY_DYNAMIC'    // Pa·s, cP
  | 'FRACTURE_TOUGHNESS'   // MPa·m^(1/2), ks·in^(1/2)
  | 'ENERGY_RELEASE_RATE'  // J/m², N/m
  | 'STRAIN'               // dimensionless (m/m)
  | 'TIME';                // s, hr

export interface UnitSafeValue {
  value: number;
  unit: string;
  siValue: number;
  dimension: PhysicalDimension;
}

export type InterpolationPolicy = 'LINEAR' | 'CUBIC_SPLINE' | 'POLYNOMIAL' | 'AKIMA';
export type ExtrapolationPolicy = 'CLAMP' | 'DISALLOW_THROW' | 'LINEAR_TANGENT';

export interface TemperatureCurvePoint {
  temperatureKelvin: number;
  value: number; // in declared unit
}

export interface TemperatureCurve {
  propertyName: string;
  dimension: PhysicalDimension;
  unit: string;
  siUnit: string;
  minValidTempK: number;
  maxValidTempK: number;
  interpolationPolicy: InterpolationPolicy;
  extrapolationPolicy: ExtrapolationPolicy;
  points: TemperatureCurvePoint[];
}

// ==========================================
// 3. Constitutive Model Formulations
// ==========================================

export type ConstitutiveModelType =
  | 'ISOTROPIC_ELASTIC'
  | 'ORTHOTROPIC_ELASTIC'
  | 'J2_PLASTICITY'
  | 'CRYSTAL_PLASTICITY'
  | 'NEO_HOOKEAN'
  | 'MOONEY_RIVLIN'
  | 'OGDEN'
  | 'ARRUDA_BOYCE'
  | 'YEOH'
  | 'NORTON_BAILEY_CREEP'
  | 'LEFM_FRACTURE'
  | 'EPFM_FRACTURE';

export type HardeningLawType = 
  | 'PERFECT_PLASTIC'
  | 'LINEAR_ISOTROPIC'
  | 'VOCE_NONLINEAR'
  | 'SWIFT_POWER_LAW'
  | 'RAMBERG_OSGOOD'
  | 'ARMSTRONG_FREDERICK_KINEMATIC'
  | 'ZIEGLER_PRAGER_KINEMATIC'
  | 'COMBINED_ISOTROPIC_KINEMATIC';

export interface J2PlasticityParams {
  initialYieldStressMPa: number;
  hardeningLaw: HardeningLawType;
  isotropicHardeningModulusMPa?: number;   // H
  saturationYieldStressMPa?: number;       // Q_inf
  saturationHardeningRate?: number;        // b
  swiftStrengthCoefficientK_MPa?: number;  // K
  swiftHardeningExponentN?: number;        // n
  swiftInitialStrainEps0?: number;         // eps0
  kinematicModulusC_MPa?: number;          // C_k
  kinematicRecallGamma?: number;           // gamma_k
}

export interface HyperelasticParams {
  modelType: 'NEO_HOOKEAN' | 'MOONEY_RIVLIN' | 'OGDEN' | 'ARRUDA_BOYCE' | 'YEOH';
  bulkModulusK_MPa: number;
  // Neo-Hookean
  shearModulusMu_MPa?: number;
  // Mooney-Rivlin
  C10_MPa?: number;
  C01_MPa?: number;
  // Ogden
  ogdenMu_MPa?: number[];
  ogdenAlpha?: number[];
  // Yeoh
  yeohC1_MPa?: number;
  yeohC2_MPa?: number;
  yeohC3_MPa?: number;
  // Arruda-Boyce
  arrudaMu_MPa?: number;
  limitingChainStretchN?: number;
}

export interface CreepParams {
  modelType: 'NORTON_BAILEY' | 'TIME_HARDENING' | 'STRAIN_HARDENING';
  nortonA: number;             // Pre-exponential constant (1/s / (MPa)^n)
  stressExponentN: number;     // n
  timeExponentM?: number;      // m (for Bailey time hardening, default 0)
  activationEnergyQ_J_mol: number; // Q (J/mol)
  referenceTempK: number;
}

export interface FatigueParams {
  enduranceLimitSe_MPa: number;
  fatigueStrengthCoeffSigmaF_MPa: number;   // sigma'_f
  fatigueStrengthExponentB: number;         // b (Basquin slope, typically -0.05 to -0.15)
  fatigueDuctilityCoeffEpsF: number;        // eps'_f
  fatigueDuctilityExponentC: number;        // c (Coffin-Manson slope, typically -0.5 to -0.7)
  cyclicYieldStrengthMPa?: number;          // sigma'_y
  cyclicHardeningExponentKPrime?: number;
}

export interface FractureParams {
  planeStrainFractureToughnessK1c_MPa_sqrt_m: number; // K_IC
  criticalEnergyReleaseRateGc_J_m2: number;            // G_C
  criticalCTOD_mm?: number;                            // delta_t
  parisConstantC: number;                              // C (m/cycle / (MPa*sqrt(m))^m)
  parisExponentM: number;                              // m
  thresholdDeltaK_MPa_sqrt_m: number;                  // Delta K_th
}

// ==========================================
// 4. Dynamic Simulation State
// ==========================================

export interface MaterialState {
  temperatureK: number;
  totalStrainVoigt: number[];          // [eps11, eps22, eps33, 2eps23, 2eps13, 2eps12]
  stressVoigt: number[];               // [sig11, sig22, sig33, sig23, sig13, sig12]
  plasticStrainVoigt: number[];
  equivalentPlasticStrain: number;     // p
  backStressVoigt: number[];           // alpha tensor in Voigt
  creepStrainVoigt: number[];
  damageVariable: number;              // D in [0, 1]
  strainEnergyDensity: number;         // W
  plasticDissipation: number;          // D_p
  yieldStatus: 'ELASTIC' | 'PLASTIC' | 'YIELDING' | 'DAMAGED';
  internalVariables: Map<string, number>;
}

// ==========================================
// 5. Uncertainty & Design Allowables
// ==========================================

export type ProbabilityDistributionType = 'NORMAL' | 'LOGNORMAL' | 'WEIBULL' | 'UNIFORM';

export interface MaterialUncertainty {
  propertyName: string;
  nominalValue: number;
  meanValue: number;
  standardDeviation: number;
  coefficientOfVariation: number;
  distributionType: ProbabilityDistributionType;
  weibullModulusM?: number;
  weibullScaleSigma0?: number;
  confidenceInterval95: [number, number];
  confidenceInterval99: [number, number];
  // MMPDS Design Allowables
  basisA_Allowable: number; // 99% of population with 95% confidence
  basisB_Allowable: number; // 90% of population with 95% confidence
  sampleSizeN: number;
}

// ==========================================
// 6. Provenance & Mill Test Certificates
// ==========================================

export enum CertificateType {
  EN_10204_3_1 = 'EN_10204_3_1',
  EN_10204_3_2 = 'EN_10204_3_2',
  MILL_TEST_CERTIFICATE_MTC = 'MILL_TEST_CERTIFICATE_MTC',
  NADCAP_INDEPENDENT_LAB = 'NADCAP_INDEPENDENT_LAB'
}

export enum CertificateVerificationStatus {
  VERIFIED = 'VERIFIED',
  ATTACHED = 'ATTACHED',
  NON_COMPLIANT = 'NON_COMPLIANT',
  EXPIRED = 'EXPIRED',
  REJECTED = 'REJECTED'
}

export interface MaterialCertificate {
  certificateId: string;
  certificateType: CertificateType;
  issuer: string;
  heatOrLotNumber: string;
  issueDate: string;
  standardConformity: string;
  chemicalAnalysisResults: Record<string, number>; // Element -> Measured %
  mechanicalTestResults: {
    yieldStrengthMPa: number;
    ultimateTensileStrengthMPa: number;
    elongationPercent: number;
    reductionOfAreaPercent?: number;
    impactEnergyJoule?: number;
    hardnessHBW?: number;
  };
  nondestructiveTestResults?: string;
  digitalSignatureHash: string;
  verificationStatus: CertificateVerificationStatus;
  complianceNotes: string[];
}

export interface MaterialProvenance {
  sourceStandard: string;
  sourceDatasetId: string;
  testStandardE8_ASTM: boolean;
  testStandardE21_HighTemp_ASTM: boolean;
  testStandardE606_Fatigue_ASTM: boolean;
  testStandardE1820_Fracture_ASTM: boolean;
  certifyingLaboratory: string;
  timestamp: string;
  authorizingMetrologist: string;
  immutableLedgerHash: string;
}

// ==========================================
// 7. Industrial Material Aggregate Root
// ==========================================

export interface IndustrialMaterial {
  identity: MaterialIdentity;
  specification: MaterialSpecification;
  nominalProperties: {
    density_kg_m3: number;
    youngsModulus_GPa: number;
    poissonsRatio: number;
    shearModulus_GPa: number;
    bulkModulus_GPa: number;
    tensileYieldStrength_MPa: number;
    tensileUltimateStrength_MPa: number;
    thermalConductivity_W_mK: number;
    specificHeat_J_kgK: number;
    thermalExpansionCoeff_1_K: number;
    meltingPoint_K: number;
  };
  temperatureCurves: Map<string, TemperatureCurve>;
  plasticityModel?: J2PlasticityParams;
  hyperelasticModel?: HyperelasticParams;
  creepModel?: CreepParams;
  fatigueModel?: FatigueParams;
  fractureModel?: FractureParams;
  uncertainties: Map<string, MaterialUncertainty>;
  provenance: MaterialProvenance;
  certificate?: MaterialCertificate;
  isValidated: boolean;
  validationIssues: string[];
}
