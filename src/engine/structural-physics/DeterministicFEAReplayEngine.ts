/**
 * PATCH-SECP-073: Deterministic FEA Replay Engine
 * Asserts mathematical replay equivalence of finite element simulations.
 */

import { StructuralAnalysisResults } from './StructuralPhysicsTypes';

export class DeterministicFEAReplayEngine {
  public static verifyEquivalence(
    resultsA: StructuralAnalysisResults,
    resultsB: StructuralAnalysisResults
  ): boolean {
    if (resultsA.partId !== resultsB.partId) return false;
    if (resultsA.maxDisplacement !== resultsB.maxDisplacement) return false;
    if (resultsA.maxStress !== resultsB.maxStress) return false;
    if (resultsA.yieldExceeded !== resultsB.yieldExceeded) return false;

    // Strict numerical equivalence on active DOFs
    for (let i = 0; i < resultsA.nodes.length; i++) {
      const nodeA = resultsA.nodes[i];
      const nodeB = resultsB.nodes[i];

      if (nodeA.nodeId !== nodeB.nodeId) return false;
      if (nodeA.vonMises !== nodeB.vonMises) return false;
      if (nodeA.safetyFactor !== nodeB.safetyFactor) return false;
    }

    return true;
  }
}
