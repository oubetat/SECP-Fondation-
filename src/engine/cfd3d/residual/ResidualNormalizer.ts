/**
 * SECP Industrial OS v2 — Residual Framework
 * PATCH-056: Residual Normalizer
 */

import { ResidualNorms, ResidualNormType } from './ResidualTypes';

export enum NormalizationPolicy {
  INITIAL_RESIDUAL = 'INITIAL_RESIDUAL',
  RHS_NORM = 'RHS_NORM',
  EQUATION_SCALE = 'EQUATION_SCALE',
  FIXED_FLOOR = 'FIXED_FLOOR'
}

export interface NormalizationContext {
  readonly policy: NormalizationPolicy;
  readonly referenceValue: number;
  readonly denominatorFloor: number;
}

export class ResidualNormalizer {
  
  /**
   * Normalizes absolute norms using the provided context
   */
  public static normalize(
    absolute: ResidualNorms,
    context: NormalizationContext
  ): { normalized: ResidualNorms; diagnostics: string[] } {
    const diagnostics: string[] = [];
    const denominator = Math.max(Math.abs(context.referenceValue), context.denominatorFloor);

    if (denominator <= 0) {
      diagnostics.push('NORMALIZATION_DENOMINATOR_ZERO');
      return {
        normalized: { l1: absolute.l1, l2: absolute.l2, lInf: absolute.lInf },
        diagnostics
      };
    }

    if (denominator < context.denominatorFloor * 1.1) {
      diagnostics.push('NORMALIZATION_DENOMINATOR_TOO_SMALL');
    }

    const invDenom = 1.0 / denominator;

    return {
      normalized: {
        l1: absolute.l1 * invDenom,
        l2: absolute.l2 * invDenom,
        lInf: absolute.lInf * invDenom
      },
      diagnostics
    };
  }

  /**
   * Factory for creating normalization contexts
   */
  public static createContext(
    policy: NormalizationPolicy,
    referenceValue: number,
    denominatorFloor: number = 1e-15
  ): NormalizationContext {
    return {
      policy,
      referenceValue,
      denominatorFloor
    };
  }
}
