/**
 * SECP Industrial OS v2 — Material Model Types
 * PATCH-044: Material Model
 */

import { Quantity } from '../units/Quantity';

export interface MaterialIdentity {
  materialId: string;
  canonicalName: string;
  materialFamily: string;
  grade: string;
  standard?: string;
  revision: string;
  provenanceId?: string;
}

export interface MaterialState {
  temperature?: Quantity; // Theta
  pressure?: Quantity;    // M L^-1 T^-2
  strainRate?: Quantity;  // T^-1
  heatTreatment?: string;
  manufacturingState?: string;
  environmentalCondition?: string;
}

export type PropertyStatus = 'VALIDATED' | 'ESTIMATED' | 'PROPOSED' | 'UNPROVEN';
export type PropertyModelType = 'CONSTANT' | 'TABLE' | 'FUNCTION';

export interface ConstantPropertyModel {
  type: 'CONSTANT';
  value: Quantity;
}

export interface TablePropertyModel {
  type: 'TABLE';
  independentVariable: string; // e.g. 'TEMPERATURE'
  points: Array<{ input: Quantity; output: Quantity }>;
  interpolation: 'LINEAR' | 'SPLINE' | 'STEP';
}

export interface FunctionPropertyModel {
  type: 'FUNCTION';
  expression: string; // placeholder for functional form
  parameters: Record<string, Quantity>;
}

export type MaterialPropertyModel = ConstantPropertyModel | TablePropertyModel | FunctionPropertyModel;

export interface MaterialProperty {
  propertyId: string;
  model: MaterialPropertyModel;
  propertyType: 'SCALAR' | 'TENSOR_ISOTROPIC' | 'TENSOR_ORTHOTROPIC' | 'TENSOR_ANISOTROPIC';
  source?: string;
  provenance?: string;
  validityRange?: {
    minState?: MaterialState;
    maxState?: MaterialState;
  };
  uncertainty?: Quantity;
  status: PropertyStatus;
}

export interface MaterialRepresentation {
  identity: MaterialIdentity;
  properties: Record<string, MaterialProperty>; // e.g., 'DENSITY' -> MaterialProperty
  metadata?: Record<string, any>;
}

export interface EvaluatedMaterialProperty {
  propertyId: string;
  value: Quantity;
}
