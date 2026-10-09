/**
 * PATCH-270: Fracture & Failure Criteria Engine Data Definitions
 * 
 * Defines entities for Failure Analysis, Model Registry, 3D Stress Tensors,
 * Principal Stress Calculations, Stress Invariants, Crack Geometry,
 * Fracture Mechanics (LEFM), Failure Indexes, Margins, and Evidence Snapshots.
 */

export type FailureCategory270 =
  | 'YIELD_FAILURE'
  | 'PLASTIC_FAILURE'
  | 'DUCTILE_FAILURE'
  | 'BRITTLE_FAILURE'
  | 'BUCKLING_FAILURE'
  | 'FRACTURE'
  | 'FATIGUE_FAILURE'
  | 'COMPOSITE_FAILURE'
  | 'CONTACT_FAILURE'
  | 'THERMAL_FAILURE';

export type FailureCriterionType270 =
  | 'VON_MISES'
  | 'TRESCA'
  | 'MAX_PRINCIPAL_STRESS'
  | 'MOHR_COULOMB'
  | 'DRUCKER_PRAGER'
  | 'LEFM_MODE_I'
  | 'LEFM_MIXED_MODE';

export type FailureClassification270 =
  | 'NO_FAILURE_PREDICTED'
  | 'YIELD_PREDICTED'
  | 'PLASTIC_FAILURE'
  | 'BRITTLE_FAILURE'
  | 'FRACTURE_PREDICTED'
  | 'LEFM_INVALID_FOR_CONDITION'
  | 'MISSING_REQUIRED_FAILURE_INPUT'
  | 'MATERIAL_DATASET_MISMATCH'
  | 'CRITERION_NOT_APPLICABLE'
  | 'OUT_OF_VALIDITY_RANGE';

export interface StressTensor3D {
  sigma_xx: number; // Pa
  sigma_yy: number; // Pa
  sigma_zz: number; // Pa
  tau_xy: number;   // Pa
  tau_yz: number;   // Pa
  tau_xz: number;   // Pa
  coordinateSystem: 'GLOBAL' | 'LOCAL_ELEMENT' | 'PRINCIPAL';
  elementId: string;
  nodeId?: string;
  integrationPoint?: number;
  loadCaseId: string;
}

export interface PrincipalStressResult {
  sigma1: number; // Pa (sigma1 >= sigma2 >= sigma3)
  sigma2: number; // Pa
  sigma3: number; // Pa
  principalDirections?: {
    v1: [number, number, number];
    v2: [number, number, number];
    v3: [number, number, number];
  };
  invariants: {
    I1: number; // First stress invariant (sigma_xx + sigma_yy + sigma_zz)
    I2: number; // Second stress invariant
    I3: number; // Third stress invariant (determinant of stress tensor)
    J2: number; // Second deviatoric stress invariant
    J3: number; // Third deviatoric stress invariant
    hydrostaticStressPa: number; // I1 / 3
    deviatoricStressTensor: number[][]; // 3x3 S_ij
    lodeParameter?: number; // Lode angle / parameter (-1 to +1)
  };
}

export interface CrackModel270 {
  crackId: string;
  location: string;
  orientationAngleRad: number;
  crackLengthA_m: number; // Crack length 'a' in meters
  crackDepthC_m?: number; // Crack depth 'c' in meters
  crackFrontType: 'THROUGH_CRACK' | 'SURFACE_CRACK' | 'INTERNAL_ELLIPTICAL' | 'EDGE_NOTCH';
  geometryCorrectionFactorY: number; // Y shape factor in K = Y * sigma * sqrt(pi * a)
  source: 'USER_DEFINED' | 'INSPECTION_MEASURED' | 'IMPACT_INDUCED';
}

export interface FractureMechanicsInput270 {
  crack: CrackModel270;
  appliedFarFieldStressPa: number;
  planeCondition: 'PLANE_STRESS' | 'PLANE_STRAIN' | 'THREE_DIMENSIONAL';
  materialKIC_PaSqrtM: number; // Fracture toughness K_IC in Pa*sqrt(m) (e.g. 30 MPa*sqrt(m) = 30e6)
  materialYieldStrengthPa: number; // For SSY small scale yielding check
}

export interface FailureModelDefinition270 {
  modelId: string;
  name: string;
  category: FailureCategory270;
  requiredInputs: string[];
  applicableMaterialFamilies: string[]; // e.g. ['ALUMINUM', 'STEEL', 'TITANIUM'] vs ['CAST_IRON', 'CONCRETE']
  applicableLoading: string[];
  validityRange: {
    minTempK?: number;
    maxTempK?: number;
    notes?: string;
  };
  parameters: Record<string, any>;
  limitations: string[];
  verificationStatus: 'PROVEN' | 'PARTIAL' | 'UNPROVEN' | 'SIMULATED';
}

export interface FailureEvaluationResult270 {
  analysisId: string;
  modelId: string;
  criterion: FailureCriterionType270;
  elementId: string;
  stressTensor: StressTensor3D;
  principalStresses: PrincipalStressResult;
  equivalentStressPa: number; // Equivalent or driving stress (e.g. von Mises stress or K_I)
  materialAllowableStrengthPa: number; // Allowable strength or K_IC
  failureIndex: number; // EquivalentStress / Allowable (or K_I / K_IC)
  failureMargin: number; // 1 - FailureIndex (or 1/FI - 1 depending on formulation)
  factorOfSafety?: number; // Allowable / Equivalent (when applicable)
  classification: FailureClassification270;
  assumptions: string[];
  limitations: string[];
  isValid: boolean;
  statusMessage: string;
}

export interface FEMFailureFieldResult270 {
  meshId: string;
  meshRevision: number;
  loadCaseId: string;
  temperatureK: number;
  materialId: string;
  materialRevision: number;
  criterion: FailureCriterionType270;
  elementResults: FailureEvaluationResult270[];
  criticalLocation: {
    elementId: string;
    maxFailureIndex: number;
    minMargin: number;
    dominantMode: FailureCategory270;
  };
  evidenceHash: string;
  timestamp: string;
}

export interface FailureAnalysisSnapshot270 {
  analysisId: string;
  meshId: string;
  meshRevision: number;
  materialId: string;
  materialRevision: number;
  temperatureK: number;
  loadCaseId: string;
  criterion: FailureCriterionType270;
  crackData?: CrackModel270;
  criticalLocation: {
    elementId: string;
    failureIndex: number;
    dominantMode: FailureCategory270;
  };
  evidenceHash: string;
  timestamp: string;
  isImmutable: boolean;
}

export interface FailureEngineeringReport270 {
  reportId: string;
  analysisId: string;
  timestamp: string;
  summary: {
    dominantFailureMode: FailureCategory270;
    maxFailureIndex: number;
    minMargin: number;
    criticalElementId: string;
    overallSafetyVerdict: 'SAFE' | 'YIELD_WARNING' | 'FAILURE_CRITICAL' | 'INVALID_ANALYSIS';
  };
  evaluatedCriteria: FailureEvaluationResult270[];
  applicableLimitations: string[];
  digitalCertificateSHA256: string;
}
