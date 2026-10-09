/**
 * SECP CAD Kernel — GCS Deterministic Solver
 * Phase 2 (PATCH-025)
 */

import { SketchModel } from '../SketchModel';
import { SketchConstraint } from './ConstraintModel';
import { ConstraintSolver, SolverOptions } from './ConstraintSolver';
import { SolverResult } from './SolverResult';

export class DeterministicSolver {
  /**
   * Wrapper that ensures stability of input arrays for deterministic execution.
   */
  public static solve(
    sketch: SketchModel,
    constraints: readonly SketchConstraint[],
    options: SolverOptions = {}
  ): SolverResult {
    // 1. Sort constraints by stable identity
    const sortedConstraints = [...constraints].sort((a, b) => 
      a.id.projectId.localeCompare(b.id.projectId)
    );

    // 2. Sketch should already be stable if it came from SketchCanonicalizer, 
    // but we can ensure entities are sorted here too if needed.
    const sortedEntities = [...sketch.entities].sort((a, b) => 
      a.id.projectId.localeCompare(b.id.projectId)
    );

    const stableSketch: SketchModel = {
      ...sketch,
      entities: sortedEntities
    };

    // 3. Execute core solver
    const result = ConstraintSolver.solve(stableSketch, sortedConstraints, {
      ...options,
      deterministicMode: true
    });

    // 4. Attach deterministic fingerprint (hash of the result state)
    return {
      ...result,
      deterministicFingerprint: this.computeFingerprint(result)
    };
  }

  private static computeFingerprint(result: SolverResult): string {
    // Simple hash of residuals and solved state summary
    const str = `${result.status}:${result.finalResidualNorm.toFixed(10)}:${result.iterations}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `gcs-stable-${Math.abs(hash).toString(16)}`;
  }
}
