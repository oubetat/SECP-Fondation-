export type PhysicsDomain =
  | 'MECHANICS'
  | 'STRUCTURAL'
  | 'THERMAL'
  | 'FLUID'
  | 'HEAT_TRANSFER'
  | 'ELECTROMAGNETIC'
  | 'ACOUSTIC'
  | 'VIBRATION'
  | 'MULTIPHASE'
  | 'COMBUSTION'
  | 'MATERIAL_PHYSICS'
  | 'THERMO_MECHANICAL'
  | 'FLUID_STRUCTURE_INTERACTION'
  | 'MULTIPHYSICS';

export type QuantityType =
  | 'FORCE'
  | 'MASS'
  | 'LENGTH'
  | 'TIME'
  | 'TEMPERATURE'
  | 'PRESSURE'
  | 'ENERGY'
  | 'POWER'
  | 'VELOCITY'
  | 'ACCELERATION'
  | 'DENSITY'
  | 'VISCOSITY'
  | 'CONDUCTIVITY'
  | 'STRESS'
  | 'STRAIN'
  | 'HEAT_FLUX'
  | 'DIMENSIONLESS';

export interface DimensionalFormula {
  M: number; // Mass [kg]
  L: number; // Length [m]
  T: number; // Time [s]
  Theta: number; // Temperature [K]
  I?: number; // Electric Current [A]
  N?: number; // Amount of substance [mol]
  J?: number; // Luminous intensity [cd]
}

export interface PhysicsToleranceProfile {
  profileId: string;
  absoluteTolerance: number;
  relativeTolerance: number;
  residualTolerance: number;
}

export interface PhysicsVariable {
  variableId: string;
  name: string;
  symbol: string;
  quantityType: QuantityType;
  unit: string;
  dimension: DimensionalFormula;
  domain: PhysicsDomain;
  range?: [number, number];
  fieldType: 'SCALAR' | 'VECTOR' | 'TENSOR';
  tensorRank?: number;
}

export interface GoverningEquation {
  equationId: string;
  equationName: string;
  domain: PhysicsDomain;
  form: string; // Symbolic e.g., "F = m * a" or "\nabla \cdot u = 0"
  variables: string[]; // Variable symbols/IDs
  units: Record<string, string>;
  assumptions: string[];
  validityDomain: string;
  reference: string;
  version: string;
}

export interface PhysicsContext {
  contextId: string;
  domain: PhysicsDomain;
  geometryHash: string;
  meshHash: string;
  materialStateHash: string;
  boundaryConditionHash: string;
  initialConditionHash: string;
  solverConfigurationHash: string;
  coordinateSystem: string;
  units: string; // e.g. 'SI', 'CGS', 'Imperial'
  timeReference: string;
  referenceFrame: string;
  physicsModel: string;
  contextHash?: string;
}

export interface PhysicsProblemDefinition {
  problemId: string;
  physicsDomain: PhysicsDomain;
  governingEquations: string[];
  unknowns: string[];
  parameters: Record<string, number>;
  initialConditions: Record<string, any>;
  boundaryConditions: Record<string, any>;
  constraints: string[];
  referenceFrame: string;
  units: string;
  timeDomain: 'STEADY' | 'TRANSIENT';
  spatialDomain: '1D' | '2D' | '3D';
}

export type HypothesisStatus =
  | 'PROPOSED'
  | 'SUPPORTED'
  | 'REFUTED'
  | 'UNRESOLVED'
  | 'VERIFIED';

export interface PhysicsHypothesis {
  hypothesisId: string;
  statement: string;
  domain: PhysicsDomain;
  contextHash: string;
  assumptions: string[];
  supportingEvidence: string[];
  contradictingEvidence: string[];
  confidence: number;
  status: HypothesisStatus;
}

export interface PhysicsPrediction {
  predictionId: string;
  variable: string;
  predictedValue: number;
  unit: string;
  uncertainty: number;
  confidence: number;
  contextHash: string;
  modelVersion: string;
}

