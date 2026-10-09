/**
 * SECP Industrial OS v2 — Initial Condition Types
 * PATCH-046: Initial Condition Framework
 */

import { Quantity } from '../units/Quantity';
import { PhysicsDomain } from '../PhysicsTypes';
import { BoundaryConditionSet } from '../boundary/BoundaryTypes';

export type InitialTargetKind = 
  | 'DOMAIN' 
  | 'REGION' 
  | 'VOLUME' 
  | 'FACE' 
  | 'NODE_SET' 
  | 'ELEMENT_SET' 
  | 'MATERIAL_REGION';

export interface InitialTarget {
  targetId: string;
  kind: InitialTargetKind;
  selector?: string;
}

export type CoordinateSystemType = 
  | 'GLOBAL_CARTESIAN' 
  | 'LOCAL_CARTESIAN' 
  | 'CYLINDRICAL' 
  | 'SPHERICAL' 
  | 'BODY' 
  | 'CUSTOM';

export interface CoordinateSystemReference {
  id: string;
  type: CoordinateSystemType;
  origin?: [number, number, number];
  orientation?: Record<string, number>;
}

export type ValueRank = 'SCALAR' | 'VECTOR' | 'TENSOR';

export interface ScalarConstantValue {
  rank: 'SCALAR';
  value: Quantity;
}

export interface VectorConstantValue {
  rank: 'VECTOR';
  components: [Quantity, Quantity, Quantity]; // [x, y, z] or [u, v, w]
  componentNames?: ['x', 'y', 'z'] | ['u', 'v', 'w'];
  coordinateSystem: CoordinateSystemReference;
}

export interface TensorConstantValue {
  rank: 'TENSOR';
  tensorType: 'SYMMETRIC_3X3' | 'GENERAL_3X3';
  // Voigt components: xx, yy, zz, xy, yz, zx for symmetric
  components: {
    xx: Quantity;
    yy: Quantity;
    zz: Quantity;
    xy: Quantity;
    yz: Quantity;
    zx: Quantity;
    yx?: Quantity;
    zy?: Quantity;
    xz?: Quantity;
  };
  coordinateSystem: CoordinateSystemReference;
}

export interface TableInitialValue {
  rank: 'SCALAR' | 'VECTOR';
  type: 'TABLE';
  independentVariable: string;
  points: Array<{ input: Quantity; output: Quantity | [Quantity, Quantity, Quantity] }>;
  interpolation: 'LINEAR' | 'SPLINE' | 'STEP';
}

export interface FunctionInitialValue {
  rank: 'SCALAR' | 'VECTOR' | 'TENSOR';
  type: 'FUNCTION';
  expression: string;
  parameters: Record<string, Quantity>;
  coordinateSystem?: CoordinateSystemReference;
}

export interface FieldInitialValue {
  rank: 'SCALAR' | 'VECTOR' | 'TENSOR';
  type: 'FIELD';
  fieldType: 'UNIFORM' | 'SPATIAL_ANALYTICAL' | 'DISCRETE_MESH_MAP';
  fieldDescriptor: string;
  referenceMeshId?: string;
}

export type InitialValueModel = 
  | ScalarConstantValue 
  | VectorConstantValue 
  | TensorConstantValue 
  | TableInitialValue 
  | FunctionInitialValue 
  | FieldInitialValue;

export type CFD_ICType = 
  | 'INITIAL_VELOCITY' 
  | 'INITIAL_PRESSURE' 
  | 'INITIAL_DENSITY' 
  | 'INITIAL_TEMPERATURE' 
  | 'INITIAL_MASS_FRACTION';

export type STRUCTURAL_ICType = 
  | 'INITIAL_DISPLACEMENT' 
  | 'INITIAL_VELOCITY' 
  | 'INITIAL_ACCELERATION' 
  | 'INITIAL_STRESS' 
  | 'INITIAL_STRAIN';

export type THERMAL_ICType = 
  | 'INITIAL_TEMPERATURE' 
  | 'INITIAL_THERMAL_STATE';

export type InitialConditionType = CFD_ICType | STRUCTURAL_ICType | THERMAL_ICType | 'OTHER';

export interface CanonicalInitialCondition {
  initialConditionId: string;
  type: InitialConditionType;
  target: InitialTarget;
  physicsDomain: PhysicsDomain;
  value: InitialValueModel;
  revision: string;
  provenanceId?: string;
  metadata?: Record<string, any>;
}

export interface InitialState {
  stateId: string;
  modelId: string;
  physicsDomain: PhysicsDomain;
  conditions: CanonicalInitialCondition[];
  coordinateReference?: CoordinateSystemReference;
  unitsPolicy?: string;
  revision: string;
  provenanceId?: string;
  canonicalHash?: string;
}

export type InitialConditionSet = InitialState;

/**
 * Clean container combining Initial Conditions and Boundary Conditions
 * while preserving strict semantic separation.
 */
export interface SimulationConditionSet {
  simulationConditionSetId: string;
  modelId: string;
  physicsDomain: PhysicsDomain;
  initialState: InitialState;
  boundaryConditionSet: BoundaryConditionSet;
  revision: string;
  provenanceId?: string;
  canonicalHash?: string;
}
