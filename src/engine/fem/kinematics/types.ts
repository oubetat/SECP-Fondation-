export enum ConfigurationModel {
  REFERENCE = 'REFERENCE',
  CURRENT = 'CURRENT',
  UPDATED = 'UPDATED'
}

export enum StressMeasure {
  CAUCHY = 'CAUCHY',
  PK1 = 'PK1',
  PK2 = 'PK2',
  KIRCHHOFF = 'KIRCHHOFF'
}

export enum FiniteStrainMeasure {
  GREEN_LAGRANGE = 'GREEN_LAGRANGE',
  ALMANSI = 'ALMANSI',
  LOGARITHMIC = 'LOGARITHMIC'
}

export interface DeformationGradientResult {
  F: number[][]; // 2x2 or 3x3
  J: number;
}

export interface PolarDecompositionResult {
  R: number[][];
  U: number[][];
  V: number[][];
}

export interface ReferenceState {
  coords: number[][]; // [nodeIndex][dim]
  connectivity: number[];
  jacobian: number;
  volume: number;
  orientation: number[][];
}

export interface CurrentState {
  coords: number[][];
  displacement: number[][];
  jacobian: number;
  volume: number;
  orientation: number[][];
}

export enum LargeDeformationFailureType {
  INVALID_DEFORMATION = 'INVALID_DEFORMATION',
  NEGATIVE_JACOBIAN = 'NEGATIVE_JACOBIAN',
  SINGULAR_DEFORMATION = 'SINGULAR_DEFORMATION',
  KINEMATIC_FAILURE = 'KINEMATIC_FAILURE',
  OBJECTIVITY_FAILURE = 'OBJECTIVITY_FAILURE',
  MATERIAL_FAILURE = 'MATERIAL_FAILURE',
  GEOMETRIC_TANGENT_FAILURE = 'GEOMETRIC_TANGENT_FAILURE',
  MATERIAL_TANGENT_FAILURE = 'MATERIAL_TANGENT_FAILURE',
  CONTACT_FAILURE = 'CONTACT_FAILURE',
  ENERGY_FAILURE = 'ENERGY_FAILURE',
  NEWTON_FAILURE = 'NEWTON_FAILURE',
  LOAD_STEP_FAILURE = 'LOAD_STEP_FAILURE',
  NUMERICAL_FAILURE = 'NUMERICAL_FAILURE'
}

export enum LargeDeformationVerdict {
  CONVERGED = 'CONVERGED',
  NOT_CONVERGED = 'NOT_CONVERGED',
  INVALID_DEFORMATION = 'INVALID_DEFORMATION',
  NEGATIVE_JACOBIAN = 'NEGATIVE_JACOBIAN',
  OBJECTIVITY_FAILURE = 'OBJECTIVITY_FAILURE',
  MATERIAL_FAILURE = 'MATERIAL_FAILURE',
  CONTACT_FAILURE = 'CONTACT_FAILURE',
  TANGENT_FAILURE = 'TANGENT_FAILURE',
  ENERGY_FAILURE = 'ENERGY_FAILURE',
  NUMERICAL_FAILURE = 'NUMERICAL_FAILURE',
  VERIFIED = 'VERIFIED'
}
