/**
 * SECP CAD Kernel — Production 3D GCS Over-Constraint & Conflict Detector
 * Phase 15 (PATCH-173)
 *
 * Distinguishes redundant constraints from contradictory geometric conflicts,
 * localizes the Minimal Conflict Set (MCS), and generates deterministic diagnostic reports.
 */

import {
  Spatial3DEntity,
  Production3DConstraint,
  MinimalConflictSet
} from './Production3DGCSTypes';
import { SpatialConstraintSystem } from './SpatialConstraintSystem';
import { SpatialConstraintEvaluator } from './SpatialConstraintEvaluator';
import { SpatialJacobianEngine } from './SpatialJacobianEngine';

export interface RedundancyDiagnostic {
  readonly constraintId: string;
  readonly reason: string;
  readonly independentRank: number;
}

export interface OverConstraintAnalysis {
  readonly isOverConstrained: boolean;
  readonly hasConflicts: boolean;
  readonly redundancies: RedundancyDiagnostic[];
  readonly minimalConflictSets: MinimalConflictSet[];
  readonly diagnostics: string[];
}

export class OverConstraintDetector {
  public static analyze(
    entities: Record<string, Spatial3DEntity>,
    constraints: readonly Production3DConstraint[],
    options: { tolerance?: number } = {}
  ): OverConstraintAnalysis {
    const tol = options.tolerance ?? 1e-6;
    const redundancies: RedundancyDiagnostic[] = [];
    const minimalConflictSets: MinimalConflictSet[] = [];
    const diagnostics: string[] = [];

    const activeConstraints = constraints.filter(c => c.driving);
    if (activeConstraints.length === 0) {
      return {
        isOverConstrained: false,
        hasConflicts: false,
        redundancies: [],
        minimalConflictSets: [],
        diagnostics: []
      };
    }

    // 1. Check for pairwise explicit direct conflicts (e.g. 2 different distance values between same entities)
    const entityPairMap = new Map<string, Production3DConstraint[]>();
    for (const c of activeConstraints) {
      const targetKey = c.entities
        .map(t => t.entityId)
        .sort()
        .join('::');
      if (!entityPairMap.has(targetKey)) {
        entityPairMap.set(targetKey, []);
      }
      entityPairMap.get(targetKey)!.push(c);
    }

    for (const [pairKey, cList] of entityPairMap.entries()) {
      if (cList.length > 1) {
        // Check distance conflicts
        const distConstraints = cList.filter(c => c.type === 'DISTANCE');
        if (distConstraints.length >= 2) {
          const v0 = distConstraints[0].parameters.targetDistance ?? distConstraints[0].parameters.value ?? 0;
          const v1 = distConstraints[1].parameters.targetDistance ?? distConstraints[1].parameters.value ?? 0;
          if (Math.abs(v0 - v1) > tol) {
            const cIds = [distConstraints[0].constraintId, distConstraints[1].constraintId];
            minimalConflictSets.push({
              conflictId: `CONFLICT-DIST-${minimalConflictSets.length + 1}`,
              conflictingConstraintIds: cIds,
              affectedEntityIds: pairKey.split('::'),
              explanation: `Contradictory distance constraints: ${distConstraints[0].constraintId} specifies ${v0}mm while ${distConstraints[1].constraintId} specifies ${v1}mm on entities (${pairKey}).`,
              closureResidual: Math.abs(v0 - v1)
            });
            diagnostics.push(`CONFLICT: Distance mismatch (${v0}mm vs ${v1}mm) between ${pairKey}`);
          } else {
            redundancies.push({
              constraintId: distConstraints[1].constraintId,
              reason: `Duplicate identical distance constraint (${v1}mm) already asserted by ${distConstraints[0].constraintId}`,
              independentRank: 1
            });
            diagnostics.push(`REDUNDANT: Constraint ${distConstraints[1].constraintId} is duplicate of ${distConstraints[0].constraintId}`);
          }
        }

        // Check angle / parallel / perpendicular conflicts
        const parallel = cList.find(c => c.type === 'PARALLEL');
        const perp = cList.find(c => c.type === 'PERPENDICULAR');
        if (parallel && perp) {
          minimalConflictSets.push({
            conflictId: `CONFLICT-ANG-${minimalConflictSets.length + 1}`,
            conflictingConstraintIds: [parallel.constraintId, perp.constraintId],
            affectedEntityIds: pairKey.split('::'),
            explanation: `Simultaneous PARALLEL (${parallel.constraintId}) and PERPENDICULAR (${perp.constraintId}) constraint applied to identical entities (${pairKey}).`,
            closureResidual: 1.0
          });
          diagnostics.push(`CONFLICT: Incompatible geometric relations PARALLEL and PERPENDICULAR on ${pairKey}`);
        }
      }
    }

    // 2. Incremental Jacobian Subsystem Rank Analysis for Higher-Order & Loop Redundancies
    const system = new SpatialConstraintSystem(entities);
    const incrementalConstraints: Production3DConstraint[] = [];
    let previousRank = 0;

    for (let i = 0; i < activeConstraints.length; i++) {
      const c = activeConstraints[i];
      // Skip if already categorized in direct pairwise conflict
      if (minimalConflictSets.some(mcs => mcs.conflictingConstraintIds.includes(c.constraintId))) {
        continue;
      }

      incrementalConstraints.push(c);
      const jacobian = SpatialJacobianEngine.compute(system, incrementalConstraints);
      const currentRank = jacobian.rank;

      if (currentRank === previousRank) {
        // This constraint did not increase the independent rank of the system
        // Evaluate its individual residual to see if it is naturally satisfied (redundant) or violated (conflicting)
        const evalRes = SpatialConstraintEvaluator.evaluateConstraint(system, c);
        const maxRes = Math.max(...evalRes.map(Math.abs));

        if (maxRes <= tol) {
          redundancies.push({
            constraintId: c.constraintId,
            reason: `Constraint ${c.constraintId} (${c.type}) is algebraically dependent on prior constraint network.`,
            independentRank: currentRank
          });
          diagnostics.push(`REDUNDANT: ${c.constraintId} adds 0 independent degrees of restriction`);
        } else {
          // If violated and 0 rank addition, it is conflicting with the existing loop
          const conflictingGroup = incrementalConstraints.map(x => x.constraintId);
          minimalConflictSets.push({
            conflictId: `CONFLICT-SYS-${minimalConflictSets.length + 1}`,
            conflictingConstraintIds: conflictingGroup,
            affectedEntityIds: Array.from(new Set(incrementalConstraints.flatMap(x => x.entities.map(e => e.entityId)))),
            explanation: `Constraint ${c.constraintId} (${c.type}) contradicts the closed spatial loop established by {${conflictingGroup.slice(0, -1).join(', ')}}.`,
            closureResidual: maxRes
          });
          diagnostics.push(`CONFLICT: Loop over-constraint involving ${c.constraintId}`);
        }
      } else {
        previousRank = currentRank;
      }
    }

    return {
      isOverConstrained: redundancies.length > 0 || minimalConflictSets.length > 0,
      hasConflicts: minimalConflictSets.length > 0,
      redundancies,
      minimalConflictSets,
      diagnostics
    };
  }
}
