/**
 * SECP Industrial OS v2 — Residual Framework
 * PATCH-056: Core Types and Models
 */

export enum ResidualEquation {
  MASS = 'MASS',
  MOMENTUM_X = 'MOMENTUM_X',
  MOMENTUM_Y = 'MOMENTUM_Y',
  MOMENTUM_Z = 'MOMENTUM_Z',
  ENERGY = 'ENERGY',
  PRESSURE = 'PRESSURE',
  CUSTOM = 'CUSTOM'
}

export enum ResidualNormType {
  L1 = 'L1',
  L2 = 'L2',
  LINF = 'LINF'
}

export interface ResidualNorms {
  readonly l1: number;
  readonly l2: number;
  readonly lInf: number;
}

export interface ResidualSample {
  readonly iteration: number;
  readonly absoluteResidual: ResidualNorms;
  readonly normalizedResidual: ResidualNorms;
  readonly equation: ResidualEquation;
  readonly timestamp: string;
  readonly stateHash: string;
  readonly finite: boolean;
  readonly diagnostics: string[];
}

export interface ResidualReport {
  readonly equationResiduals: ResidualSample[];
  readonly globalResidual?: number;
  readonly aggregationMethod?: string;
  readonly timestamp: string;
}
