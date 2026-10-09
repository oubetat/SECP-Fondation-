/**
 * SECP Industrial OS - PATCH-266: Material Database
 * Engineering Intelligence Layer - Material Types & Data Schema
 */

export type MaterialFamilyType =
  | 'METALS'
  | 'POLYMERS'
  | 'CERAMICS'
  | 'COMPOSITES'
  | 'OTHER';

export type MaterialSubfamilyType =
  | 'STEEL'
  | 'STAINLESS_STEEL'
  | 'ALUMINUM'
  | 'TITANIUM'
  | 'COPPER'
  | 'BRASS'
  | 'NICKEL_ALLOY'
  | 'CAST_IRON'
  | 'THERMOPLASTIC'
  | 'THERMOSET'
  | 'ENGINEERING_CERAMIC'
  | 'FIBER_COMPOSITE'
  | 'OTHER';

export type MaterialStateType = 'SOLID' | 'LIQUID' | 'GAS' | 'POWDER';

export type MaterialDirectionality = 'ISOTROPIC' | 'ORTHOTROPIC' | 'ANISOTROPIC';

export type MaterialStatus266 =
  | 'DRAFT'
  | 'IMPORTED'
  | 'VERIFIED'
  | 'APPROVED'
  | 'DEPRECATED'
  | 'INVALID';

export type EngineeringTruthStatus266 =
  | 'PROVEN'
  | 'PARTIAL'
  | 'UNPROVEN'
  | 'SIMULATED'
  | 'ABSENT';

export type PropertyOriginType =
  | 'MEASURED'
  | 'PUBLISHED'
  | 'DERIVED'
  | 'USER_DEFINED';

export type StandardOrganization =
  | 'ASTM'
  | 'ISO'
  | 'EN'
  | 'DIN'
  | 'JIS'
  | 'AMS'
  | 'UNS'
  | 'CUSTOM';

export interface StandardReference {
  organization: StandardOrganization;
  designation: string; // e.g., 'ASTM B209'
  title?: string;
  year?: string;
}

export interface MaterialSource266 {
  sourceId: string;
  publisher: string; // e.g. 'MMPDS-15', 'ASM Handbook Vol 2'
  document: string;
  revision: string;
  publicationDate: string;
  retrievalDate: string;
  referenceUrl?: string;
  evidenceStatus: 'VERIFIED' | 'UNVERIFIED' | 'AUDITED';
}

export interface MaterialConditionContext {
  temperatureK: number; // e.g., 293.15 K (20 °C)
  pressurePa?: number;
  strainRate?: number;
  environment?: string;
}

export interface ValidityRange266 {
  temperatureMinK?: number;
  temperatureMaxK?: number;
  pressureMinPa?: number;
  pressureMaxPa?: number;
  strainRateMin?: number;
  strainRateMax?: number;
}

export interface PropertyConfidence {
  basis: string; // e.g. 'Lab tensile test ASTM E8', 'MMPDS A-basis value'
  score: number; // 0.0 to 1.0
}

export type PropertyName266 =
  | 'DENSITY'
  | 'YOUNGS_MODULUS'
  | 'POISSONS_RATIO'
  | 'SHEAR_MODULUS'
  | 'BULK_MODULUS'
  | 'YIELD_STRENGTH'
  | 'ULTIMATE_TENSILE_STRENGTH'
  | 'COMPRESSIVE_STRENGTH'
  | 'SHEAR_STRENGTH'
  | 'THERMAL_CONDUCTIVITY'
  | 'SPECIFIC_HEAT'
  | 'THERMAL_EXPANSION'
  | 'MELTING_POINT'
  | 'SOLIDUS_TEMPERATURE'
  | 'LIQUIDUS_TEMPERATURE'
  | 'ELECTRICAL_RESISTIVITY'
  | 'ELECTRICAL_CONDUCTIVITY'
  | 'MAGNETIC_PERMEABILITY';

export interface MaterialPropertyValue266 {
  propertyName: PropertyName266;
  canonicalValue: number; // SI value
  canonicalUnit: string; // e.g. 'kg/m3', 'Pa', 'W/(m·K)', 'J/(kg·K)', '1/K', 'dimensionless'
  userDisplayUnit?: string;
  userDisplayValue?: number;
  originType: PropertyOriginType;
  sourceId: string;
  confidence: PropertyConfidence;
  condition: MaterialConditionContext;
  validityRange: ValidityRange266;
  derivationExpression?: string; // e.g. 'G = E / (2*(1+v))'
}

export interface StressStrainDataPoint {
  plasticStrain: number; // dimensionless
  trueStressPa: number; // Pascals
}

