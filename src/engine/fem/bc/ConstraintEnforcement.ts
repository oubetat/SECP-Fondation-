/**
 * SECP CAD/CAE Platform - Boundary Condition Numerical Enforcement Engine
 * PATCH-235 — Boundary Condition Engine
 *
 * Implements Dirichlet constraint numerical enforcement strategies:
 * 1. Direct Elimination / Partitioning
 * 2. Exact Row-Column Modification
 * 3. Penalty Method (with adaptive penalty parameter alpha = 10^12 * max(diag(K)))
 */

import { CSRStorage } from '../sparse/CSRStorage';
import { COOBuilder } from '../sparse/COOBuilder';
import { DOFManager } from '../assembly/DOFManager';
import { EnforcementMethod } from './BoundaryConditionTypes';
import { ResolvedNodeConstraint } from './DOFResolver';

export interface EnforcementResult {
  K_mod: CSRStorage;
  F_mod: number[];
  enforcementMethod: EnforcementMethod;
  penaltyParameterUsed?: number;
  conditioningImpactRatio?: number;
  modifiedDOFCount: number;
}

export class ConstraintEnforcement {
  /**
   * Enforces prescribed Dirichlet boundary conditions on sparse K_global and F_global.
   */
  public static enforceConstraints(
    csrK: CSRStorage,
    F_global: number[],
    dofManager: DOFManager,
    method: EnforcementMethod = 'ROW_COLUMN_MODIFICATION',
    userPenaltyFactor: number = 1e12
  ): EnforcementResult {
    const totalDOFs = csrK.rows;
    const prescribedMap = new Map<number, number>();

    // Gather prescribed global DOF indices and values
    for (let i = 0; i < totalDOFs; i++) {
      const desc = dofManager.getDescriptor(i);
      if (desc.status === 'PRESCRIBED') {
        prescribedMap.set(i, desc.prescribedValue ?? 0.0);
      }
    }

    if (prescribedMap.size === 0) {
      return {
        K_mod: csrK,
        F_mod: [...F_global],
        enforcementMethod: method,
        modifiedDOFCount: 0
      };
    }

    if (method === 'PENALTY_METHOD') {
      return ConstraintEnforcement.applyPenaltyMethod(csrK, F_global, prescribedMap, userPenaltyFactor);
    } else {
      // Row-Column modification (or Direct Elimination equivalent)
      return ConstraintEnforcement.applyRowColumnModification(csrK, F_global, prescribedMap);
    }
  }

  private static applyRowColumnModification(
    csrK: CSRStorage,
    F_global: number[],
    prescribedMap: Map<number, number>
  ): EnforcementResult {
    const totalDOFs = csrK.rows;
    const F_mod = [...F_global];

    // 1. Adjust RHS for non-zero prescribed values: F_i -= K_ij * u_j
    for (const [pIdx, u_val] of prescribedMap.entries()) {
      if (Math.abs(u_val) > 1e-12) {
        for (let r = 0; r < totalDOFs; r++) {
          if (!prescribedMap.has(r)) {
            const K_ji = csrK.get(r, pIdx);
            F_mod[r] -= K_ji * u_val;
          }
        }
      }
    }

    // 2. Modify K and F for prescribed DOFs: zero out rows & columns, set diagonal to 1.0, F[i] = u_val
    const coo = new COOBuilder(totalDOFs, totalDOFs);

    for (let r = 0; r < totalDOFs; r++) {
      const rowStart = csrK.rowPointers[r];
      const rowEnd = csrK.rowPointers[r + 1];

      if (prescribedMap.has(r)) {
        // Prescribed row: K[r, r] = 1.0, F_mod[r] = u_val
        coo.add(r, r, 1.0);
        F_mod[r] = prescribedMap.get(r)!;
      } else {
        // Free row: zero out columns corresponding to prescribed DOFs
        for (let p = rowStart; p < rowEnd; p++) {
          const c = csrK.columnIndices[p];
          const val = csrK.values[p];
          if (!prescribedMap.has(c)) {
            coo.add(r, c, val);
          }
        }
      }
    }

    const K_mod = coo.toCSR();

    return {
      K_mod,
      F_mod,
      enforcementMethod: 'ROW_COLUMN_MODIFICATION',
      modifiedDOFCount: prescribedMap.size
    };
  }

  private static applyPenaltyMethod(
    csrK: CSRStorage,
    F_global: number[],
    prescribedMap: Map<number, number>,
    userPenaltyFactor: number
  ): EnforcementResult {
    const totalDOFs = csrK.rows;
    const F_mod = [...F_global];

    // Find max diagonal stiffness entry K_ii
    let maxDiag = 0.0;
    for (let r = 0; r < totalDOFs; r++) {
      const val = Math.abs(csrK.get(r, r));
      if (val > maxDiag) maxDiag = val;
    }
    if (maxDiag === 0) maxDiag = 1e6;

    // Penalty parameter alpha = penaltyFactor * maxDiag
    const alpha = userPenaltyFactor * maxDiag;

    const coo = new COOBuilder(totalDOFs, totalDOFs);

    // Copy original K and add alpha to prescribed diagonals
    for (let r = 0; r < totalDOFs; r++) {
      const rowStart = csrK.rowPointers[r];
      const rowEnd = csrK.rowPointers[r + 1];

      for (let p = rowStart; p < rowEnd; p++) {
        const c = csrK.columnIndices[p];
        const val = csrK.values[p];

        if (r === c && prescribedMap.has(r)) {
          // K_rr += alpha
          coo.add(r, c, val + alpha);
        } else {
          coo.add(r, c, val);
        }
      }

      // Modify RHS: F[r] += alpha * u_prescribed
      if (prescribedMap.has(r)) {
        const u_val = prescribedMap.get(r)!;
        F_mod[r] += alpha * u_val;
      }
    }

    const K_mod = coo.toCSR();
    const conditioningImpactRatio = (maxDiag + alpha) / maxDiag;

    return {
      K_mod,
      F_mod,
      enforcementMethod: 'PENALTY_METHOD',
      penaltyParameterUsed: alpha,
      conditioningImpactRatio,
      modifiedDOFCount: prescribedMap.size
    };
  }
}
