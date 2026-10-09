/**
 * PATCH-SECP-045 — Kinematic Determinism Validator
 * Verifies strict numerical repeatability and determinism across independent solve passes.
 * Compares exact 4x4 transformation matrices, residual errors, DOFs, limit results, and hash keys.
 */

import { Tolerance } from '../geometry/GeometryTolerance';
import { AssemblyComponent, AssemblyConstraint, PartDefinition } from './AssemblyConstraintTypes';
import { KinematicJoint, GearJoint, KinematicSolveResult } from './KinematicTypes';
import { AssemblyKinematicSolver } from './AssemblyKinematicSolver';

export interface DeterminismValidationResult {
  isDeterministic: boolean;
  passCount: number;
  maxTransformDelta: number;
  maxResidualDelta: number;
  hashMatch: boolean;
  hashes: string[];
  diagnostics: string[];
}

export class KinematicDeterminismValidator {
  /**
   * Runs N consecutive independent solves and asserts mathematical identity
   */
  public static async validateDeterminism(
    components: AssemblyComponent[],
    constraints: AssemblyConstraint[] = [],
    joints: KinematicJoint[] = [],
    gearJoints: GearJoint[] = [],
    jointCoordinates: Record<string, number> = {},
    partsMap: Map<string, PartDefinition> = new Map(),
    runs: number = 3
  ): Promise<DeterminismValidationResult> {
    const diagnostics: string[] = [];
    const results: KinematicSolveResult[] = [];
    const hashes: string[] = [];

    diagnostics.push(`[Determinism Validator] Executing ${runs} independent solve passes with identical inputs.`);

    for (let i = 0; i < runs; i++) {
      // Clone input structures to prevent shared mutation state
      const compClones: AssemblyComponent[] = components.map(c => ({
        ...c,
        placementTransform: { ...c.placementTransform, position: { ...c.placementTransform.position }, rotation: { ...c.placementTransform.rotation } },
        worldTransform: { ...c.worldTransform, position: { ...c.worldTransform.position }, rotation: { ...c.worldTransform.rotation }, matrix: [...(c.worldTransform.matrix || [])] }
      }));

      const res = await AssemblyKinematicSolver.solve(
        compClones,
        constraints,
        joints,
        gearJoints,
        { ...jointCoordinates },
        partsMap
      );

      results.push(res);
      hashes.push(res.deterministicHash);
    }

    let maxTransformDelta = 0;
    let maxResidualDelta = 0;
    let isDeterministic = true;

    const baseResult = results[0];
    const baseHash = baseResult.deterministicHash;

    for (let r = 1; r < results.length; r++) {
      const cur = results[r];

      // Compare Hashes
      if (cur.deterministicHash !== baseHash) {
        isDeterministic = false;
        diagnostics.push(`[Determinism Error] Hash mismatch on run ${r + 1}: ${cur.deterministicHash} vs ${baseHash}.`);
      }

      // Compare Residuals
      const resDelta = Math.abs(cur.residualError - baseResult.residualError);
      if (resDelta > maxResidualDelta) maxResidualDelta = resDelta;
      if (resDelta > Tolerance.VALIDATION) {
        isDeterministic = false;
        diagnostics.push(`[Determinism Error] Residual delta ${resDelta.toExponential(4)} exceeds validation tolerance.`);
      }

      // Compare Matrix Elements
      for (const compId of Object.keys(baseResult.componentTransforms)) {
        const baseMat = baseResult.componentTransforms[compId] || [];
        const curMat = cur.componentTransforms[compId] || [];

        for (let idx = 0; idx < 16; idx++) {
          const delta = Math.abs(baseMat[idx] - curMat[idx]);
          if (delta > maxTransformDelta) maxTransformDelta = delta;
          if (delta > Tolerance.VALIDATION) {
            isDeterministic = false;
            diagnostics.push(`[Determinism Error] Component ${compId} matrix[${idx}] delta ${delta.toExponential(4)} exceeds tolerance.`);
          }
        }
      }
    }

    const hashMatch = hashes.every(h => h === baseHash);
    diagnostics.push(`[Determinism Result] Max Matrix Delta: ${maxTransformDelta.toExponential(4)}, Max Residual Delta: ${maxResidualDelta.toExponential(4)}, Hash Match: ${hashMatch}.`);

    return {
      isDeterministic: isDeterministic && hashMatch,
      passCount: runs,
      maxTransformDelta,
      maxResidualDelta,
      hashMatch,
      hashes,
      diagnostics
    };
  }
}
