// SECP Industrial OS v2 — Physics Twin Core Types & Data Definitions

export type PhysicsDomain =
  | 'STRUCTURAL'
  | 'THERMAL'
  | 'FLUID'
  | 'CFD'
  | 'FEM'
  | 'MODAL'
  | 'BUCKLING'
  | 'FATIGUE'
  | 'CONTACT'
  | 'NONLINEAR'
  | 'COMPRESSIBLE_FLOW'
  | 'HEAT_TRANSFER'
  | 'TRANSIENT'
  | 'MULTIPHYSICS';

export type PhysicsStateStatus =
  | 'CONVERGED'
  | 'NOT_CONVERGED'
  | 'CONSERVATION_FAILURE'
  | 'INVALID'
  | 'VERIFICATION_FAILURE'
  | 'VALIDATION_FAILURE'
  | 'STALE'
  | 'OUT_OF_SYNC'
  | 'CONFLICT'
  | 'INCOMPLETE';

export type PhysicsFreshness = 'FRESH' | 'STALE' | 'UNKNOWN';
export type SynchronizationVerdict = 'SYNCHRONIZED' | 'OUT_OF_SYNC' | 'CONFLICT' | 'INVALID' | 'INCOMPLETE';
export type DifferentialVerdict = 'MATCH' | 'MISMATCH' | 'INCOMPLETE' | 'INVALID';

export interface SolverIdentity {
  solverId: string;
  solverVersion: string;
  buildId: string;
  compiler: string;
  platform: string;
  precision: 'SINGLE' | 'DOUBLE' | 'QUADRUPLE';
  parallelMode: 'SERIAL' | 'OPENMP' | 'MPI' | 'HYBRID';
}

export interface MaterialIdentityRef {
  materialId: string;
  materialRevision: string;
  materialQualification: string;
  temperatureState: number; // Kelvin
  materialModel: string;
}

export interface BoundaryConditionIdentity {
  boundaryId: string;
  type: 'INLET' | 'OUTLET' | 'WALL' | 'SYMMETRY' | 'PRESSURE_FARFIELD' | 'FIXED' | 'DISPLACEMENT' | 'HEAT_FLUX' | 'CONVECTION_BOUNDARY';
  location: string; // Surface/Face ID or region name
  value: number[];
  unit: string;
  function?: string;
  referenceFrame: string;
  timeDependence: 'CONSTANT' | 'TIME_VARYING' | 'HARMONIC' | 'TRANSIENT_TABLE';
  spatialDependence: 'UNIFORM' | 'PARABOLIC' | 'CUSTOM_FIELD';
}

export interface InitialConditionIdentity {
  field: string; // e.g. 'pressure', 'velocity', 'temperature', 'stress'
  value: number[];
  distribution: 'UNIFORM' | 'FIELD' | 'RESTART_FILE';
  unit: string;
  referenceFrame: string;
  timestamp: string;
}

export interface LoadIdentity {
  loadId: string;
  type: 'force' | 'pressure' | 'traction' | 'gravity' | 'moment' | 'temperature' | 'heatFlux' | 'massFlow' | 'velocity' | 'acceleration' | 'bodyForce';
  location: string;
  value: number[];
  unit: string;
  referenceFrame: string;
  timeDependence: string;
}

export interface ConstraintIdentity {
  constraintId: string;
  type: 'FIXED_SUPPORT' | 'PINNED' | 'ROLLER' | 'SLIDER' | 'SYMMETRY_PLANE' | 'MPC' | 'RIGID_BODY';
  location: string;
  degreesOfFreedom: boolean[]; // [Ux, Uy, Uz, Rx, Ry, Rz]
  value: number[];
  referenceFrame: string;
}

export interface FEMMeshIdentity {
  meshId: string;
  meshRevision: string;
  nodeCount: number;
  elementCount: number;
  elementTypes: string[];
  meshHash: string;
}