export type ConservationType = 'MASS' | 'MOMENTUM' | 'ENERGY' | 'CHARGE' | 'SPECIES';

export type ConservationVerdict =
  | 'CONSERVATION_PASS'
  | 'CONSERVATION_FAILURE'
  | 'INSUFFICIENT_EVIDENCE'
  | 'INVALID_REFERENCE';

export interface ConservationResult {
  type: ConservationType;
  inputFlux: number;
  outputFlux: number;
  sourceTerm: number;
  absoluteError: number;
  relativeError: number;
  tolerance: number;
  verdict: ConservationVerdict;
  details: string;
}

export type PhysicsBoundsVerdict =
  | 'WITHIN_PHYSICAL_BOUNDS'
  | 'BOUND_VIOLATION'
  | 'UNKNOWN_BOUND'
  | 'INSUFFICIENT_EVIDENCE';

export interface PhysicsBoundsRecord {
  recordId: string;
  variableId: string;
  observedValue: number;
  unit: string;
  lowerLimit?: number;
  upperLimit?: number;
  verdict: PhysicsBoundsVerdict;
  reasoning: string;
}

export interface PhysicsResidual {
  residualId: string;
  predictionId: string;
  referenceType: 'ANALYTICAL' | 'NUMERICAL_SOLVER' | 'EXPERIMENTAL';
  referenceValue: number;
  predictedValue: number;
  absoluteError: number;
  relativeError: number;
  rmse?: number;
  normalizedResidual: number;
  verdict: 'MATCH_PASS' | 'RESIDUAL_EXCEEDED' | 'INVALID_COMPARISON';
}

export interface PhysicsAnomalyRecord {
  anomalyId: string;
  contextHash: string;
  fieldHash: string;
  detectorVersion: string;
  metric: string;
  threshold: number;
  observedValue: number;
  verdict: 'ANOMALY_DETECTED' | 'NORMAL' | 'SUSPECTED' | 'PHYSICS_VIOLATION';
  details: string;
  evidenceHash: string;
}

export interface PhysicsCausalHypothesis {
  hypothesisId: string;
  cause: string;
  effect: string;
  mechanism: string;
  supportingEvidence: string[];
  alternativeExplanations: string[];
  status: HypothesisStatus;
  causalityVerified: boolean;
}

export type PhysicsReasoningVerdict =
  | 'VERIFIED'
  | 'NOT_VERIFIED'
  | 'CONVERGED'
  | 'NOT_CONVERGED'
  | 'CONSERVATION_FAILURE'
  | 'PHYSICS_VIOLATION'
  | 'OUT_OF_DOMAIN'
  | 'ASSUMPTION_INVALID'
  | 'INSUFFICIENT_EVIDENCE'
  | 'INVALID'
  | 'UNSUPPORTED_PHYSICS_CLAIM';

export interface PhysicsReasoningEvidence {
  evidenceId: string;
  claim: string;
  physicsContextHash: string;
  modelId: string;
  modelVersion: string;
  inputs: Record<string, any>;
  assumptions: string[];
  equations: string[];
  predictions: PhysicsPrediction[];
  references: Record<string, any>;
  residuals: PhysicsResidual[];
  constraints: string[];
  verdict: PhysicsReasoningVerdict;
  evidenceHash: string;
  timestamp: string;
}

export interface PhysicsModelSelectionEvidence {
  candidateModels: string[];
  selectionCriteria: string[];
  AIRecommendation: string;
  engineeringConstraints: string[];
  finalDecision: string;
  evidenceHash: string;
}

export interface PhysicsScenario {
  scenarioId: string;
  scenarioHash: string;
  description: string;
  parameters: Record<string, number>;
  boundaryConditions: Record<string, any>;
  materialId: string;
  geometryId: string;
  counterfactualType: 'PARAMETRIC_VARIATION' | 'MATERIAL_CHANGE' | 'BOUNDARY_CHANGE' | 'HYPOTHETICAL';
}
