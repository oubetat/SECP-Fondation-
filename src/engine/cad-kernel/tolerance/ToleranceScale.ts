/**
 * SECP CAD Kernel — Scale-aware Tolerance logic
 * Phase 2 (PATCH-021)
 */

import { TolerancePolicy } from './TolerancePolicy';

export class ToleranceScale {
  /**
   * Deterministically calculates effective tolerance based on geometric scale and policy.
   */
  public static calculate(
    requested: number,
    geometryScale: number,
    policy: TolerancePolicy
  ): number {
    const scale = Math.abs(geometryScale);
    let baseTolerance = requested;

    if (policy.scaleBehavior === 'LINEAR') {
      baseTolerance = requested * (scale > 0 ? scale : 1.0);
    } else if (policy.scaleBehavior === 'LOGARITHMIC') {
      baseTolerance = requested * Math.log10(10 + scale);
    }

    // Apply bounds
    if (baseTolerance < policy.minTolerance) {
      return policy.minTolerance;
    }

    return baseTolerance;
  }

  /**
   * Identifies the geometric scale category.
   */
  public static getScaleCategory(scale: number): 'SMALL' | 'NORMAL' | 'LARGE' {
    const s = Math.abs(scale);
    if (s < 0.001) return 'SMALL';
    if (s > 1000) return 'LARGE';
    return 'NORMAL';
  }
}
