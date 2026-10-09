/**
 * SECP Industrial OS v2 — Residual Framework
 * PATCH-056: Residual Policy
 */

import { ResidualEquation, ResidualNormType } from './ResidualTypes';
import { NormalizationPolicy } from './ResidualNormalizer';

export interface EquationResidualPolicy {
  readonly equation: ResidualEquation;
  readonly normType: ResidualNormType;
  readonly normalization: NormalizationPolicy;
  readonly absoluteTolerance: number;
  readonly relativeTolerance: number;
  readonly divergenceThreshold: number;
  readonly stagnationWindow: number;
  readonly stagnationTolerance: number;
}

export interface ResidualGlobalPolicy {
  readonly equations: Map<ResidualEquation, EquationResidualPolicy>;
  readonly denominatorFloor: number;
}

export const DEFAULT_RESIDUAL_POLICY: ResidualGlobalPolicy = {
  equations: new Map([
    [ResidualEquation.MASS, {
      equation: ResidualEquation.MASS,
      normType: ResidualNormType.L2,
      normalization: NormalizationPolicy.INITIAL_RESIDUAL,
      absoluteTolerance: 1e-8,
      relativeTolerance: 1e-6,
      divergenceThreshold: 1e6,
      stagnationWindow: 20,
      stagnationTolerance: 1e-12
    }],
    [ResidualEquation.MOMENTUM_X, {
      equation: ResidualEquation.MOMENTUM_X,
      normType: ResidualNormType.L2,
      normalization: NormalizationPolicy.INITIAL_RESIDUAL,
      absoluteTolerance: 1e-8,
      relativeTolerance: 1e-6,
      divergenceThreshold: 1e6,
      stagnationWindow: 20,
      stagnationTolerance: 1e-12
    }]
  ]),
  denominatorFloor: 1e-15
};
