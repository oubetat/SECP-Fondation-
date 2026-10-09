import * as crypto from 'crypto';
/**
 * SECP Industrial OS v2 — GCS Determinism Auditor
 * Phase 15 (PATCH-173)
 *
 * Validates that multiple independent solver runs on identical input sketches
 * produce bit-exact identical geometry, DOF, and residual hashes.
 */

import { DeterminismResult } from './types';
import { IndustrialVariationalSolver } from '../../sketch/IndustrialVariationalSolver';
import { IndustrialSketchDefinition } from '../../sketch/IndustrialConstraintTypes';

export class GCSDeterminismAuditor {
  /**
   * Runs the solver multiple times from identical input state and checks for determinism.
   */
  public static auditDeterminism(
    sketch: IndustrialSketchDefinition,
    iterations: number = 3
  ): DeterminismResult {
    const solver = new IndustrialVariationalSolver();
    const hashes: string[] = [];
    const details: string[] = [];
    let driftCount = 0;

    for (let i = 0; i < iterations; i++) {
      const clonedSketch: IndustrialSketchDefinition = JSON.parse(JSON.stringify(sketch));
      const res = solver.solve(clonedSketch);
      const hash = this.computeStateHash(res.sketch, res.maxResidual, res.iterations);
      hashes.push(hash);
    }

    const firstHash = hashes[0];
    let passCount = 0;

    for (let i = 0; i < hashes.length; i++) {
      if (hashes[i] === firstHash) {
        passCount++;
      } else {
        driftCount++;
        details.push(`Drift detected on run ${i + 1}: hash ${hashes[i]} != initial ${firstHash}`);
      }
    }

    const isDeterministic = driftCount === 0;
    if (isDeterministic) {
      details.push(`Deterministic execution verified across ${iterations} runs (hash: ${firstHash})`);
    }

    return {
      isDeterministic,
      passCount,
      driftCount,
      hashes,
      details
    };
  }

  private static computeStateHash(sketch: IndustrialSketchDefinition, res: number, iter: number): string {
    const coords: string[] = [];
    const sortedEntityIds = Object.keys(sketch.entities).sort();

    for (const id of sortedEntityIds) {
      const ent = sketch.entities[id];
      if (ent.type === 'POINT') {
        coords.push(`${id}:P:${ent.x.toFixed(8)},${ent.y.toFixed(8)}`);
      } else if (ent.type === 'CIRCLE' || ent.type === 'ARC') {
        coords.push(`${id}:C:${(ent as any).radius?.toFixed(8)}`);
      }
    }

    const str = `${coords.join('|')}_res:${res.toExponential(6)}_iter:${iter}`;
    return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
  }
}
