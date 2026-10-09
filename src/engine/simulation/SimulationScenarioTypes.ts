/**
 * SECP Industrial OS — EPC-008: Simulation Scenario Registry Types
 */

export enum ScenarioLifecycle {
  DRAFT = 'DRAFT',
  VALIDATED = 'VALIDATED',
  FROZEN = 'FROZEN',
  EXECUTED = 'EXECUTED',
  SUPERSEDED = 'SUPERSEDED'
}

export enum ParameterType {
  NUMBER = 'number',
  INTEGER = 'integer',
  BOOLEAN = 'boolean',
  STRING = 'string',
  VECTOR = 'vector'
}

export interface EngineeringParameter {
  id: string;
  name: string;
  value: any;
  unit?: string;
  type: ParameterType;
  source?: string;
}

export interface LoadCase {
  id: string;
  type: string; // e.g., 'POINT_LOAD', 'PRESSURE', 'TORQUE'
  magnitude: number;
  unit: string;
  direction?: [number, number, number];
  reference: string; // e.g., 'Surface_001'
}

export interface BoundaryCondition {
  id: string;
  type: string; // e.g., 'FIXED', 'SLIDER', 'HINGE'
  value: number;
  unit: string;
  location: string;
  reference: string;
}

export interface GeometryReference {
  modelId: string;
  revision: string;
  hash: string;
}

export interface MaterialReference {
  materialId: string;
  revision: string;
  propertiesHash: string;
}

export interface MeshReference {
  meshId: string;
  revision: string;
  elementType: string;
  elementCount: number;
  hash: string;
}

export interface SolverReference {
  solverId: string;
  version: string;
  configurationHash: string;
  settings: Record<string, any>;
}

export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  domain: string; // e.g., 'DRONE', 'ROBOT', 'EVTOL'
  status: ScenarioLifecycle;
  geometry: GeometryReference & { geometryHash: string };
  material: MaterialReference;
  loads: LoadCase[];
  boundaryConditions: BoundaryCondition[];
  solver: SolverReference;
  mesh: MeshReference;
  parameters: EngineeringParameter[];
  revision: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ExecutionBaseline {
  executionId: string;
  scenarioId: string;
  timestamp: string;
  snapshot: {
    geometry: GeometryReference & { geometryHash: string };
    material: MaterialReference;
    loads: LoadCase[];
    boundaryConditions: BoundaryCondition[];
    solver: SolverReference;
    mesh: MeshReference;
    parameters: EngineeringParameter[];
    revision: string;
  };
}

export enum SimulationScenarioError {
  SCENARIO_INVALID = 'SCENARIO_INVALID',
  MISSING_GEOMETRY = 'MISSING_GEOMETRY',
  MISSING_MATERIAL = 'MISSING_MATERIAL',
  MISSING_SOLVER = 'MISSING_SOLVER',
  MISSING_MESH = 'MISSING_MESH',
  MISSING_BOUNDARY_CONDITION = 'MISSING_BOUNDARY_CONDITION',
  MISSING_LOAD = 'MISSING_LOAD',
  MISSING_PARAMETER = 'MISSING_PARAMETER',
  INVALID_REVISION = 'INVALID_REVISION',
  FROZEN_MODIFICATION_DENIED = 'FROZEN_MODIFICATION_DENIED',
  REFERENTIAL_INTEGRITY_VIOLATION = 'REFERENTIAL_INTEGRITY_VIOLATION'
}

export interface ScenarioValidationResult {
  isValid: boolean;
  errors: SimulationScenarioError[];
}
