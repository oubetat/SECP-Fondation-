/**
 * PATCH-271: Real Safety Factor & Margin Assessment Engine Data Definitions
 * 
 * Defines entities for Safety Assessment, Safety Methods Registry, Demand & Allowables,
 * Uncertainty Models, Spatial Safety Fields, Immutable Snapshots, and Provenance Evidence.
 */

import { StressTensor3D } from './FailureTypes270';

export type SafetyClassification271 =
  | 'PASS'
  | 'FAIL'
  | 'INVALID'
  | 'INSUFFICIENT_DATA'
  | 'OUT_OF_VALIDITY'
  | 'MATERIAL_ALLOWABLE_MISMATCH'
  | 'CRITERION_NOT_APPLICABLE';

export type SafetyMethodType271 =
  | 'YIELD_STATIC_VON_MISES'
  | 'YIELD_STATIC_TRESCA'
  | 'ULTIMATE_STATIC_RANKINE'
  | 'FRACTURE_LEFM_MODE_I'
  | 'FATIGUE_SAFETY_DAMAGE'
  | 'BUCKLING_EULER_LOAD'
  | 'SHEAR_ALLOWABLE_SAFETY'
  | 'THERMAL_DEGRADATION_SAFETY'
  | 'SERVICEABILITY_DISPLACEMENT';

export type DemandType271 =
  | 'STRESS'
  | 'STRAIN'
  | 'DISPLACEMENT'
  | 'FORCE'
  | 'TORQUE'
  | 'PRESSURE'
  | 'STRESS_INTENSITY_K'
  | 'J_INTEGRAL'
  | 'FATIGUE_DAMAGE'
  | 'BUCKLING_FACTOR';

export type AllowableSource271 =
  | 'MATERIAL_DATABASE'
  | 'ENGINEERING_SPEC'
  | 'STANDARD'
  | 'INTERNAL_APPROVED'
  | 'CUSTOM_USER_DEFINED';

export type ApprovalStatus271 =
  | 'DRAFT'
  | 'REVIEWED'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUPERSEDED';

export type GoverningFailureMode271 =
  | 'YIELD'
  | 'ULTIMATE_TENSILE'
  | 'ULTIMATE_COMPRESSIVE'
  | 'FRACTURE'
  | 'FATIGUE'
  | 'BUCKLING'
  | 'SHEAR'
  | 'SERVICEABILITY_DISPLACEMENT';

export interface DemandDefinition271 {
  demandId: string;
  type: DemandType271;
  value: number;
  unit: string; // e.g. 'Pa', 'm', 'N', 'Pa*sqrt(m)'
  stressTensor?: StressTensor3D;
  description?: string;
}

export interface AllowableDefinition271 {
  allowableId: string;
  type: string;
  value: number;
  unit: string;
  materialId: string;
  temperatureK: number;
  condition: string;
  criterion: string;
  source: AllowableSource271;
  revision: number;
  isDesignAllowable: boolean;
  description?: string;
}

export interface UncertaintyModel271 {
  status: 'UNCERTAINTY_MODELED' | 'UNCERTAINTY_NOT_MODELED';
  sources: {
    materialScatter?: number; // e.g. 0.05
    loadUncertainty?: number; // e.g. 0.10
    geometryTolerance?: number; // e.g. 0.02
    manufacturingTolerance?: number; // e.g. 0.03
    modelUncertainty?: number; // e.g. 0.05
  };
  confidenceLevel?: number; // e.g. 0.95 (95%)
}

export interface CriticalSafetyLocation271 {
  elementId: string;
  nodeId?: string;
  coordinates?: { x: number; y: number; z: number };
  calculatedFoS: number;
  safetyMargin: number;
  highestDemand: number;
  governingMode: GoverningFailureMode271;
}

export interface SafetyFactorMethod271 {
  methodId: SafetyMethodType271;
  name: string;
  requiredInputs: string[];
  applicableFailureCriteria: string[];
  applicableMaterialFamilies: string[];
  temperatureValidityRange: { minTempK: number; maxTempK: number };
  formulaDescription: string;
  assumptions: string[];
  verificationStatus: 'PROVEN' | 'PARTIAL' | 'UNPROVEN' | 'SIMULATED';
}

export interface SafetyAssessment {
  assessmentId: string;
  modelId: string;
  analysisId: string;
  materialId: string;
  materialRevision: number;
  loadCaseId: string;
  loadCases?: string[];
  loadCombinationFactors?: Record<string, number>;
  temperatureK: number;
  failureCriterion: string;
  methodId: SafetyMethodType271;
  demandDefinition: DemandDefinition271;
  allowableDefinition: AllowableDefinition271;
  calculatedDemand: number;
  allowableStrength: number;
  designAllowable: number;
  calculatedFoS: number;
  requiredFoS: number;
  requiredFoSSource: string;
  safetyMargin: number;
  marginDefinitionFormula: string;
  classification: SafetyClassification271;
  validityStatus: string;
  criticalLocation: CriticalSafetyLocation271;
  governingFailureMode: GoverningFailureMode271;
  uncertaintyModel: UncertaintyModel271;
  environmentalFactors?: {
    temperatureK: number;
    corrosionReductionFactor?: number;
    humidity?: number;
  };
  manufacturingTolerance?: {
    thicknessDevMm?: number;
    filletRadiusDevMm?: number;
  };
  evidenceHash: string;
  approvalStatus: ApprovalStatus271;
  timestamp: string;
}

export interface SafetyFactorField271 {
  meshId: string;
  loadCaseId: string;
  elementFoS: Array<{
    elementId: string;
    calculatedFoS: number;
    safetyMargin: number;
    governingMode: GoverningFailureMode271;
    classification: SafetyClassification271;
  }>;
  minFoS: number;
  criticalElementId: string;
  evidenceHash: string;
  timestamp: string;
}

export interface SafetyAssessmentSnapshot271 {
  snapshotId: string;
  assessmentId: string;
  materialRevision: number;
  temperatureK: number;
  loadCaseId: string;
  calculatedFoS: number;
  classification: SafetyClassification271;
  evidenceHash: string;
  timestamp: string;
  isImmutable: boolean;
}

export interface SafetyEngineeringReport271 {
  reportId: string;
  assessmentId: string;
  timestamp: string;
  modelId: string;
  materialId: string;
  materialRevision: number;
  loadCaseId: string;
  temperatureK: number;
  failureCriterion: string;
  calculatedDemand: number;
  allowableStrength: number;
  calculatedFoS: number;
  requiredFoS: number;
  safetyMargin: number;
  criticalLocation: CriticalSafetyLocation271;
  governingFailureMode: GoverningFailureMode271;
  uncertaintyModel: UncertaintyModel271;
  classification: SafetyClassification271;
  engineeringStatement: string;
  digitalCertificateSHA256: string;
}
