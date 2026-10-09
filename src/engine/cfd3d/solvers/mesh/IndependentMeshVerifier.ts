/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-069: Independent Mesh Independence Verifier
 */

import { MeshFamily } from './MeshTypes';

export interface IndependentMeshVerificationResult {
  readonly isValid: boolean;
  readonly systematicRefinementPassed: boolean;
  readonly geometryConsistencyPassed: boolean;
  readonly diagnostics: string[];
}

export class IndependentMeshVerifier {
  public static verify(
    family: MeshFamily,
    expectedRatio: number
  ): IndependentMeshVerificationResult {
    const diagnostics: string[] = [];
    let systematicRefinementPassed = true;
    let geometryConsistencyPassed = true;

    // 1. Geometry Consistency Check
    const refGeomHash = family.geometryHash;
    if (!refGeomHash || refGeomHash === '') {
      geometryConsistencyPassed = false;
      diagnostics.push('Geometry hash is missing or empty');
    }

    // 2. Systematic Refinement Check
    const levels = family.levels;
    const size = levels.length;
    for (let i = 1; i < size; i++) {
      const coarseLength = levels[i - 1].characteristicLength;
      const fineLength = levels[i].characteristicLength;
      const ratio = coarseLength / fineLength;

      if (Math.abs(ratio - expectedRatio) > 0.05) {
        systematicRefinementPassed = false;
        diagnostics.push(`Non-systematic refinement ratio detected between level ${i-1} and level ${i}: actual=${ratio}, expected=${expectedRatio}`);
      }
    }

    const isValid = systematicRefinementPassed && geometryConsistencyPassed;

    return {
      isValid,
      systematicRefinementPassed,
      geometryConsistencyPassed,
      diagnostics
    };
  }
}
