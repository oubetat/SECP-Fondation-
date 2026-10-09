import { PropertyProvenance } from "../types";

export enum UncertaintyType {
  TYPE_A = "TYPE_A",
  TYPE_B = "TYPE_B"
}

export enum UncertaintySourceType {
  INSTRUMENT = "INSTRUMENT",
  CALIBRATION = "CALIBRATION",
  REPEATABILITY = "REPEATABILITY",
  REPRODUCIBILITY = "REPRODUCIBILITY",
  SAMPLING = "SAMPLING",
  ENVIRONMENT = "ENVIRONMENT",
  DATA_REDUCTION = "DATA_REDUCTION",
  MODEL = "MODEL",
  PARAMETER = "PARAMETER",
  MATERIAL_VARIABILITY = "MATERIAL_VARIABILITY",
  PROCESS_VARIABILITY = "PROCESS_VARIABILITY",
  OTHER = "OTHER"
}

export enum UncertaintyDistributionType {
  NORMAL = "NORMAL",
  LOGNORMAL = "LOGNORMAL",
  UNIFORM = "UNIFORM",
  TRIANGULAR = "TRIANGULAR",
  EMPIRICAL = "EMPIRICAL",
  DISCRETE = "DISCRETE",
  USER_DEFINED = "USER_DEFINED"
}

export interface UncertaintyDistribution {
  type: UncertaintyDistributionType;
  parameters: Record<string, number>;
  empiricalObservations?: number[];
  provenance: PropertyProvenance;
  sampleCount?: number;
}

export interface CovarianceMatrix {
  dimensions: number;
  labels: string[];
  matrix: number[][]; // Must be symmetric, positive semi-definite
  provenance: PropertyProvenance;
}

export interface UncertaintyBudgetComponent {
  sourceId: string;
  sourceType: UncertaintySourceType;
  description: string;
  value: number; // standard uncertainty u_i
  unit: string;
  distributionType: UncertaintyDistributionType;
  sensitivityCoefficient: number; // c_i = \partial f / \partial x_i
  degreesOfFreedom?: number;
}

export interface UncertaintyBudget {
  budgetId: string;
  measurand: string;
  unit: string;
  components: UncertaintyBudgetComponent[];
  combinedUncertainty: number; // u_c
  expandedUncertainty: number; // U
  coverageFactor: number; // k
  coverageProbability: number; // p (e.g. 0.95)
  revision: number;
  timestamp: string;
}

export interface UncertaintyAwareDecisionRule {
  ruleId: string;
  name: string;
  acceptanceLimit: number;
  rejectionLimit: number;
  guardBand: number;
  decisionRuleType: "SIMPLE_ACCEPTANCE" | "GUARD_BAND_ACCEPTANCE" | "STRINGENT_ACCEPTANCE";
}

export interface MaterialUncertaintyRecord {
  uncertaintyId: string;
  quantityId: string;
  value: number; // nominal
  unit: string;
  uncertaintyType: UncertaintyType;
  distribution: UncertaintyDistribution;
  standardUncertainty: number; // u_c
  expandedUncertainty?: number; // U
  coverageFactor?: number; // k
  coverageProbability?: number; // probability (e.g. 95%)
  confidenceLevel?: number; // statistical confidence %
  source: string;
  method: string;
  validityDomain: { minTemp: number; maxTemp: number };
  correlationReferences?: string[];
  covarianceMatrix?: CovarianceMatrix;
  provenance: PropertyProvenance;
  revision: number;
  timestamp: string;
  fingerprint: string;
}
