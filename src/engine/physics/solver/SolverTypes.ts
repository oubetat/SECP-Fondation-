/**
 * SECP Industrial OS v2 — Solver Types
 * PATCH-048: Solver Contract
 */

export enum PhysicsDomain {
  CFD = "CFD",
  FEM = "FEM",
  THERMAL = "THERMAL",
  MULTIPHYSICS = "MULTIPHYSICS",
  KINEMATICS = "KINEMATICS"
}

export interface SolverCapability {
  capabilityId: string;
  description: string;
  supported: boolean;
  verified: boolean;
}

export type ReproducibilityMode = 
  | "DETERMINISTIC" 
  | "SEEDED" 
  | "ENVIRONMENT_DEPENDENT" 
  | "NON_DETERMINISTIC";

export interface ReproducibilityPolicy {
  mode: ReproducibilityMode;
  seed?: number | string;
  requiredForQualification: boolean;
  nonDeterminismReason?: string;
}

export interface NumericalConfiguration {
  maxIterations?: number;
  tolerance?: number;
  relaxation?: number;
  timeStep?: number;
  linearSolver?: string;
  nonlinearSolver?: string;
  details?: Record<string, unknown>;
}

export interface ConservationRequirement {
  quantity: "MASS" | "MOMENTUM" | "ENERGY" | "CHARGE" | string;
  tolerance: number;
  relative?: boolean;
  required: boolean;
}

export interface OutputDefinition {
  fieldId: string;
  name: string;
  physicalQuantity: string;
  unit: string;
  location: "NODE" | "ELEMENT" | "FACE" | "GLOBAL";
  required: boolean;
  precision?: number;
}

export type RequirementLevel = "REQUIRED" | "OPTIONAL" | "NONE";

export interface SolverContract {
  solverId: string;
  solverVersion: string;
  physicsDomain: PhysicsDomain;
  problemType: string;
  supportedDimensions: ("1D" | "2D" | "3D")[];
  supportedUnits: string[];
  requiredInputs: string[];
  optionalInputs?: string[];
  meshRequirement: RequirementLevel;
  boundaryConditionRequirement: RequirementLevel;
  initialConditionRequirement: RequirementLevel;
  materialRequirement: RequirementLevel;
  numericalMethod: string;
  linearSolver?: string;
  nonlinearSolver?: string;
  convergenceCriteria?: {
    tolerance: number;
    maxIterations: number;
    metric: string;
  };
  stabilityCriteria?: string;
  conservationRequirements?: ConservationRequirement[];
  capabilities: SolverCapability[];
  determinismPolicy: string;
  reproducibilityPolicy: ReproducibilityPolicy;
  outputDefinitions: OutputDefinition[];
  evidenceRequirements?: string[];
}
