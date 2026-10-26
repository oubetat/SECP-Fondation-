/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Boundary Condition Core Types
 */

export enum PhysicsDomain {
  INCOMPRESSIBLE_NAVIER_STOKES = 'INCOMPRESSIBLE_NAVIER_STOKES',
  COMPRESSIBLE_NAVIER_STOKES = 'COMPRESSIBLE_NAVIER_STOKES',
  HEAT_TRANSFER = 'HEAT_TRANSFER',
  MULTIPHYSICS = 'MULTIPHYSICS'
}

export enum BoundaryFieldType {
  VELOCITY = 'VELOCITY',
  PRESSURE = 'PRESSURE',
  TEMPERATURE = 'TEMPERATURE',
  ENERGY = 'ENERGY',
  TURBULENCE_K = 'TURBULENCE_K',
  TURBULENCE_OMEGA = 'TURBULENCE_OMEGA',
  SPECIES = 'SPECIES'
}

export enum BoundaryConditionType {
  VELOCITY_INLET = 'VELOCITY_INLET',
  PRESSURE_OUTLET = 'PRESSURE_OUTLET',
  PRESSURE_INLET = 'PRESSURE_INLET',
  FIXED_VELOCITY = 'FIXED_VELOCITY',
  FIXED_PRESSURE = 'FIXED_PRESSURE',
  FIXED_TEMPERATURE = 'FIXED_TEMPERATURE',
  NO_SLIP_WALL = 'NO_SLIP_WALL',
  SLIP_WALL = 'SLIP_WALL',
  SYMMETRY = 'SYMMETRY',
  PERIODIC = 'PERIODIC',
  ENERGY_CONSTRAINT = 'ENERGY_CONSTRAINT',
  ADIABATIC = 'ADIABATIC',
  FIXED_HEAT_FLUX = 'FIXED_HEAT_FLUX'
}

export enum WallMotionType {
  STATIC = 'STATIC',
  MOVING = 'MOVING',
  ROTATING = 'ROTATING'
}

export enum VelocityBehaviorType {
  NO_SLIP = 'NO_SLIP',
  SLIP = 'SLIP',
  SPECIFIED_SHEAR = 'SPECIFIED_SHEAR'
}

export enum ThermalBehaviorType {
  ADIABATIC = 'ADIABATIC',
  FIXED_TEMPERATURE = 'FIXED_TEMPERATURE',
  FIXED_HEAT_FLUX = 'FIXED_HEAT_FLUX',
  CONVECTION = 'CONVECTION'
}

export enum BoundaryConditionVerdict {
  VALID = 'VALID',
  INVALID = 'INVALID',
  UNVERIFIED = 'UNVERIFIED'
}

export enum BoundaryDiagnosticCode {
  UNASSIGNED_BOUNDARY_FACE = 'UNASSIGNED_BOUNDARY_FACE',
  DUPLICATE_BOUNDARY_CONDITION = 'DUPLICATE_BOUNDARY_CONDITION',
  OVERCONSTRAINED_BOUNDARY = 'OVERCONSTRAINED_BOUNDARY',
  UNDERCONSTRAINED_BOUNDARY_SYSTEM = 'UNDERCONSTRAINED_BOUNDARY_SYSTEM',
  PRESSURE_REFERENCE_MISSING = 'PRESSURE_REFERENCE_MISSING',
  INVALID_BOUNDARY_PATCH = 'INVALID_BOUNDARY_PATCH',
  INVALID_BOUNDARY_NORMAL = 'INVALID_BOUNDARY_NORMAL',
  INVALID_BOUNDARY_CONDITION = 'INVALID_BOUNDARY_CONDITION',
  INAPPLICABLE_CONDITION = 'INAPPLICABLE_CONDITION',
  INCOMPATIBLE_FIELD_TYPE = 'INCOMPATIBLE_FIELD_TYPE'
}

export enum BoundaryType {
  INLET = 'INLET',
  OUTLET = 'OUTLET',
  WALL = 'WALL',
  SYMMETRY = 'SYMMETRY',
  PERIODIC = 'PERIODIC',
  UNKNOWN = 'UNKNOWN',
  VELOCITY_INLET = 'VELOCITY_INLET',
  PRESSURE_OUTLET = 'PRESSURE_OUTLET',
  PRESSURE_INLET = 'PRESSURE_INLET',
  FIXED_VELOCITY = 'FIXED_VELOCITY',
  FIXED_PRESSURE = 'FIXED_PRESSURE',
  NO_SLIP_WALL = 'NO_SLIP_WALL',
  SLIP_WALL = 'SLIP_WALL',
  FARFIELD = 'FARFIELD',
  INTERFACE = 'INTERFACE'
}

export interface BoundaryCondition {
  patchId: string;
  type: BoundaryType | BoundaryConditionType | string;
  velocity?: { x: number; y: number; z: number };
  pressure?: number;
  temperature?: number;
  parameters?: Record<string, any>;
}

export interface BoundaryValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface BoundaryConditionIdentity {
  readonly boundaryConditionId?: string;
  readonly boundaryId?: string; // Legacy support
  readonly boundaryPatchId: string;
  readonly conditionType: BoundaryConditionType;
  readonly fieldType: BoundaryFieldType;
  readonly parameters: Record<string, any>;
}

export interface BoundaryPatchIdentity {
  readonly patchId: string;
  readonly name: string;
  readonly faceIds: readonly number[];
  readonly area: number;
  readonly outwardNormal: Vector3D;
}

export type Vector3D = [number, number, number];

