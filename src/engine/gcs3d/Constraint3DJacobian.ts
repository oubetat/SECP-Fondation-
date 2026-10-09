/**
 * SECP CAD Kernel — GCS 3D Jacobian
 * Phase 2 (PATCH-026)
 */

import { Constraint3DSystem } from './Constraint3DSystem';
import { Constraint3D } from './Constraint3DModel';
import { Constraint3DEvaluator } from './Constraint3DEvaluator';

export class Constraint3DJacobian {
  /**
   * Numerically computes the Jacobian matrix J = dr/dx in a deterministic,
   * tolerance-controlled, and stable manner.
   */
  public static compute(
    system: Constraint3DSystem,
    constraints: readonly Constraint3D[],
    eps: number = 1e-8
  ): number[][] {
    const x = system.getVector();
    const r0 = Constraint3DEvaluator.evaluate(system, constraints);
    const m = r0.length;
    const n = x.length;
    const J: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));

    for (let j = 0; j < n; j++) {
      const x_plus = [...x];
      x_plus[j] += eps;
      system.updateFromVector(x_plus);
      const r_plus = Constraint3DEvaluator.evaluate(system, constraints);

      for (let i = 0; i < m; i++) {
        const val = (r_plus[i] - r0[i]) / eps;
        J[i][j] = Number.isFinite(val) ? val : 0;
      }
    }

    // Restore original system vector state
    system.updateFromVector(x);
    return J;
  }
}