export interface CFDModelIdentity {
  fluidPropertiesHash: string;
  turbulenceModelHash: string;
  boundaryConditionHash: string;
  meshHash: string;
  solverHash: string;
  timeIntegrationHash: string;
  convergencePolicyHash: string;
}

export interface RANSIdentity {
  modelFamily: 'RANS';
  closureModel: 'SpalartAllmaras' | 'kEpsilon' | 'kOmega' | 'SSTkOmega' | 'RSM';
  wallTreatment: 'WALL_FUNCTIONS' | 'ENHANCED_WALL_TREATMENT' | 'LOW_REYNOLDS';
  nearWallModel: string;
  turbulenceParameters: Record<string, number>;
}

export interface SSTkOmegaIdentity {
  sstVariant: 'SST_2003' | 'SST_1994' | 'GEOMETRIC_SST';
  modelVersion: string;
  coefficientSet: Record<string, number>;
  limiters: string[];
  wallTreatment: string;
}

export interface CompressibleFlowIdentity {
  equationOfState: 'IDEAL_GAS' | 'REAL_GAS' | 'REDLICH_KWONG' | 'INCOMPRESSIBLE';
  energyEquation: boolean;
  machRegime: 'SUBSONIC' | 'TRANSONIC' | 'SUPERSONIC' | 'HYPERSONIC';
  pressureTreatment: string;
  densityModel: string;
  temperatureModel: string;
}

export interface HeatTransferIdentity {
  conduction: boolean;
  convection: boolean;
  radiation: boolean;
  sourceTerms: string[];
  thermalBoundaryConditions: BoundaryConditionIdentity[];
  thermalMaterialProperties: Record<string, number>;
}

export interface AdaptiveTimeSteppingPolicy {
  timeStepPolicy: 'CONSTANT' | 'COURANT_BASED' | 'ERROR_CONTROLLED';
  minimumDt: number;
  maximumDt: number;
  initialDt: number;
  growthFactor: number;
  reductionFactor: number;
  errorTolerance: number;
}

export interface TransientPhysicsIdentity {
  timeIntegrationScheme: 'EULER_EXPLICIT' | 'EULER_IMPLICIT' | 'CRANK_NICOLSON' | 'RUNGE_KUTTA_4' | 'NEWMARK';
  timeStep: number;
  adaptiveTimeStepPolicy: AdaptiveTimeSteppingPolicy;
  startTime: number;
  endTime: number;
  outputInterval: number;
  initialStateHash: string;
}

export interface MultiphysicsCoupling {
  couplingId: string;
  domains: PhysicsDomain[];
  couplingVariables: string[];
  couplingDirection: 'ONE_WAY' | 'TWO_WAY' | 'FULLY_COUPLED';
  couplingAlgorithm: 'GAUSS_SEIDEL' | 'NEWTON_RAPHSON' | 'PARTITIONED';
  couplingTolerance: number;
  iterationPolicy: string;
  exchangeFrequency: number;
}

export interface PhysicsResult {
  resultId: string;
  physicsTwinId: string;
  resultType: string;
  resultRevision: string;
  resultHash: string;
  inputHash: string;
  modelHash: string;
  solverHash: string;
  dataSummary: Record<string, number>;
  timestamp: string;
}

export interface PhysicsResiduals {
  initialResidual: number;
  finalResidual: number;
  residualNorm: number;
  relativeReduction: number;
  iterationCount: number;
  tolerance: number;
  residualHistory: number[];
  verdict: 'CONVERGED' | 'DIVERGED' | 'STAGNATED';
}

export interface ConservationSummary {
  massConservation: 'CONSERVED' | 'VIOLATED' | 'NOT_APPLICABLE';
  momentumConservation: 'CONSERVED' | 'VIOLATED' | 'NOT_APPLICABLE';
  energyConservation: 'CONSERVED' | 'VIOLATED' | 'NOT_APPLICABLE';
  chargeConservation: 'CONSERVED' | 'VIOLATED' | 'NOT_APPLICABLE';
  speciesConservation: 'CONSERVED' | 'VIOLATED' | 'NOT_APPLICABLE';
  overallConservation: 'CONSERVATION_OK' | 'CONSERVATION_FAILURE' | 'NOT_APPLICABLE';
  imbalanceNorms: Record<string, number>;
}

