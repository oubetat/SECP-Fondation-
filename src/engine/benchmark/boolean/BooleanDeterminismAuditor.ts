/**
 * SECP Industrial OS v2 — Boolean Determinism & Stability Auditor
 * Phase 15 (PATCH-172)
 *
 * Runs repeated operations and asserts bit-exact determinism across topology, geometry, and serialization.
 */

import { TopoShape } from '../../cad-kernel/topology/TopologyContracts';
import { BooleanOperation } from '../../cad-kernel/boolean/BooleanTypes';
import { BooleanEngine } from '../../cad-kernel/boolean/BooleanEngine';
import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';
import { CanonicalSerializer } from '../../serialization/CanonicalSerializer';

export class BooleanDeterminismAuditor {
  public static readonly DEFAULT_ITERATIONS = 5;

  /**
   * Evaluates determinism of a Boolean operation over N consecutive runs.
   */
  public static audit(
    op: BooleanOperation,
    shapeA: TopoShape,
    shapeB: TopoShape,
    iterations: number = BooleanDeterminismAuditor.DEFAULT_ITERATIONS
  ): {
    isDeterministic: boolean;
    passCount: number;
    driftCount: number;
    hashes: string[];
    canonicalOutputHash: string;
    details: string[];
  } {
    const hashes: string[] = [];
    const details: string[] = [];
    let isDeterministic = true;
    let driftCount = 0;

    for (let i = 0; i < iterations; i++) {
      const result = BooleanEngine.execute(op, shapeA, shapeB);
      const hash = result.determinismHash;
      hashes.push(hash);

      if (i > 0 && hash !== hashes[0]) {
        isDeterministic = false;
        driftCount++;
        details.push(`Drift detected at iteration ${i}: expected ${hashes[0].substring(0, 12)}..., got ${hash.substring(0, 12)}...`);
      }
    }

    if (isDeterministic) {
      details.push(`Bit-exact determinism verified across all ${iterations} consecutive executions`);
    }

    return {
      isDeterministic,
      passCount: iterations - driftCount,
      driftCount,
      hashes,
      canonicalOutputHash: hashes[0] || 'EMPTY',
      details
    };
  }
}
