/**
 * SECP Industrial OS v2 — Boundary Condition Types
 * PATCH-045: Boundary Condition Framework
 */

import { Quantity } from '../units/Quantity';
import { PhysicsDomain } from '../PhysicsTypes';

export type BoundaryTargetKind = 'FACE' | 'EDGE' | 'VERTEX' | 'REGION' | 'PATCH' | 'SURFACE' | 'VOLUME_INTERFACE';

export interface BoundaryTarget {
  targetId: string;
  kind: BoundaryTargetKind;
  selector?: string; // Optional topological selector
}

export type BoundaryValueModelType = 'CONSTANT' | 'TABLE' | 'FUNCTION';

export interface ConstantBoundaryValue {
  type: 'CONSTANT';
  value: Quantity;
}

export interface TableBoundaryValue {
  type: 'TABLE';
  independentVariable: string;
  points: Array<{ input: Quantity; output: Quantity }>;
  interpolation: 'LINEAR' | 'SPLINE' | 'STEP';
}

export interface FunctionBoundaryValue {
  type: 'FUNCTION';
  expression: string;
  parameters: Record<string, Quantity>;
}

export type BoundaryValueModel = ConstantBoundaryValue | TableBoundaryValue | FunctionBoundaryValue;

export type CFD_BCType = 'VELOCITY_INLET' | 'PRESSURE_INLET' | 'MASS_FLOW_INLET' | 'PRESSURE_OUTLET' | 'WALL' | 'SYMMETRY' | 'PERIODIC';
export type STRUCTURAL_BCType = 'FIXED_SUPPORT' | 'PRESCRIBED_DISPLACEMENT' | 'PRESCRIBED_VELOCITY' | 'FORCE' | 'PRESSURE_LOAD' | 'TRACTION';
export type THERMAL_BCType = 'PRESCRIBED_TEMPERATURE' | 'HEAT_FLUX' | 'CONVECTION' | 'RADIATION';

export type BoundaryConditionType = CFD_BCType | STRUCTURAL_BCType | THERMAL_BCType | 'OTHER';

export interface CanonicalBoundaryCondition {
  boundaryConditionId: string;
  type: BoundaryConditionType;
  target: BoundaryTarget;
  physicsDomain: PhysicsDomain;
  value?: BoundaryValueModel;
  revision: string;
  provenanceId?: string;
  metadata?: Record<string, any>;
}

export interface BoundaryConditionSet {
  setId: string;
  modelId: string;
  physicsDomain: PhysicsDomain;
  boundaryConditions: CanonicalBoundaryCondition[];
  revision: string;
  provenanceId?: string;
  canonicalHash?: string;
}
