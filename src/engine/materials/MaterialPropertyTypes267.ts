/**
 * SECP Industrial OS - PATCH-267: Material Properties
 * Engineering Intelligence Layer - Material Property System Data Types & Schema
 */

import {
  MaterialConditionContext,
  MaterialDirectionality,
  MaterialFamilyType,
  PropertyConfidence,
  PropertyOriginType,
  StandardOrganization,
  StandardReference,
  ValidityRange266,
} from './MaterialDatabase266Types';

export type PropertyCategory =
  | 'MECHANICAL'
  | 'THERMAL'
  | 'PHYSICAL'
  | 'ELECTRICAL'
  | 'MAGNETIC'
  | 'ACOUSTIC'
  | 'OPTICAL'
  | 'MANUFACTURING'
  | 'FATIGUE'
  | 'FRACTURE'
  | 'FLUID';

export type PropertyStatus267 =
  | 'DRAFT'
  | 'IMPORTED'
  | 'VALIDATED'
  | 'APPROVED'
  | 'DEPRECATED'
  | 'INVALID';

export type EngineeringTruthStatus267 =
  | 'PROVEN'
  | 'PARTIAL'
  | 'UNPROVEN'
  | 'SIMULATED'
  | 'ABSENT';

export type DimensionType =
  | 'MASS_DENSITY' // M L^-3 (e.g. kg/m3)
  | 'PRESSURE_STRESS_MODULUS' // M L^-1 T^-2 (e.g. Pa, MPa, GPa)
  | 'DIMENSIONLESS' // 1 (e.g. Poisson ratio, strain, porosity)
  | 'THERMAL_CONDUCTIVITY' // M L T^-3 K^-1 (e.g. W/(m·K))
  | 'SPECIFIC_HEAT' // L^2 T^-2 K^-1 (e.g. J/(kg·K))
  | 'THERMAL_EXPANSION' // K^-1 (e.g. 1/K, 1/°C)
  | 'TEMPERATURE' // K (e.g. Kelvin, °C)
  | 'ELECTRICAL_RESISTIVITY' // M L^3 T^-3 I^-2 (e.g. Ohm·m)
  | 'ELECTRICAL_CONDUCTIVITY' // M^-1 L^-3 T^3 I^2 (e.g. S/m)
  | 'MAGNETIC_PERMEABILITY' // M L T^-2 I^-2 (e.g. H/m)
  | 'HARDNESS_SCALE' // Scale value + method
  | 'VISCOSITY_DYNAMIC' // M L^-1 T^-1 (e.g. Pa·s)
  | 'VISCOSITY_KINEMATIC'; // L^2 T^-1 (e.g. m2/s)

export type DataOrigin = 'MEASURED' | 'PUBLISHED' | 'DERIVED' | 'USER_DEFINED' | 'ESTIMATED';

export type MaterialTemperCondition =
  | 'ANNEALED'
  | 'TEMPERED'
  | 'QUENCHED'
  | 'AGED'
  | 'SOLUTION_TREATED'
  | 'AS_CAST'
  | 'WORK_HARDENED'
  | 'COLD_ROLLED'
  | 'HOT_ROLLED'
  | 'CUSTOM';

export type ManufacturingCondition =
  | 'CAST'
  | 'FORGED'
  | 'ROLLED'
  | 'EXTRUDED'
  | 'ADDITIVELY_MANUFACTURED'
  | 'MACHINED'
  | 'POWDER_METALLURGY'
  | 'COMPOSITE_LAYUP';

export type PropertySourceType =
  | 'STANDARD'
  | 'MANUFACTURER'
  | 'EXPERIMENTAL'
  | 'PUBLISHED_REFERENCE'
  | 'USER_DEFINED';

export interface PropertySource {
  sourceId: string;
  type: PropertySourceType;
  organization?: StandardOrganization | string;
  publisher: string;
  document: string;
  revision?: string;
  testMethod?: string;
  publicationDate?: string;
  url?: string;
  evidenceStatus: 'VERIFIED' | 'UNVERIFIED' | 'AUDITED';
}

export interface MaterialCoordinateSystem {
  systemId: string;
  name: string;
  axis1Description: string; // e.g. 'Fiber Direction (L)'
  axis2Description: string; // e.g. 'Transverse Direction (T)'
  axis3Description: string; // e.g. 'Normal / Out-of-Plane (S)'
  orientationMatrix?: number[][]; // 3x3 transformation matrix
  version: number;
}

export interface OrthotropicElasticProperties {
  E1_Pa: number;
  E2_Pa: number;
  E3_Pa: number;
  nu12: number;
  nu23: number;
  nu13: number;
  G12_Pa: number;
  G23_Pa: number;
  G13_Pa: number;
  coordinateSystem: MaterialCoordinateSystem;
}