export interface PhysicsVerificationState {
  residuals: PhysicsResiduals;
  convergence: boolean;
  conservation: ConservationSummary;
  discretizationError: number;
  meshConvergence: boolean;
  solverConvergence: boolean;
  independentVerification: boolean;
  verdict: PhysicsStateStatus;
}

export interface PhysicsValidationState {
  experimentalReference?: string;
  benchmark?: string;
  measurement?: string;
  errorMetric: number; // e.g. RMS error
  uncertainty: number;
  validationRange: string;
  verdict: 'VALIDATED' | 'VALIDATION_FAILURE' | 'INCOMPLETE';
}

export interface PhysicsUncertaintyModel {
  parameter: string;
  distribution: 'UNIFORM' | 'GAUSSIAN' | 'LOGNORMAL' | 'WEIBULL';
  range: [number, number];
  confidence: number;
  source: string;
  method: string;
}

export interface PhysicsState {
  geometryState: { geometryTwinId: string; geometryHash: string; geometryRevision: string };
  materialState: MaterialIdentityRef;
  domainState: { domain: PhysicsDomain; subDomains: string[] };
  modelState: { governingEquations: string[]; constitutiveLaws: string[]; modelHash: string };
  boundaryState: { boundaries: BoundaryConditionIdentity[]; boundaryConditionHash: string };
  loadState: { loads: LoadIdentity[]; loadsHash: string };
  initialState: { initialConditions: InitialConditionIdentity[]; initialConditionsHash: string };
  constraintState: { constraints: ConstraintIdentity[]; constraintsHash: string };
  discretizationState: { mesh: FEMMeshIdentity; discretizationHash: string };
  solverState: { solverIdentity: SolverIdentity; solverConfigHash: string };
  timeState?: TransientPhysicsIdentity;
  resultState?: PhysicsResult;
  verificationState?: PhysicsVerificationState;
  validationState?: PhysicsValidationState;
  evidenceState: { evidenceId: string; evidenceHash: string };
}

export interface PhysicsTwin {
  physicsTwinId: string;
  subjectId: string;
  subjectType: string;
  geometryTwinId: string;
  physicsDomain: PhysicsDomain;
  physicsRevision: string;
  configurationId: string;
  variantId: string;
  modelId: string;
  modelVersion: string;
  solverId: string;
  solverVersion: string;
  state: PhysicsStateStatus;
  physicsState: PhysicsState;
  createdAt: string;
  updatedAt: string;
  inputHash: string;
  modelHash: string;
  resultHash: string;
  rootHash: string;
}

export interface PhysicsEvent {
  eventId: string;
  physicsTwinId: string;
  eventType: 'CREATED' | 'INPUT_MODIFIED' | 'SOLVED' | 'VERIFIED' | 'VALIDATED' | 'RECONSTRUCTED' | 'INVALIDATED';
  previousStateHash: string;
  newStateHash: string;
  timestamp: string;
  actor: string;
  source: string;
  evidenceId: string;
  eventHash: string;
}

export interface PhysicsProvenance {
  sourceGeometry: string;
  sourceMaterial: string;
  sourceConfiguration: string;
  sourceMesh: string;
  sourceModel: string;
  sourceSolver: string;
  sourceMeasurements: string;
}

export interface PhysicsEvidence {
  evidenceId: string;
  physicsTwinId: string;
  inputHash: string;
  modelHash: string;
  solverHash: string;
  resultHash: string;
  verificationHash: string;
  validationHash: string;
  rootHash: string;
  provenance: PhysicsProvenance;
  timestamp: string;
}
