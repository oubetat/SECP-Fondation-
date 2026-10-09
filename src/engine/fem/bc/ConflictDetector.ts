/**
 * SECP CAD/CAE Platform - Constraint Conflict & Over-Constrained Detector
 * PATCH-235 — Boundary Condition Engine
 *
 * Detects conflicting Dirichlet constraints, over-constraints, redundant
 * boundary conditions, and invalid DOF assignments across active Load Cases.
 */

import { FEMMesh } from '../mesh/FEMMesh';
import {
  BoundaryConditionDefinition,
  BCDiagnosticIssue
} from './BoundaryConditionTypes';
import { ResolvedNodeConstraint } from './DOFResolver';

export interface ConflictAuditResult {
  hasConflict: boolean;
  hasOverConstraint: boolean;
  issues: BCDiagnosticIssue[];
  validConstraintMap: Map<string, ResolvedNodeConstraint>; // key: "nodeId_field" -> constraint
}

export class ConflictDetector {
  /**
   * Audits a list of active boundary conditions for conflicts, duplicates, and over-constraints.
   */
  public static auditConstraints(
    bcs: BoundaryConditionDefinition[],
    nodeConstraintsMap: Map<string, ResolvedNodeConstraint[]>, // bcId -> constraints
    mesh: FEMMesh
  ): ConflictAuditResult {
    const issues: BCDiagnosticIssue[] = [];
    let hasConflict = false;
    let hasOverConstraint = false;

    // Track active DOF assignments: "nodeId:field" -> { bcId, value, bcName }
    const dofAssignmentTracker = new Map<
      string,
      { bcId: string; bcName: string; value: number; type: string }[]
    >();

    for (const bc of bcs) {
      if (!bc.enabled) continue;

      const constraints = nodeConstraintsMap.get(bc.id) || [];
      for (const c of constraints) {
        const key = `${c.nodeId}:${c.field}`;
        if (!dofAssignmentTracker.has(key)) {
          dofAssignmentTracker.set(key, []);
        }

        dofAssignmentTracker.get(key)!.push({
          bcId: bc.id,
          bcName: bc.name,
          value: c.prescribedValue,
          type: bc.type
        });
      }
    }

    const validConstraintMap = new Map<string, ResolvedNodeConstraint>();

    // Analyze tracking entries
    for (const [dofKey, assignments] of dofAssignmentTracker.entries()) {
      const [nodeId, field] = dofKey.split(':');

      if (assignments.length === 1) {
        // Unique constraint - perfectly valid
        const single = assignments[0];
        validConstraintMap.set(dofKey, {
          nodeId,
          field: field as any,
          prescribedValue: single.value,
          coordinateSystemId: 'GLOBAL'
        });
      } else {
        // Multiple assignments on the exact same node and DOF
        const firstVal = assignments[0].value;
        const allSameValue = assignments.every(
          (a) => Math.abs(a.value - firstVal) < 1e-9
        );

        if (!allSameValue) {
          // Hard Conflict: e.g., Node 15 UX = 0 AND Node 15 UX = 0.01
          hasConflict = true;
          const bcNames = assignments.map((a) => `'${a.bcName}' (${a.value})`).join(', ');
          issues.push({
            code: 'CONFLICT_DETECTED',
            severity: 'ERROR',
            nodeId,
            dof: field as any,
            message: `Conflicting Dirichlet constraints detected on Node ${nodeId} [${field}]: ${bcNames}. Solution rejected.`
          });
        } else {
          // Redundant Over-Constraint: e.g., Node 15 UX = 0 in BC-1 AND Node 15 UX = 0 in BC-2
          hasOverConstraint = true;
          const bcNames = assignments.map((a) => `'${a.bcName}'`).join(', ');
          issues.push({
            code: 'OVER_CONSTRAINED',
            severity: 'WARNING',
            nodeId,
            dof: field as any,
            message: `Redundant duplicate constraint detected on Node ${nodeId} [${field}]: ${bcNames}. Prescribed value is identical (${firstVal}).`
          });

          // Use the prescribed value cleanly
          validConstraintMap.set(dofKey, {
            nodeId,
            field: field as any,
            prescribedValue: firstVal,
            coordinateSystemId: 'GLOBAL'
          });
        }
      }
    }

    return {
      hasConflict,
      hasOverConstraint,
      issues,
      validConstraintMap
    };
  }
}