export interface HardnessProperty {
  scale: 'BRINELL_HBW' | 'ROCKWELL_HRC' | 'ROCKWELL_HRB' | 'VICKERS_HV' | 'KNOOP_HK';
  value: number;
  testLoadN?: number;
  indentorType?: string;
  conversionFormulaRef?: string; // Documented formula if converted
}

export interface StressStrainPoint {
  trueStrain: number; // dimensionless
  trueStressPa: number; // Pa
  plasticStrain?: number; // dimensionless
  engineeringStrain?: number;
  engineeringStressPa?: number;
}

export interface MaterialStressStrainDataset {
  datasetId: string;
  temperatureK: number;
  strainRate_s1: number;
  direction: 'LONGITUDINAL' | 'TRANSVERSE' | 'THROUGH_THICKNESS' | 'ISOTROPIC';
  dataPoints: StressStrainPoint[];
  source: PropertySource;
  isMonotonic: boolean;
  isValid: boolean;
  validationError?: string;
}

// Temperature-dependent property interface f(T) - Architecture ready for PATCH-268
export interface TemperatureDependentFunction {
  functionType: 'POLYNOMIAL' | 'PIECEWISE_LINEAR' | 'ARRHENIUS' | 'SPLINE';
  coefficients: number[];
  temperaturePointsK?: number[];
  propertyValuesSI?: number[];
  validityTempMinK: number;
  validityTempMaxK: number;
}

export interface MaterialProperty {
  propertyId: string;
  materialId: string;
  materialRevision: number;
  category: PropertyCategory;
  propertyType: string; // e.g. 'YOUNGS_MODULUS', 'DENSITY', etc.
  value: number; // SI canonical numerical value
  unit: string; // SI canonical unit string (e.g. 'Pa', 'kg/m3', 'W/(m·K)')
  dimension: DimensionType;
  dataOrigin: DataOrigin;
  source: PropertySource;
  conditions: {
    temperatureK: number;
    pressurePa?: number;
    strainRate_s1?: number;
    relativeHumidityPercent?: number;
    temperCondition?: MaterialTemperCondition;
    manufacturingCondition?: ManufacturingCondition;
  };
  validityRange: ValidityRange266;
  status: PropertyStatus267;
  truthStatus: EngineeringTruthStatus267;
  confidence: PropertyConfidence;
  derivationFormula?: string;
  temperatureFunction?: TemperatureDependentFunction; // f(T) readiness
  orthotropic?: OrthotropicElasticProperties;
  hardness?: HardnessProperty;
  stressStrainDataset?: MaterialStressStrainDataset;
  evidenceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialPropertySnapshot {
  snapshotId: string;
  materialId: string;
  materialName: string;
  materialRevision: number;
  properties: Record<string, MaterialProperty>;
  propertySetHash: string; // Deterministic cryptographic hash
  createdAt: string;
  isImmutable: boolean;
  metadata?: Record<string, string>;
}

export interface MaterialPropertyDependencyNode {
  propertyType: string;
  dependsOn: string[]; // Upstream property types, e.g. ['YOUNGS_MODULUS', 'POISSONS_RATIO']
  derivedByFormula?: string;
  isInvalidated: boolean;
}

export interface MaterialSolverMapping {
  solverType: 'FEM_ELASTIC' | 'FEM_PLASTIC' | 'THERMAL' | 'CFD' | 'FATIGUE' | 'OPTIMIZATION';
  requiredPropertyTypes: string[];
  optionalPropertyTypes: string[];
  mappedProperties: Record<string, { value: number; unit: string; propertyId: string }>;
  missingProperties: string[];
  isCompatible: boolean;
  warnings: string[];
}

export interface MaterialPropertyValidationReport {
  timestamp: string;
  materialId: string;
  materialRevision: number;
  totalProperties: number;
  validPropertiesCount: number;
  invalidPropertiesCount: number;
  missingRequiredProperties: string[];
  derivedPropertiesCount: number;
  outOfRangePropertiesCount: number;
  elasticConsistencyPassed: boolean;
  elasticConsistencyDiscrepancyPercent?: number;
  unprovenSourceCount: number;
  overallStatus: 'PASSED' | 'PASSED_WITH_WARNINGS' | 'FAILED';
  issues: string[];
}

export interface CorporateApprovedPropertySet {
  organizationId: string;
  setName: string;
  approvedBy: string;
  approvalDate: string;
  materialRevisions: Record<string, number>; // materialId -> approved revision
  status: 'ACTIVE' | 'ARCHIVED';
}