export interface MaterialStressStrainCurve {
  curveId: string;
  temperatureK: number;
  strainRate: number;
  direction: 'LONGITUDINAL' | 'TRANSVERSE' | 'THROUGH_THICKNESS' | 'ISOTROPIC';
  dataPoints: StressStrainDataPoint[];
  sourceId: string;
  units: {
    strain: 'dimensionless';
    stress: 'Pa';
  };
}

export interface CompositeMetadata266 {
  fiberType?: string; // e.g. 'Toray T700 Carbon'
  matrixType?: string; // e.g. 'Epoxy 3501-6'
  fiberVolumeFraction?: number; // e.g. 0.60
  layupReference?: string; // e.g. '[0/90/45/-45]s'
}

export interface OrthotropicElasticProperties266 {
  E1_Pa: number;
  E2_Pa: number;
  E3_Pa: number;
  nu12: number;
  nu23: number;
  nu13: number;
  G12_Pa: number;
  G23_Pa: number;
  G13_Pa: number;
}

export interface ManufacturingMetadata266 {
  machinabilityIndex?: number; // e.g., 50% relative to 1212 steel
  weldabilityRating?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'NOT_RECOMMENDED';
  formabilityRating?: string;
  heatTreatmentCompatibility?: string[];
  castabilityRating?: string;
}

export interface MaterialEvidenceItem266 {
  evidenceId: string;
  propertyName: PropertyName266;
  canonicalValue: number;
  canonicalUnit: string;
  sourceId: string;
  verificationStatus: 'VERIFIED' | 'PENDING' | 'AUDITED';
  timestamp: string;
  hash: string;
}

export interface MaterialDefinition266 {
  id: string; // Unique record key e.g. 'MAT-AL-6061-T6-V1'
  materialId: string; // Base identity e.g. 'MAT-AL-6061'
  canonicalName: string; // e.g. 'Aluminum 6061-T6'
  aliases: string[]; // e.g. ['AA6061-T6', 'UNS A96061', 'AlMg1SiCu']
  family: MaterialFamilyType;
  subfamily: MaterialSubfamilyType;
  grade: string; // e.g. '6061'
  temperCondition: string; // e.g. 'T6', 'Annealed', 'Quenched & Tempered'
  standard: StandardReference;
  manufacturer?: string;
  version: number; // 1, 2, 3...
  status: MaterialStatus266;
  truthStatus: EngineeringTruthStatus266;
  materialState: MaterialStateType;
  directionality: MaterialDirectionality;
  orthotropicProperties?: OrthotropicElasticProperties266;
  compositeMetadata?: CompositeMetadata266;
  manufacturingMetadata?: ManufacturingMetadata266;
  sources: MaterialSource266[];
  properties: Partial<Record<PropertyName266, MaterialPropertyValue266>>;
  stressStrainCurves?: MaterialStressStrainCurve[];
  evidence: MaterialEvidenceItem266[];
  createdAt: string;
  updatedAt: string;
  revisionHash: string;
}

export interface MaterialSnapshot266 {
  snapshotId: string;
  materialId: string;
  canonicalName: string;
  version: number;
  grade: string;
  temperCondition: string;
  standard: StandardReference;
  capturedAt: string;
  requiredProperties: PropertyName266[];
  properties: Record<string, { value: number; unit: string; origin: PropertyOriginType; sourceId: string }>;
  validityRanges: Record<string, ValidityRange266>;
  digitalSignatureSHA256: string;
}

export interface MaterialAssignment266 {
  assignmentId: string;
  targetEntityId: string; // CAD Part ID or Assembly Component ID
  targetEntityType: 'CAD_PART' | 'ASSEMBLY_COMPONENT';
  materialId: string;
  canonicalName: string;
  version: number;
  temperCondition: string;
  snapshotId: string;
  assignedAt: string;
  assignedBy: string;
  isCompliant: boolean;
  warnings: string[];
}

export interface MaterialAuditEntry266 {
  auditId: string;
  timestamp: string;
  action: 'CREATED' | 'IMPORTED' | 'REVISED' | 'APPROVED' | 'ASSIGNED' | 'SIMULATION_USED' | 'DEPRECATED';
  materialId: string;
  version: number;
  actor: string;
  details: string;
  hash: string;
}

export interface MaterialSearchResult266 {
  material: MaterialDefinition266;
  relevanceScore: number;
  matchedField: string;
}

export interface FemMaterialExport266 {
  materialName: string;
  unitSystem: 'SI_PA' | 'MM_MPA' | 'INCH_PSI';
  density: number;
  youngsModulus: number;
  poissonsRatio: number;
  shearModulus: number;
  bulkModulus: number;
  yieldStrength: number;
  ultimateTensileStrength: number;
  thermalConductivity?: number;
  specificHeat?: number;
  thermalExpansion?: number;
  sourceSnapshotId: string;
}
