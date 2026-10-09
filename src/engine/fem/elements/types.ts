import { Matrix } from "../core/MathUtils";

export type ElementFamily = 'BAR' | 'TRIANGLE' | 'QUADRILATERAL' | 'TETRAHEDRON' | 'HEXAHEDRON' | 'BEAM' | 'SHELL' | 'SOLID';

export type ElementStatus = 'IMPLEMENTED' | 'VERIFIED' | 'EXPERIMENTAL' | 'UNSUPPORTED' | 'DEPRECATED';

export type ElementDimension = 1 | 2 | 3;

export type DOFType = 'UX' | 'UY' | 'UZ' | 'ROTX' | 'ROTY' | 'ROTZ';

export interface IntegrationPoint {
  xi: number;
  eta?: number;
  zeta?: number;
  weight: number;
}

export interface IntegrationRule {
  ruleId: string;
  dimension: number;
  order: number;
  points: IntegrationPoint[];
  totalWeight: number;
  formulationCompatibility: string[];
}

export interface MaterialProperties {
  materialId?: string;
  E: number; // Young's modulus (Pa)
  nu?: number; // Poisson's ratio
  area?: number; // Cross-sectional area for 1D bar (m^2)
  thickness?: number; // Thickness for 2D plane elements (m)
  density?: number; // kg/m^3
  planeState?: 'PLANE_STRESS' | 'PLANE_STRAIN';
}

export interface ElementDefinition {
  elementTypeId: string;
  family: ElementFamily;
  dimension: ElementDimension;
  nodeCount: number;
  polynomialOrder: number;
  dofsPerNode: number;
  dofTypes: DOFType[];
  formulationVersion: string;
  defaultIntegrationRuleId: string;
  materialModelCompatibility: string[];
  geometricRequirements: {
    minNodes: number;
    maxNodes: number;
    manifoldDimension: number;
  };
  physicsCapabilities: {
    linearStatic: boolean;
    thermal: boolean;
    dynamic: boolean;
    nonlinear: boolean;
  };
  implementationStatus: ElementStatus;
}

export interface ElementMatrixEvidence {
  elementId: string;
  elementTypeId: string;
  formulationHash: string;
  coordinatesHash: string;
  materialHash: string;
  integrationHash: string;
  matrixHash: string;
  timestamp: string;
}

export interface ElementQualityMetrics {
  isValid: boolean;
  isDegenerate: boolean;
  minJacobian: number;
  maxJacobian: number;
  jacobianRatio: number;
  aspectRatio: number;
  skewness: number;
  warpage?: number;
  minAngleDeg?: number;
  maxAngleDeg?: number;
  volumeOrArea: number;
  qualityRating: 'EXCELLENT' | 'GOOD' | 'POOR' | 'INVALID';
  failureReasons: string[];
}

export interface ElementComputedStiffness {
  elementId: string;
  elementTypeId: string;
  formulationVersion: string;
  stiffnessMatrix: Matrix;
  integrationRuleId: string;
  dofCount: number;
  matrixHash: string;
}

export interface ElementComputedLoadVector {
  elementId: string;
  elementTypeId: string;
  loadVector: number[];
  loadType: 'NODAL' | 'BODY' | 'TRACTION';
}

export interface ElementStrainStressResult {
  strain: number[]; // e.g. [eps_x] for 1D, [eps_xx, eps_yy, gamma_xy] for 2D, [eps_xx, eps_yy, eps_zz, gamma_yz, gamma_xz, gamma_xy] for 3D
  stress: number[]; // corresponding Cauchy stresses
  vonMisesStress: number;
  location?: { xi: number; eta?: number; zeta?: number };
}

export interface ElementVerificationVerdict {
  elementTypeId: string;
  status: ElementStatus;
  verdict: 'VERIFIED' | 'NOT_VERIFIED' | 'INVALID_FORMULATION' | 'NUMERICAL_FAILURE' | 'REFERENCE_MISMATCH';
  batteryResults: {
    shapeFunctionPass: boolean;
    jacobianPass: boolean;
    integrationPass: boolean;
    stiffnessPass: boolean;
    rigidBodyPass: boolean;
    constantStrainPass: boolean;
    patchTestPass: boolean;
    energyPass: boolean;
    scalingPass: boolean;
    symmetryPass: boolean;
    objectivityPass: boolean;
    referenceBenchmarkPass: boolean;
    negativeTestsPass: boolean;
    replayPass: boolean;
    adversarialPass: boolean;
  };
  metrics: {
    maxEquilibriumError: number;
    maxStrainEnergyError: number;
    rigidBodyStrainNorm: number;
    constantStrainRelError: number;
    patchTestRelError: number;
  };
  evidenceHash: string;
  timestamp: string;
}
