/**
 * SECP Industrial OS - PATCH-310 AI Simulation Setup Types
 * Defines data structures for Engineering Simulation Cases, Physics Models,
 * Boundary Conditions, Load Types, Coordinate Systems, Mesh Configurations,
 * Assumption Registry, Setup Validation Matrix, Execution Packages, and Digital Thread.
 */

export type SimulationType =
  | 'STRUCTURAL_FEM'
  | 'CFD_FLUID'
  | 'THERMAL_HEAT'
  | 'TRANSIENT'
  | 'MULTIPHYSICS'
  | 'FSI_COUPLED'
  | 'FATIGUE_LIFE';

export type SimulationCaseStatus =
  | 'DRAFT'
  | 'INCOMPLETE'
  | 'INVALID'
  | 'READY_FOR_REVIEW'
  | 'APPROVED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED';

export type RequirementSource =
  | 'USER'
  | 'STANDARD'
  | 'PROJECT'
  | 'ENGINEERING_RULE'
  | 'AI_PROPOSAL';

export type LoadType =
  | 'FORCE'
  | 'PRESSURE'
  | 'MOMENT'
  | 'GRAVITY'
  | 'TEMPERATURE'
  | 'VELOCITY_INLET'
  | 'PRESSURE_OUTLET';

export type BoundaryConditionType =
  | 'FIXED_SUPPORT'
  | 'PINNED_SUPPORT'
  | 'ROLLER_SUPPORT'
  | 'DISPLACEMENT'
  | 'WALL_NO_SLIP'
  | 'SYMMETRY'
  | 'CONVECTION_COOLING';

export interface GeometryEntityRef {
  refId: string;
  entityType: 'FACE' | 'EDGE' | 'VERTEX' | 'BODY' | 'REGION';
  entityName: string;
  isValid: boolean;
}

export interface SimulationAssumption {
  assumptionId: string;
  description: string;
  source: RequirementSource;
  parameterName: string;
  proposedValue: number | string;
  unit: string;
  isApproved: boolean;
  approvedBy?: string;
  timestamp: number;
}

export interface BoundaryCondition {
  bcId: string;
  type: BoundaryConditionType;
  name: string;
  targetEntity: GeometryEntityRef;
  coordinateSystem: string;
  parameters: Record<string, number | string>;
}

export interface AppliedLoad {
  loadId: string;
  type: LoadType;
  name: string;
  targetEntity: GeometryEntityRef;
  magnitude: number;
  unit: string;
  directionVector: [number, number, number];
  coordinateSystem: string;
}

export interface MeshConfiguration {
  meshId: string;
  elementType: 'TETRAHEDRAL_HEXA' | 'TRIANGULAR_SURFACE' | 'POLYHEDRAL_FLUID';
  globalSizeMm: number;
  localRefinementRegion?: string;
  inflationLayers?: number;
  targetQualityIndex: number; // 0 to 1
  meshConvergencePlan: 'SINGLE_MESH' | 'COARSE_MEDIUM_FINE_SUITE';
}

export interface SolverParameters {
  solverId: string;
  solverName: string;
  version: string;
  discretizationOrder: number;
  linearSolver: string;
  convergenceTolerance: number;
  maxIterations: number;
  timeStepSeconds?: number;
  endTimeSeconds?: number;
}

export interface OutputRequest {
  outputId: string;
  name: string;
  field: 'STRESS_VON_MISES' | 'DISPLACEMENT' | 'FLUID_VELOCITY' | 'TEMPERATURE' | 'SAFETY_FACTOR';
  unit: string;
}

export interface EngineeringSimulationCase {
  caseId: string;
  projectId: string;
  cadRevisionId: string;
  name: string;
  description: string;
  simulationType: SimulationType;
  materialId: string;
  materialName: string;
  materialVersion: string;
  assumptions: SimulationAssumption[];
  boundaryConditions: BoundaryCondition[];
  loads: AppliedLoad[];
  meshConfig: MeshConfiguration;
  solverParams: SolverParameters;
  outputs: OutputRequest[];
  status: SimulationCaseStatus;
  version: number;
  isApprovedLock: boolean;
  missingDataFields: string[];
  validationErrors: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SimulationExecutionPackage {
  packageId: string;
  caseId: string;
  cadRevisionId: string;
  inputHash: string;
  caseVersion: number;
  solverName: string;
  solverVersion: string;
  executionPayload: string;
  timestamp: number;
}

export interface AISimulationSetupSession {
  sessionId: string;
  projectId: string;
  baseCadRevisionId: string;
  cases: EngineeringSimulationCase[];
  selectedCaseId?: string;
  createdAt: number;
  updatedAt: number;
}
